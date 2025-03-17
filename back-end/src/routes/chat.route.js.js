import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import User from "../models/users.model.js";
import Message from "../models/message.model.js";

import { io, getReceiverSocketId } from "../lib/socket.js"; // Import directly

const router = express.Router();

// Apply protectRoute middleware to all routes
router.use(protectRoute);

// Clear Chat: Delete all messages between the authenticated user and the specified user
router.post("/clear-chat/:userId", async (req, res) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized: User not authenticated" });
    }

    const userIdToClear = req.params.userId;
    const authenticatedUserId = req.user._id;

    // Validate userIdToClear
    if (!userIdToClear.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Delete all messages between the two users
    await Message.deleteMany({
      $or: [
        { senderId: authenticatedUserId, receiverId: userIdToClear },
        { senderId: userIdToClear, receiverId: authenticatedUserId },
      ],
    });

    // Emit socket event to both users to update their chat UI
    console.log("Using getReceiverSocketId:", getReceiverSocketId);

    const senderSocketId = getReceiverSocketId(authenticatedUserId.toString());
    const receiverSocketId = getReceiverSocketId(userIdToClear);

    if (senderSocketId) {
      io.to(senderSocketId).emit("chatCleared", { userId: userIdToClear });
    } else {
      console.warn(`Sender socket ID not found for user: ${authenticatedUserId}`);
    }

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("chatCleared", { userId: authenticatedUserId.toString() });
    } else {
      console.warn(`Receiver socket ID not found for user: ${userIdToClear}`);
    }

    res.status(200).json({ message: "Chat cleared successfully" });
  } catch (error) {
    console.error("Error in clear-chat:", error);
    res.status(500).json({ message: "Failed to clear chat", error: error.message });
  }
});

// Other routes (block, unblock, blocked-users)
router.get("/blocked-users", async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("blockedUsers");
    res.json({ blockedUsers: user.blockedUsers || [] });
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch blocked users" });
  }
});

router.post("/block/:userId", async (req, res) => {
  try {
    const userIdToBlock = req.params.userId;
    if (userIdToBlock === req.user._id.toString()) {
      return res.status(400).json({ message: "Cannot block yourself" });
    }
    const user = await User.findById(req.user._id);
    if (!user.blockedUsers.includes(userIdToBlock)) {
      user.blockedUsers.push(userIdToBlock);
      await user.save();
    }
    res.json({ message: "User blocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to block user" });
  }
});

router.post("/unblock/:userId", async (req, res) => {
  try {
    const userIdToUnblock = req.params.userId;
    const user = await User.findById(req.user._id);
    user.blockedUsers = user.blockedUsers.filter((id) => id.toString() !== userIdToUnblock);
    await user.save();
    res.json({ message: "User unblocked successfully" });
  } catch (error) {
    res.status(500).json({ message: "Failed to unblock user" });
  }
});

export default router;
