import { config } from "dotenv";
import { connectDB } from "./lib/db.js";
import authRoutes from "./routes/auth.route.js";
import messageRoutes from "./routes/message.route.js";
import chatRoutes from "./routes/chat.route.js.js"
import cookieParser from "cookie-parser";
import express from "express";
import cors from "cors";
import { app, server, io } from "./lib/socket.js"; // Assuming io is exported

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

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api", chatRoutes);

// Socket.IO Signaling for Calls
const users = new Map(); // userId -> Socket.IO socket

io.on("connection", (socket) => {
  socket.on("register", (userId) => {
    users.set(userId, socket);
    socket.userId = userId;
    console.log(`User ${userId} registered`);
  });

  socket.on("call", ({ from, to, channel }) => {
    const recipient = users.get(to);
    if (recipient) {
      recipient.emit("incoming_call", { from, channel });
      socket.emit("call_initiated");
    } else {
      socket.emit("error", { message: "User not found or offline" });
    }
  });

  socket.on("accept", ({ from, to, channel }) => {
    const caller = users.get(to);
    if (caller) {
      caller.emit("call_accepted", { from, channel });
    }
  });

  socket.on("reject", ({ from, to }) => {
    const caller = users.get(to);
    if (caller) {
      caller.emit("call_rejected", { from });
    }
  });

  socket.on("disconnect", () => {
    if (socket.userId) {
      users.delete(socket.userId);
      console.log(`User ${socket.userId} disconnected`);
    }
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  connectDB();
});