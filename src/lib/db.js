import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    console.log("MongoDB URL:", process.env.MONGODB_URL); 

    if (!process.env.MONGODB_URL) {
      throw new Error("MONGODB_URL is not defined!");
    }

    const conn = await mongoose.connect(process.env.MONGODB_URL);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error("MongoDB Connection Error:", error);
    process.exit(1);
  }
};
