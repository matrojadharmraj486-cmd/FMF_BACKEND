import mongoose from "mongoose";

const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    seq: { type: Number, required: true }
  },
  { versionKey: false }
);

export default mongoose.model("Counter", counterSchema);
