import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/users.model.js";
import Message from "../models/message.model.js";

import { io, getReceiverSocketId } from "../lib/socket.js"; // Import directly

const router = express.Router();

// Apply protectRoute middleware to all routes
router.use(protectRoute);
router.get("/blocked-users", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "blockedUsers",
      "fullName profilePic"
    );
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.status(200).json(user.blockedUsers);
  } catch (error) {
    console.error("Error fetching blocked users:", error);
    res.status(500).json({ message: "Failed to fetch blocked users" });
  }
});

router.post("/block/:userId", async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;
    const authenticatedUserId = req.user._id;

    if (!userIdToBlock.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(authenticatedUserId);
    const userToBlock = await User.findById(userIdToBlock);

    if (!user || !userToBlock) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.blockedUsers.includes(userIdToBlock)) {
      return res.status(400).json({ message: "User already blocked" });
    }

    user.blockedUsers.push(userIdToBlock);
    await user.save();

    res.status(200).json({ message: "User blocked successfully" });
  } catch (error) {
    console.error("Error blocking user:", error);
    res.status(500).json({ message: "Failed to block user" });
  }
});

router.post("/unblock/:userId", async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;
    const authenticatedUserId = req.user._id;

    if (!userIdToUnblock.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    const user = await User.findById(authenticatedUserId);
    const userToUnblock = await User.findById(userIdToUnblock);

    if (!user || !userToUnblock) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!user.blockedUsers.includes(userIdToUnblock)) {
      return res.status(400).json({ message: "User is not blocked" });
    }

    user.blockedUsers = user.blockedUsers.filter(
      (id) => id.toString() !== userIdToUnblock
    );
    await user.save();

    res.status(200).json({ message: "User unblocked successfully" });
  } catch (error) {
    console.error("Error unblocking user:", error);
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

router.post("/clear-chat/:userId", async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: User not authenticated" });
    }

    const userIdToClear = req.params.userId;
    const authenticatedUserId = req.user._id;

    if (!userIdToClear.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    await Message.deleteMany({
      $or: [
        { senderId: authenticatedUserId, receiverId: userIdToClear },
        { senderId: userIdToClear, receiverId: authenticatedUserId },
      ],
    });

    const senderSocketId = getReceiverSocketId(authenticatedUserId.toString());
    const receiverSocketId = getReceiverSocketId(userIdToClear);

    if (senderSocketId) {
      io.to(senderSocketId).emit("chatCleared", { userId: userIdToClear });
    }
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatCleared", { userId: authenticatedUserId.toString() });
    }

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Error in clear-chat:", error);
    res.status(500).json({ message: "Failed to clear chat", error: error.message });
  }
});

export default router;