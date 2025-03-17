import mongoose from "mongoose";
import User from "../models/users.model.js";
import Message from "../models/message.model.js";
import { getReceiverSocketId, io } from "../lib/socket.js";
import cloudinary from "../lib/cloudinary.js";

export const getUsersForSidebar = async (req, res) => {
  try {
    const loggedInUserId = req.user._id;
    const filteredUsers = await User.find({
      _id: { $ne: loggedInUserId },
    }).select("-password");
    res.status(200).json(filteredUsers);
  } catch (error) {
    console.error("Error in getUsersForSidebar:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const myId = req.user._id;

    const messages = await Message.find({
      $or: [
        { senderId: myId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: myId },
      ],
    }).sort({ createdAt: 1 });

    res.status(200).json(messages);
  } catch (error) {
    console.error("Error in getMessages:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const sendMessage = async (req, res) => {
  try {
    const { text } = req.body || {};
    const { id: receiverId } = req.params;
    const senderId = req.user._id;
    let imageUrl = "";
    let audioUrl = "";

    console.log("sendMessage - Endpoint:", req.path);
    console.log("sendMessage - Request Headers:", req.headers);
    console.log("sendMessage - Request Body:", req.body);
    console.log(
      "sendMessage - Request File:",
      req.file ? { ...req.file, buffer: "omitted" } : "undefined"
    );

    // Validate ObjectIds
    if (
      !mongoose.Types.ObjectId.isValid(senderId) ||
      !mongoose.Types.ObjectId.isValid(receiverId)
    ) {
      return res
        .status(400)
        .json({ message: "Invalid senderId or receiverId" });
    }

    // Check if sender has blocked receiver
    const sender = await User.findById(senderId);
    if (!sender) {
      return res.status(404).json({ message: "Sender not found" });
    }
    if (sender.blockedUsers && sender.blockedUsers.includes(receiverId)) {
      return res.status(403).json({ message: "Cannot send message to a blocked user" });
    }

    // Check if receiver has blocked sender (optional, depending on requirements)
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: "Receiver not found" });
    }
    if (receiver.blockedUsers && receiver.blockedUsers.includes(senderId)) {
      return res.status(403).json({ message: "Cannot send message; you are blocked by the recipient" });
    }

    // Handle file upload (audio or image workaround)
    if (req.file) {
      console.log("Uploading audio to Cloudinary...", {
        fileSize: req.file.size,
        mimetype: req.file.mimetype,
      });
      const uploadResponse = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { resource_type: "auto", folder: "chat_audio" },
          (error, result) => {
            if (error) {
              console.error("Cloudinary Upload Error:", error.message, error);
              reject(error);
            } else {
              console.log("Cloudinary Upload Success:", result.secure_url);
              resolve(result);
            }
          }
        );
        stream.on("error", (err) => {
          console.error("Stream Error:", err.message);
          reject(err);
        });
        if (req.file.buffer && req.file.buffer.length > 0) {
          stream.write(req.file.buffer);
          stream.end();
        } else {
          reject(new Error("Empty file buffer"));
        }
      });
      audioUrl = uploadResponse.secure_url;
    } else if (!text) {
      return res
        .status(400)
        .json({ message: "Message must contain text or audio" });
    }

    const newMessage = new Message({
      senderId,
      receiverId,
      text: text || "",
      image: imageUrl,
      audio: audioUrl || undefined,
    });

    console.log("Saving new message:", newMessage.toObject());
    const savedMessage = await newMessage.save();
    console.log("Message saved successfully:", savedMessage._id);

    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      console.log("Emitting to receiver:", receiverSocketId);
      io.to(receiverSocketId).emit("newMessage", savedMessage);
    }
    const senderSocketId = getReceiverSocketId(senderId);
    if (senderSocketId) {
      console.log("Emitting to sender:", senderSocketId);
      io.to(senderSocketId).emit("newMessage", savedMessage);
    }

    res.status(201).json(savedMessage);
  } catch (error) {
    console.error("Error in sendMessage:", error.message, error.stack);
    res
      .status(500)
      .json({ message: "Failed to send message", error: error.message });
  }
};
