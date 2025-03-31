import jwt from "jsonwebtoken";

export const generateToken = (userId, res) => {
  const token = jwt.sign(
    { id: userId },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }  // 1 hour expiry
  );

  res.cookie("jwt", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", 
    sameSite: "Strict",  // Use 'Strict' for security (XSS protection)
    maxAge: 60 * 60 * 1000,  // 1 hour in milliseconds
  });

  return token;
};
