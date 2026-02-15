import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({

  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  name: {
    type: String,
    required: true
  },

  questions: [
    {
      id: String,
      question_text: String,
      sub_questions: Array
    }
  ]

}, { timestamps: true });

export default mongoose.model("Bookmark", bookmarkSchema);
