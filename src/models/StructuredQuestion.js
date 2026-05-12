import mongoose from "mongoose";

const answerBlockSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["text", "image"], required: true },
    text: { type: String },
    url: { type: String },
    alt: { type: String }
  },
  { _id: false }
);

const subQuestionSchema = new mongoose.Schema({
  part: { type: String, required: true }, // e.g., "a", "b", "c"
  text: { type: String, required: true },
  answerType: { type: String, enum: ["text", "image", "rich"], default: "text" },
  answer: [{ type: String }], // for text answers (multiple points)
  answerImage: { type: String }, // for image answers
  answerBlocks: [answerBlockSchema] // for rich answers (mixed text/image)
}, { _id: true, timestamps: false });

const structuredQuestionSchema = new mongoose.Schema({
  id: { type: String }, // optional external identifier
  year: { type: Number, required: true },
  part: { type: String, enum: ["Part 1", "Part 2"], required: true },
  paper: { type: String }, // e.g., "Paper 1"
  question_text: { type: String, required: true },
  isDirect: { type: Boolean, default: false },
  main_question_answer: [{ type: String }],
  main_answer_blocks: [answerBlockSchema],
  sub_questions: [subQuestionSchema],
  QOTD: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("StructuredQuestion", structuredQuestionSchema);
