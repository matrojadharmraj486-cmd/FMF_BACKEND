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
import { adminLogin } from "./controllers/admin.auth.controller.js";


const app = express();

/* 🔥 MUST be BEFORE routes */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
dotenv.config();
app.use(helmet());
app.use(cors());

app.use("/api/auth", authRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api", questionRoutes);
app.use("/api", qotdRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/api/admin", adminQuestionRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminBannerRoutes);
app.use("/uploads", express.static("uploads"));
app.use("/admin", adminLogin)


export default app;
