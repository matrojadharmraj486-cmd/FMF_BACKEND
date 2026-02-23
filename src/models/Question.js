import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
  year: { type: Number, required: true },
  part: { type: String, enum: ["Part 1", "Part 2"], required: true },
  question: { type: String, required: true },
  answerType: { type: String, enum: ["text", "image"], required: true },
  answerText: { type: String },
  answerImage: { type: String }
}, { timestamps: true });

export default mongoose.model("Question", questionSchema);

