import mongoose from "mongoose";

const subQuestionSchema = new mongoose.Schema({
  part: { type: String, required: true }, // e.g., "a", "b", "c"
  text: { type: String, required: true },
  answerType: { type: String, enum: ["text", "image"], default: "text" },
  answer: [{ type: String }], // for text answers (multiple points)
  answerImage: { type: String } // for image answers
}, { _id: true, timestamps: false });

const structuredQuestionSchema = new mongoose.Schema({
  id: { type: String }, // optional external identifier
  year: { type: Number, required: true },
  part: { type: String, enum: ["Part 1", "Part 2"], required: true },
  question_text: { type: String, required: true },
  isDirect: { type: Boolean, default: false },
  sub_questions: [subQuestionSchema],
  QOTD: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("StructuredQuestion", structuredQuestionSchema);
