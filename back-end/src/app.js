import { config } from "dotenv";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import chatRoutes from "./routes/chat.route.js";
import cookieParser from "cookie-parser";
import express from "express";
import { app, server } from "./lib/socket.js";
import groupChatRoutes from "./routes/groupChat.route.js";
import passwordRoutes from "./routes/password.route.js";
import aiRoutes from "./routes/ai.route.js";
import { protectRoute } from "./middleware/auth.middleware.js";

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "https://textspin-chandu.vercel.app");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

config({ path: ".env" });
console.log("JWT_SECRET:", process.env.JWT_SECRET);

app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));
app.use(cookieParser());

app.use("/uploads/audio", express.static("uploads/audio"));

// Public routes (no authentication required)
app.use("/api/auth", authRoutes);
app.use("/api/password", passwordRoutes);

// Protected routes (apply protectRoute middleware)
app.use("/api/messages", protectRoute, messageRoutes);
app.use("/api", protectRoute, chatRoutes);
app.use("/api/group-chats", protectRoute, groupChatRoutes);
app.use("/api/users", protectRoute);
app.use("/api/ai", protectRoute, aiRoutes);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  connectDB();
});
