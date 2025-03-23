// back-end/src/controllers/password.controller.js
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/users.model.js";

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  console.log("Received password reset request for email:", email);

  try {
    const user = await User.findOne({ email });

    // Always return the same response to avoid revealing existing emails
    if (!user) {
      return res
        .status(200)
        .json({ message: "If this email exists, a reset link has been sent." });
    }

    // Generate a secure token
    const token = crypto.randomBytes(32).toString("hex");
    console.log("Generated reset token:", token);

    // Set token and expiry
    user.resetToken = token;
    user.tokenExpiry = Date.now() + 3600000; // 1 hour expiry
    await user.save();

    // Use configurable APP_URL from environment variables
    const resetLink = `${process.env.APP_URL}/reset?token=${token}`;

    try {
      await sendResetEmail(email, resetLink);
    } catch (error) {
      console.error("Error sending reset email:", error);
      return res.status(500).json({ error: "Failed to send reset email" });
    }

    return res
      .status(200)
      .json({ message: "If this email exists, a reset link has been sent." });
  } catch (error) {
    console.error("Error processing forgot password request:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  const { token, new_password } = req.body;
  console.log("Reset request received for token:", token);

  try {
    // Find user with valid token and non-expired expiry
    const user = await User.findOne({
      resetToken: token,
      tokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Hash the new password
    user.password = await bcrypt.hash(new_password, 12);
    user.resetToken = null; // Invalidate token
    user.tokenExpiry = null; // Clear expiry
    await user.save();

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Error processing password reset:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

// Send Reset Email Function
async function sendResetEmail(email, resetLink) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  console.log("Sending reset email to:", email);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: email,
    subject: "Password Reset Link",
    html: `
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">${resetLink}</a>
      <p>This link will expire in 1 hour. If you did not request this, please ignore this email.</p>
    `,
  };

  await transporter.sendMail(mailOptions);
}