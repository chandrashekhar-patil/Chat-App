import { config } from "dotenv";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import chatRoutes from "./routes/chat.route.js";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import { app, server } from "./lib/socket.js";
import groupChatRoutes from "./routes/groupChat.route.js";
import passwordRoutes from "./routes/password.route.js";
import aiRoutes from "./routes/ai.route.js";
import { protectRoute } from "./middleware/auth.middleware.js";

config({ path: ".env" });

const corsOptions = {
  origin: "https://textspin-chandu.vercel.app",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"]
};

app.use(cors(corsOptions));
app.options('https://textspin-chandu.vercel.app', cors(corsOptions));

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
app.use("/uploads/audio", express.static("uploads/audio"));

// Routes
app.use("/api/auth", authRoutes); // Handles /api/auth/signup, /api/auth/login, etc.
app.use("/api/password", passwordRoutes);
app.use("/api/messages", protectRoute, messageRoutes);
app.use("/api", protectRoute, chatRoutes);
app.use("/api/group-chats", protectRoute, groupChatRoutes);
app.use("/api/users", authRoutes); // Add this line to handle /api/users/update-profile
app.use("/api/ai", protectRoute, aiRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  connectDB();
}); 
