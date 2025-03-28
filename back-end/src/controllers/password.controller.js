import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import User from "../models/users.model.js";

const createTransporter = () =>
  nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log("Received password reset request for email:", email);

  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(400).json({ error: "Invalid email format" });
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(200).json({ message: "If this email exists, a reset link has been sent." });
    }

    const token = crypto.randomBytes(32).toString("hex");
    const resetToken = jwt.sign({ token }, process.env.JWT_SECRET, { expiresIn: "1h" });
    console.log("Generated reset token:", resetToken);

    user.resetToken = resetToken;
    user.tokenExpiry = Date.now() + 3600000;
    await user.save();

    // Reset link matches frontend route
    const resetLink = `${process.env.APP_URL || "https://textspin-chandu.vercel.app"}/reset?token=${resetToken}`;

    try {
      const transporter = createTransporter();
      await transporter.sendMail({
        from: `"Chandrashekhar" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Password Reset Link",
        html: `
          <p>Hello,</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetLink}" style="background: #4CAF50; color: white; padding: 10px 20px; text-decoration: none; display: inline-block;">Reset Password</a>
          <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
          <p>Thanks,<br>TextSpin Team</p>
        `,
        text: `Click this link to reset your password: ${resetLink}`,
      });
    } catch (error) {
      console.error("Error sending reset email:", error);
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    return res.status(200).json({ message: "If this email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  console.log("Reset request received for token:", token);

  if (!token || !new_password || new_password.length < 8) {
    return res.status(400).json({ error: "Invalid token or password (min 8 characters)" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findOne({
      resetToken: token,
      tokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    user.password = await bcrypt.hash(new_password, 12);
    user.resetToken = null;
    user.tokenExpiry = null;
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error processing password reset:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
