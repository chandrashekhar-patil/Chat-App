import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: "1h" });
  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Secure only in production (HTTPS)
    sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax", // Lax for local dev
    maxAge: 60 * 60 * 1000, // 1 hour
  });
  return token;
};
