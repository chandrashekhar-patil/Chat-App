import express from "express";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.route.js";
import { connectDB } from "./lib/db.js";
import cookieParser from "cookie-parser";
import messageRoutes from "./routes/message.route.js";
import cors from "cors";
import { app, server } from "./lib/socket.js";

import path from "path";

dotenv.config();
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);
const PORT = process.env.PORT || 3000;

const __dirname = path.resolve();

app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);


if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../front-end/dist")));

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../front-end", "dist", "index.html"));
  });
}

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:` + PORT);
  connectDB();
});
