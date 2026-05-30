import mongoose from "mongoose";

const opinionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    opinion: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true
    },
    mobileNumber: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

export default mongoose.model("Opinion", opinionSchema);
