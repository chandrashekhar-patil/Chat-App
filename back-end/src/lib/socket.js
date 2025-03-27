import { Server } from "socket.io";
import mongoose from "mongoose";
import http from "http";
import express from "express";

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://textspin-chandu.vercel.app"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const userSocketMap = {};

const getReceiverSocketId = (receiverId) => {
  const socketId = userSocketMap[receiverId];
  if (!socketId) {
    console.log(`No socket found for user ${receiverId}`);
  }
  return socketId;
};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);
  const userId = socket.handshake.query.userId;

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    if (userSocketMap[userId]) {
      console.log(
        `User ${userId} already connected, disconnecting old socket: ${userSocketMap[userId]}`
      );
      io.sockets.sockets.get(userSocketMap[userId])?.disconnect();
    }
    userSocketMap[userId] = socket.id;
    console.log(`Updated userSocketMap:`, userSocketMap);
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
    io.emit("userOnline", userId); // Emit userOnline event
  } else {
    console.log("Invalid userId received during socket connection:", userId);
  }

  // Typing event
  socket.on("typing", (data) => {
    const { userId, receiverId, typing } = data;
    const receiverSocketId = getReceiverSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", { userId, typing });
    }
  });

  // Call events
  socket.on("call", ({ from, to, channel }) => {
    const receiverSocketId = getReceiverSocketId(to);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("incoming_call", { from, channel });
      socket.emit("call_initiated", { to });
      io.to(receiverSocketId).emit("notification", {
        type: "call",
        message: `Incoming call from ${from}`,
        from,
        timestamp: new Date(),
      });
    } else {
      socket.emit("call_error", { message: "User not found or offline" });
    }
  });

  socket.on("accept_call", ({ from, to, channel }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_accepted", { from, channel });
      io.to(callerSocketId).emit("notification", {
        type: "call_accepted",
        message: `${from} accepted your call`,
        from,
        timestamp: new Date(),
      });
    }
  });

  socket.on("reject_call", ({ from, to }) => {
    const callerSocketId = getReceiverSocketId(to);
    if (callerSocketId) {
      io.to(callerSocketId).emit("call_rejected", { from });
      io.to(callerSocketId).emit("notification", {
        type: "call_rejected",
        message: `${from} rejected your call`,
        from,
        timestamp: new Date(),
      });
    }
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    for (const [key, value] of Object.entries(userSocketMap)) {
      if (value === socket.id) {
        delete userSocketMap[key];
        console.log(`Removed user ${key} from userSocketMap:`, userSocketMap);
        io.emit("getOnlineUsers", Object.keys(userSocketMap));
        io.emit("userOffline", key); // Emit userOffline event
        break;
      }
    }
  });
});

export { app, server, io, getReceiverSocketId, userSocketMap };
