import mongoose from "mongoose";

const bookmarkSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  questions: [
    {
      type: mongoose.Schema.Types.Mixed,
      required: true
    }
  ]

}, { timestamps: true });

export default mongoose.model("Bookmark", bookmarkSchema);
