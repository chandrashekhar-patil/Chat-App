import mongoose from "mongoose";

// Cache the database connection
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    cached.promise = mongoose.connect(process.env.MONGODB_URL, opts)
      .then((mongoose) => {
        console.log(`MongoDB Connected: ${mongoose.connection.host}`);
        return mongoose;
      })
      .catch((err) => {
        console.error(`MongoDB Connection Error: ${err.message}`);
        cached.promise = null;
        throw err;
      });
  }
  
  cached.conn = await cached.promise;
  return cached.conn;
};
