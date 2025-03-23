import jwt from "jsonwebtoken";
import mongoose from 'mongoose';

export const generateToken = (id, res) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new Error("Invalid user ID for token generation");
  }

  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    maxAge: 60 * 60 * 1000,
  });
  return token;
};