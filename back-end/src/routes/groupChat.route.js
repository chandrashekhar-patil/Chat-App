// src/routes/groupChat.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  createGroupChat,
  getGroupChats,
  updateGroupChat,
  leaveGroupChat,
  deleteGroupChat,
  clearGroupChat,
} from "../controllers/groupChat.controller.js";
const router = express.Router();

router.post("/", protectRoute, createGroupChat);
router.get("/", protectRoute, getGroupChats);
router.put("/:id", protectRoute, updateGroupChat);
router.delete("/:groupId/leave", protectRoute, leaveGroupChat);
router.delete("/:id", protectRoute, deleteGroupChat);
router.post("/:id/clear", protectRoute, clearGroupChat);

export default router;
