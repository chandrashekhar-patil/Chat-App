import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // This creates the index implicitly
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    profilePic: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "admin"],   // Admin aur user roles
      default: "user",           // Default role is "user"
    },
    blockedUsers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    settings: {
      theme: {
        type: String,
        default: "light",
        enum: ["light", "dark", "coffee", "forest", "autumn"],
      },
      fontSize: {
        type: String,
        default: "medium",
        enum: ["small", "medium", "large"],
      },
      notificationsEnabled: {
        type: Boolean,
        default: true,
      },
      messagePreviews: {
        type: Boolean,
        default: true,
      },
    },
    resetToken: {
      type: String,
    },
    tokenExpiry: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Removed: userSchema.index({ email: 1 }); // Not needed due to unique: true

export default mongoose.model("User", userSchema);