import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";


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
import adminSubscriptionRoutes from "./routes/admin.subscription.routes.js";
import subscriptionRoutes from "./routes/subscription.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import supportTicketRoutes from "./routes/support.ticket.routes.js";
import adminSupportTicketRoutes from "./routes/admin.support.ticket.routes.js";
import adminPaymentGatewayRoutes from "./routes/admin.paymentGateway.routes.js";
import adminStatsRoutes from "./routes/admin.stats.routes.js";
import faqRoutes from "./routes/faq.routes.js";
import adminFaqRoutes from "./routes/admin.faq.routes.js";
import adminEditorRoutes from "./routes/admin.editor.routes.js";
import adminOpinionRoutes from "./routes/admin.opinion.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminNotificationRoutes from "./routes/admin.notification.routes.js";
import adminPaymentRoutes from "./routes/admin.payment.routes.js";
import adminOrderRoutes from "./routes/admin.order.routes.js";
import couponRoutes from "./routes/coupon.routes.js";
import adminCouponRoutes from "./routes/admin.coupon.routes.js";
import {
  apiFailureLogger,
  globalErrorHandler,
  notFoundHandler
} from "./middleware/apiErrorLogger.js";


const app = express();
const jsonBodyLimit = process.env.JSON_BODY_LIMIT || "10mb";
const uploadsPath = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

app.set("trust proxy", 1);
app.use(
  express.json({
    limit: jsonBodyLimit,
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: jsonBodyLimit }));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
const allowedOrigins = [
  "https://fmf-admin-panel-1.onrender.com",
  "https://thecityheadlines.com",
  "https://fmf-admin-panel.familymedicineflashback.com",
  "https://admin.familymedicineflashback.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
  "https://admin.familymedicineflashback.in"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalizedOrigin = origin.replace(/\/$/, "");
      if (allowedOrigins.includes(normalizedOrigin)) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(apiFailureLogger);

app.use("/api/auth", authRoutes);
app.use("/api/v1", stateRoutes);
app.use("/api", questionRoutes);
app.use("/api", qotdRoutes);
app.use("/api", bannersRoutes);
app.use("/api", testimonialRoutes);
app.use("/api", homeRoutes);
app.use("/api", opinionRoutes);
app.use("/api", subscriptionRoutes);
app.use("/api", supportTicketRoutes);
app.use("/api", faqRoutes);
app.use("/api", notificationRoutes);
app.use("/api", couponRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/user", userRoutes);
app.use("/api/bookmark", bookmarkRoutes);
app.use("/api/admin", adminQuestionRoutes);
app.use("/api/admin", adminUserRoutes);
app.use("/api/admin", adminBannerRoutes);
app.use("/api/admin", adminAuthRoutes);
app.use("/api/admin", adminStructuredRoutes);
app.use("/api/admin", adminTestimonialRoutes);
app.use("/api/admin", adminSubscriptionRoutes);
app.use("/api/admin", adminSupportTicketRoutes);
app.use("/api/admin", adminPaymentGatewayRoutes);
app.use("/api/admin", adminStatsRoutes);
app.use("/api/admin", adminFaqRoutes);
app.use("/api/admin", adminEditorRoutes);
app.use("/api/admin", adminOpinionRoutes);
app.use("/api/admin", adminNotificationRoutes);
app.use("/api/admin", adminPaymentRoutes);
app.use("/api/admin", adminOrderRoutes);
app.use("/api/admin", adminCouponRoutes);
app.use("/admin", adminStatsRoutes);
app.use("/uploads", express.static(uploadsPath));
app.use(notFoundHandler);
app.use(globalErrorHandler);


export default app;
