import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import os from "os";

import authRoutes from "./routes/authRoutes.js";
import stateRoutes from "./routes/state.route.js";
import questionRoutes from "./routes/question.routes.js";
import userRoutes from "./routes/user.routes.js";
import bookmarkRoutes from "./routes/bookmark.routes.js"
import adminQuestionRoutes from "./routes/admin.question.routes.js";
import adminUserRoutes from "./routes/admin.user.routes.js";
import adminBannerRoutes from "./routes/admin.banner.routes.js";
import qotdRoutes from "./routes/qotd.routes.js";
import adminAuthRoutes from "./routes/admin.auth.routes.js";
import bannersRoutes from "./routes/banners.routes.js";
import adminStructuredRoutes from "./routes/admin.structured.routes.js";
import adminTestimonialRoutes from "./routes/admin.testimonial.routes.js";
import testimonialRoutes from "./routes/testimonial.routes.js";
import homeRoutes from "./routes/home.routes.js";
import opinionRoutes from "./routes/opinion.routes.js";


const app = express();
const uploadsPath = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(os.tmpdir(), "fmf-uploads");

app.set("trust proxy", 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const allowedOrigins = [
  "https://fmf-admin.onrender.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use("/api/auth", authRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api", questionRoutes);
app.use("/api", qotdRoutes);
app.use("/api", bannersRoutes);
app.use("/api", testimonialRoutes);
app.use("/api", homeRoutes);
app.use("/api", opinionRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/api/admin", adminQuestionRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminBannerRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminStructuredRoutes);
app.use("/api/admin", adminTestimonialRoutes);
app.use("/uploads", express.static(uploadsPath));


export default app;
