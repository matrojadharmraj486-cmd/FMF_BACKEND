import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    photoUrl: { type: String, required: true },
    name: { type: String, required: true },
    designation: { type: String, required: true },
    location: { type: String, required: true },
    review: { type: String, required: true }
  },
  { timestamps: true }
);

export default mongoose.model("Testimonial", testimonialSchema);
