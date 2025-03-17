// src/lib/token.js
import jwt from "jsonwebtoken"; // Ensure this import is present

export const generateToken = (id, res) => {
  const token = jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // false in dev
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax", // lax in dev for local testing
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  return token;
};