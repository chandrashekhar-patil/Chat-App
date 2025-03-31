import { generateToken } from "../lib/token.js";
import User from "../models/users.model.js";
import bcrypt from "bcrypt";
import NodeCache from "node-cache";
const tokenCache = new NodeCache();
import cloudinary from "../lib/cloudinary.js";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password || !emailRegex.test(email)) {
    return res.status(400).json({ message: "Valid email and password are required" });
  }

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user._id, res);
    console.log(`User ${user._id} logged in`);
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Login error:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const signup = async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password || !emailRegex.test(email)) {
    return res.status(400).json({ message: "All fields are required and email must be valid" });
  }

  try {
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
    });

    const token = generateToken(user._id, res);
    console.log(`User ${user._id} signed up`);
    res.status(201).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Signup error:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const logout = (req, res) => {
  const token = req.cookies.jwt;

  if (token) {
    tokenCache.set(token, true, 60 * 60);  // Invalidate token for 1 hour
  }

  // 🛠️ Properly clear the JWT cookie
  res.cookie("jwt", "", {
    httpOnly: true,                          // Protect against XSS attacks
    secure: process.env.NODE_ENV === "production",  // Use secure cookie in production (HTTPS)
    sameSite: "None",                        // Allow cross-origin cookie clearing
    expires: new Date(0),                    // Expire the cookie immediately
    path: "/",                               // Clear cookie from all paths
  });

  res.status(200).json({ message: "Logged out successfully" });
};


export const updateProfile = async (req, res) => {
  const { profilePic } = req.body;
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (!profilePic) {
    return res.status(400).json({ message: "Profile picture is required" });
  }

  try {
    const uploadResponse = await cloudinary.uploader.upload(profilePic, {
      folder: "profile_pics",
    });
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { profilePic: uploadResponse.secure_url },
      { new: true, select: "-password" }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(updatedUser);
  } catch (error) {
    console.error("Update profile error:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const checkAuth = (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.status(200).json({
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      profilePic: user.profilePic,
    });
  } catch (error) {
    console.error("Check auth error:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

export const deleteAccount = async (req, res) => {
  const userId = req.user?._id;

  if (!userId) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await Message.deleteMany({
      $or: [{ senderId: userId }, { receiverId: userId }],
    });

    res.cookie("jwt", "", { maxAge: 0 });
    const socketId = getReceiverSocketId(userId.toString());
    if (socketId) {
      io.to(socketId).emit("accountDeleted", { userId });
    }

    console.log(`User ${userId} deleted their account`);
    res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error.stack);
    res.status(500).json({ message: "Internal Server Error" });
  }
};
//
