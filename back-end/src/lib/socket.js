import { Server } from "socket.io";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://192.168.1.64:5173"],
    credentials: true,
  },
});

const userSocketMap = {}; // userId -> socketId

// Utility to get socket ID by user ID
const getReceiverSocketId = (receiverId) => {
  const socketId = userSocketMap[receiverId];
  console.log(`getReceiverSocketId(${receiverId}) -> ${socketId || "undefined"}`);
  return socketId;
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Register user ID from query
  const userId = socket.handshake.query.userId;
  if (userId && userId !== "undefined" && userId.match(/^[0-9a-fA-F]{24}$/)) {
    userSocketMap[userId] = socket.id;
    console.log(`Mapped user ${userId} to socket ${socket.id}`);
    console.log("Current userSocketMap:", userSocketMap);
  } else {
    console.warn("Invalid or missing userId:", userId);
  }

  // Emit online users to all connected clients
  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // Call Signaling Events (unchanged)
  socket.on("call", ({ from, to, channel }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming_call", { from, channel });
      socket.emit("call_initiated", { to });
      console.log(`Call initiated from ${from} to ${to} on channel ${channel}`);
    } else {
      socket.emit("call_error", { message: "User not found or offline" });
      console.log(`Call failed: User ${to} not found`);
    }
  });

  socket.on("accept_call", ({ from, to, channel }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", { from, channel });
      console.log(`Call accepted by ${from} for ${to}`);
    }
  });

  socket.on("reject_call", ({ from, to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_rejected", { from });
      console.log(`Call rejected by ${from} for ${to}`);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const [key, value] of Object.entries(userSocketMap)) {
      if (value === socket.id) {
        delete userSocketMap[key];
        console.log(`Removed user ${key} from userSocketMap`);
        break;
      }
    }
    console.log("Updated userSocketMap:", userSocketMap);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

export { app, server, io, getReceiverSocketId };