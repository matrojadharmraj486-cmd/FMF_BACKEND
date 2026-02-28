import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

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


const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config();
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api", questionRoutes);
app.use("/api", qotdRoutes);
app.use("/api", bannersRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/api/admin", adminQuestionRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminBannerRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminStructuredRoutes);
app.use("/uploads", express.static("uploads"));


export default app;
