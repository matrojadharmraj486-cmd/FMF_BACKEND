import mongoose from "mongoose";

const qotdSchema = new mongoose.Schema({
  question: { type: String, required: true },
  answerType: { type: String, enum: ["text", "image"], required: true },
  answerText: { type: String },
  answerImage: { type: String },
  isActive: { type: Boolean, default: true },
  date: { type: String }
}, { timestamps: true });

export default mongoose.model("Qotd", qotdSchema);
