import mongoose from "mongoose";
import User from "../models/users.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";
import Chat from "../models/chat.model.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message, error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id } = req.params;
    const myId = req.user?._id;

    if (
      !mongoose.Types.ObjectId.isValid(id) ||
      !mongoose.Types.ObjectId.isValid(myId)
    ) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const chat = await Chat.findById(id).populate(
      "members",
      "fullName profilePic"
    );
    if (chat && chat.isGroupChat) {
      if (!chat.members.some((m) => m._id.equals(myId))) {
        return res
          .status(403)
          .json({ message: "You are not a member of this group" });
      }
      const messages = await Message.find({ chatId: id })
        .populate("senderId", "fullName profilePic")
        .sort({ createdAt: 1 })
        .lean();
      return res.status(200).json(messages);
    }

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: id },
        { senderId: id, receiverId: myId },
      ],
    })
      .populate("senderId", "fullName profilePic")
      .sort({ createdAt: 1 })
      .lean();

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Internal Server Error", error: error.message });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body || {};
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    let imageUrl = "";
    let audioUrl = "";

    console.log(`Sending message from ${senderId} to ${receiverId}`);

    const sender = await User.findById(senderId);
    const receiver = await User.findById(receiverId);

    if (!sender || !receiver) {
      return res.status(404).json({ message: "User not found" });
    }

    if (sender.blockedUsers.includes(receiverId)) {
      return res.status(403).json({ message: "You have blocked this user" });
    }
    if (receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: "This user has blocked you" });
    }

    if (req.file) {
      console.log("Uploading file to Cloudinary...", {
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
      });
      const uploadResponse = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: req.file.mimetype.startsWith("image/")
              ? "image"
              : "auto",
            folder: req.file.mimetype.startsWith("image/")
              ? "chat_images"
              : "chat_audio",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.on("error", reject);
        if (req.file.buffer && req.file.buffer.length > 0) {
          stream.write(req.file.buffer);
          stream.end();
        } else {
          reject(new Error("Empty file buffer"));
        }
      });

      if (req.file.mimetype.startsWith("image/")) {
        imageUrl = uploadResponse.secure_url;
      } else {
        audioUrl = uploadResponse.secure_url;
      }
    }

    if (!text && !imageUrl && !audioUrl) {
      return res
        .status(400)
        .json({ message: "Message must contain text, image, or audio" });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl || undefined,
      audio: audioUrl || undefined,
    });

    const savedMessage = await newMessage.save();
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate("senderId", "fullName profilePic")
      .lean();

    const receiverSocketId = getReceiverSocketId(receiverId);
    const senderSocketId = getReceiverSocketId(senderId.toString());

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("newMessage", populatedMessage);
      io.to(receiverSocketId).emit("notification", {
        type: "message",
        message: `New message from ${sender.fullName}`,
        from: senderId,
        content: text || (imageUrl ? "Image" : "Audio"),
        timestamp: new Date(),
      });
      console.log(`Notification emitted to receiver ${receiverId} at socket ${receiverSocketId}`);
    } else {
      console.log(`Receiver ${receiverId} is offline or not connected`);
    }

    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", populatedMessage);
    } else {
      console.log(`Sender ${senderId} socket not found`);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to send message", error: error.message });
  }
};

export const sendGroupMessage = async (req, res) => {
  try {
    const { text } = req.body || {};
    const { chatId } = req.params;
    const senderId = req.user._id;
    let audioUrl = "";
    let imageUrl = "";

    if (!mongoose.Types.ObjectId.isValid(chatId)) {
      return res.status(400).json({ message: "Invalid chat ID" });
    }

    const chat = await Chat.findById(chatId).populate(
      "members",
      "fullName profilePic"
    );
    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!chat.members.some((m) => m._id.equals(senderId))) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    if (req.file) {
      const uploadResponse = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: req.file.mimetype.startsWith("image/")
              ? "image"
              : "auto",
            folder: req.file.mimetype.startsWith("image/")
              ? "chat_images"
              : "chat_audio",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.on("error", reject);
        if (req.file.buffer && req.file.buffer.length > 0) {
          stream.write(req.file.buffer);
          stream.end();
        } else {
          reject(new Error("Empty file buffer"));
        }
      });

      if (req.file.mimetype.startsWith("image/")) {
        imageUrl = uploadResponse.secure_url;
      } else {
        audioUrl = uploadResponse.secure_url;
      }
    }

    if (!text && !audioUrl && !imageUrl) {
      return res
        .status(400)
        .json({ message: "Message must contain text, image, or audio" });
    }

    const newMessage = new Message({
      chatId,
      senderId,
      text: text || "",
      image: imageUrl || undefined,
      audio: audioUrl || undefined,
    });

    const savedMessage = await newMessage.save();
    const populatedMessage = await Message.findById(savedMessage._id)
      .populate("senderId", "fullName profilePic")
      .lean();

    const sender = await User.findById(senderId);
    chat.members.forEach((member) => {
      const memberSocketId = getReceiverSocketId(member._id.toString());
      if (memberSocketId && !member._id.equals(senderId)) {
        io.to(memberSocketId).emit("newMessage", populatedMessage);
        io.to(memberSocketId).emit("notification", {
          type: "group_message",
          message: `New message in ${chat.name} from ${sender.fullName}`,
          from: senderId,
          content: text || (imageUrl ? "Image" : "Audio"),
          chatId,
          timestamp: new Date(),
        });
        console.log(`Notification emitted to member ${member._id} at socket ${memberSocketId}`);
      } else if (!memberSocketId) {
        console.log(`Member ${member._id} is offline or not connected`);
      }
    });

    // Emit to sender as well
    const senderSocketId = getReceiverSocketId(senderId.toString());
    if (senderSocketId) {
      io.to(senderSocketId).emit("newMessage", populatedMessage);
    } else {
      console.log(`Sender ${senderId} socket not found`);
    }

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error("Error in sendGroupMessage:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to send group message", error: error.message });
  }
};