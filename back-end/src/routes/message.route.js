// back-end/src/routes/message.route.js
import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
  getUsersForSidebar,
  getMessages,
  sendGroupMessage,
  sendMessage,
} from "../controllers/message.controller.js";
import upload from "../middleware/upload.middleware.js";

const router = express.Router();

router.get("/users", protectRoute, getUsersForSidebar);
router.get("/:id", protectRoute, getMessages);
router.post("/send/:id", protectRoute, sendMessage); // For text messages
router.post("/:id/audio", protectRoute, upload.single("audio"), sendMessage); // For audio messages
router.post("/:id/image", protectRoute, upload.single("image"), sendMessage); // For image messages
router.post(
  "/group/:chatId",
  protectRoute,
  upload.single("file"),
  sendGroupMessage
);

export default router;
