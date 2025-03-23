// back-end/src/app.js
import { config } from "dotenv";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import chatRoutes from "./routes/chat.route.js";
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import { app, server, io } from "./lib/socket.js";
import groupChatRoutes from "./routes/groupChat.route.js";
// import userRoutes from "./routes/user.route.js";
import passwordRoutes from "./routes/password.route.js";
import aiRoutes from "./routes/ai.route.js";
import { protectRoute } from "./middleware/auth.middleware.js";

config({ path: ".env" });
console.log("JWT_SECRET:", process.env.JWT_SECRET);

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "http://192.168.1.64:5173"],
    credentials: true,
  })
);

app.use("/uploads/audio", express.static("uploads/audio"));

// Public routes (no authentication required)
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);

// Protected routes (apply protectRoute middleware)
app.use("/api/messages", protectRoute, messageRoutes);
app.use("/api", protectRoute, chatRoutes);
app.use("/api/group-chats", protectRoute, groupChatRoutes);
app.use("/api/users", protectRoute);
app.use("/api/ai", protectRoute, aiRoutes); // Add the AI route

const connectedUsers = new Map(); // userId -> socketId for chat events

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    connectedUsers.set(userId, socket.id);
    console.log(`User ${userId} connected with socket ${socket.id}`);
    // Emit updated online users to all clients
    io.emit("online-users", Array.from(connectedUsers.keys()));
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  connectDB();
});

export { connectedUsers };
