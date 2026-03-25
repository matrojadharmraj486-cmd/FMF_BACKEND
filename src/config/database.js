import mongoose from "mongoose";
import { logger } from "../utils/logger.js";

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info("MongoDB connected");
  } catch (err) {
    logger.error("MongoDB connection failed", {
      error: err.message,
      stack: err.stack
    });
    process.exit(1);
  }
};

export default connectDB;
