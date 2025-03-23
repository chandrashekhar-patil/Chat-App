// src/controllers/group.controller.js
import Chat from "../models/chat.model.js";
import Message from "../models/message.model.js";
import { io, getReceiverSocketId } from "../lib/socket.js";

export const createGroupChat = async (req, res) => {
  const { name, description, members } = req.body;
  const creatorId = req.user._id;

  try {
    const newGroup = new Chat({
      name,
      description,
      isGroupChat: true,
      members: [...new Set([creatorId, ...members])],
      creator: creatorId,
    });
    const savedGroup = await newGroup.save();
    res.status(201).json(savedGroup);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to create group", error: error.message });
  }
};

export const getGroupChats = async (req, res) => {
  try {
    const myId = req.user._id;
    const populate = req.query.populate === "members";
    const query = { isGroupChat: true, members: myId };
    const groups = populate
      ? await Chat.find(query).populate("members", "fullName email profilePic")
      : await Chat.find(query);
    res.status(200).json(groups);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to fetch groups", error: error.message });
  }
};

export const updateGroupChat = async (req, res) => {
  const { id } = req.params;
  const { name, description, members } = req.body;
  const myId = req.user._id;

  try {
    const group = await Chat.findById(id);
    if (!group || !group.isGroupChat) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.creator.toString() !== myId) {
      return res
        .status(403)
        .json({ message: "Only the creator can update the group" });
    }

    group.name = name || group.name;
    group.description = description || group.description;
    if (members) group.members = [...new Set(members)];
    const updatedGroup = await group.save();

    updatedGroup.members.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId.toString());
      if (socketId) io.to(socketId).emit("groupUpdated", updatedGroup);
    });

    res.status(200).json(updatedGroup);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to update group", error: error.message });
  }
};
export const leaveGroupChat = async (req, res) => {
  const userId = req.user?._id; // From auth middleware
  const { groupId } = req.params;

  console.log("leaveGroupChat - Request:", { userId, groupId });

  if (!userId || !groupId) {
    return res.status(400).json({ message: "Missing userId or groupId" });
  }

  try {
    const chat = await Chat.findById(groupId);
    console.log("leaveGroupChat - Chat found:", chat ? chat : "Not found");

    if (!chat || !chat.isGroupChat) {
      return res.status(404).json({ message: "Group chat not found" });
    }

    if (!chat.members.some((m) => m.toString() === userId.toString())) {
      return res
        .status(400)
        .json({ message: "You are not a member of this group" });
    }

    // Remove user from members
    chat.members = chat.members.filter(
      (memberId) => memberId.toString() !== userId.toString()
    );
    console.log("leaveGroupChat - Updated members:", chat.members);

    if (chat.members.length === 0) {
      await Chat.deleteOne({ _id: groupId });
      console.log("leaveGroupChat - Group deleted:", groupId);
      io.emit("groupDeleted", groupId);
    } else {
      await chat.save();
      console.log("leaveGroupChat - Group saved:", chat);

      // This is where the error occurs - connectedUsers is not defined
      // Replace this with getReceiverSocketId which is imported at the top
      chat.members.forEach((memberId) => {
        const socketId = getReceiverSocketId(memberId.toString());
        if (socketId) {
          io.to(socketId).emit("userRemovedFromChat", { chatId: groupId, userId });
          console.log(`leaveGroupChat - Emitted to ${memberId}:`, { chatId: groupId, userId });
        } else {
          console.log(`leaveGroupChat - No socket for member ${memberId}`);
        }
      });
    }

    res.status(200).json({ message: "Left group successfully" });
  } catch (error) {
    console.error("leaveGroupChat - Error:", {
      message: error.message,
      stack: error.stack,
      groupId,
      userId,
    });
    res
      .status(500)
      .json({ message: "Failed to leave group", error: error.message });
  }
};

export const deleteGroupChat = async (req, res) => {
  const { id } = req.params;
  const myId = req.user._id;

  try {
    const group = await Chat.findById(id);
    if (!group || !group.isGroupChat) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (group.creator.toString() !== myId) {
      return res
        .status(403)
        .json({ message: "Only the creator can delete the group" });
    }

    await Chat.deleteOne({ _id: id });
    await Message.deleteMany({ chatId: id });

    group.members.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId.toString());
      if (socketId) io.to(socketId).emit("groupDeleted", id);
    });

    res.status(200).json({ message: "Group deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to delete group", error: error.message });
  }
};

export const clearGroupChat = async (req, res) => {
  const { id } = req.params;
  const myId = req.user._id;

  try {
    const group = await Chat.findById(id);
    if (!group || !group.isGroupChat) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.members.includes(myId)) {
      return res
        .status(403)
        .json({ message: "You are not a member of this group" });
    }

    await Message.deleteMany({ chatId: id });
    group.members.forEach((memberId) => {
      const socketId = getReceiverSocketId(memberId.toString());
      if (socketId) io.to(socketId).emit("chatCleared", { userId: id });
    });

    res.status(200).json({ message: "Group chat cleared" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Failed to clear group chat", error: error.message });
  }
};
