import mongoose from "mongoose";

const faqSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    order: { type: Number }
  },
  { timestamps: true }
);

export default mongoose.model("Faq", faqSchema);

