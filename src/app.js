import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import stateRoutes from "./routes/state.route.js";
import questionRoutes from "./routes/question.routes.js";
import userRoutes from "./routes/user.routes.js";
import bookmarkRoutes from "./routes/bookmark.routes.js"


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
app.use("/api/user", userRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/uploads", express.static("uploads"));


export default app;
