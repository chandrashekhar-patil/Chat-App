import mongoose from "mongoose";

const chatSchema = new mongoose.Schema({
  name: { type: String },
  description: { type: String },
  isGroupChat: { type: Boolean, default: false },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

chatSchema.index({ members: 1 });
chatSchema.index({ isGroupChat: 1, creator: 1 });

export default mongoose.model("Chat", chatSchema);