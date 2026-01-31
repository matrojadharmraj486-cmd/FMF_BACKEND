import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes.js";
import stateRoutes from "./routes/state.route.js";
import questionRoutes from "./routes/question.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
dotenv.config();

app.use("/api/auth", authRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api", questionRoutes);

export default app;
