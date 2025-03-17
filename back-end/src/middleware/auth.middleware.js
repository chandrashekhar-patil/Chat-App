// src/middleware/auth.middleware.js
import jwt from "jsonwebtoken";
import User from "../models/users.model.js";

export const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.jwt;
    console.log("protectRoute - Cookies received:", req.cookies);
    console.log("protectRoute - Token:", token || "undefined");
    if (!token) {
      console.log("protectRoute - No token provided");
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("protectRoute - Error:", error.message);
    res.status(401).json({ message: "Unauthorized: Invalid token" });
  }
};