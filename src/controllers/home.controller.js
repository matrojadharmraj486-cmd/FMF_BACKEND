import Banner from "../models/Banner.js";
import StructuredQuestion from "../models/StructuredQuestion.js";
import Testimonial from "../models/Testimonial.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

const DAY_MS = 1000 * 60 * 60 * 24;

// Human-readable plan duration ("Monthly" / "Quarterly" / "Yearly" ...) from days.
const getDurationLabel = (days) => {
  const n = Number(days);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n === 1) return "Daily";
  if (n === 7) return "Weekly";
  if (n === 14) return "Fortnightly";
  if (n >= 28 && n <= 31) return "Monthly";
  if (n >= 85 && n <= 95) return "Quarterly";
  if (n >= 175 && n <= 190) return "Half-Yearly";
  if (n >= 360 && n <= 372) return "Yearly";
  if (n % 365 === 0) return `${n / 365} Years`;
  if (n % 30 === 0) return `${n / 30} Months`;
  return `${n} Days`;
};

// Builds the per-user subscription summary returned by the home API.
// Expects the user doc with `subscription.plan` populated.
const buildSubscriptionSummary = (user) => {
  const sub = user?.subscription || {};
  const plan = sub.plan && typeof sub.plan === "object" ? sub.plan : null;
  const startDate = sub.startDate ? new Date(sub.startDate) : null;
  const endDate = sub.endDate ? new Date(sub.endDate) : null;
  const now = new Date();

  if (!plan && !startDate && !endDate) {
    return {
      isSubscribed: false,
      status: sub.status || "expired",
      plan: null,
      planName: null,
      startDate: null,
      endDate: null,
      durationDays: null,
      durationLabel: null,
      remainingDays: 0
    };
  }

  let durationDays = null;
  if (startDate && endDate) {
    durationDays = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / DAY_MS));
  } else if (plan && Number.isFinite(Number(plan.durationDays))) {
    durationDays = Number(plan.durationDays);
  }

  let remainingDays = 0;
  if (endDate) {
    const diff = endDate.getTime() - now.getTime();
    remainingDays = diff > 0 ? Math.ceil(diff / DAY_MS) : 0;
  }

  const isExpired = endDate ? endDate.getTime() <= now.getTime() : sub.status !== "active";
  const status = sub.status === "canceled" ? "canceled" : isExpired ? "expired" : "active";

  return {
    isSubscribed: status === "active",
    status,
    plan: plan
      ? {
          id: String(plan._id),
          name: plan.name || null,
          price: plan.price ?? null,
          gstPercent: plan.gstPercent ?? 0,
          currency: plan.currency || "INR",
          durationDays: plan.durationDays ?? durationDays
        }
      : null,
    planName: plan?.name || null,
    startDate: startDate ? startDate.toISOString() : null,
    endDate: endDate ? endDate.toISOString() : null,
    durationDays,
    durationLabel: getDurationLabel(durationDays),
    remainingDays
  };
};

const withComputedAnswer = (obj) => {
  const subs = Array.isArray(obj.sub_questions) ? obj.sub_questions : [];
  const inferredDirect =
    subs.length === 1 &&
    String(subs[0].part || "").toLowerCase() === "a" &&
    String(subs[0].text || "").trim() === String(obj.question_text || "").trim();
  if (!obj.isDirect && !inferredDirect) return obj;
  const sq = subs[0];
  if (!sq) return obj;
  obj.answerType = sq.answerType;
  if (sq.answerType === "text") {
    obj.answer = sq.answer;
  } else if (sq.answerType === "image") {
    obj.answerImage = sq.answerImage;
  }
  obj.sub_questions = [];
  return obj;
};

export const getHomeData = async (req, res) => {
  try {
    const [banners, testimonials, qotd] = await Promise.all([
      Banner.find({ isActive: true }).sort({ position: 1, createdAt: -1 }),
      Testimonial.find({}).sort({ createdAt: -1 }),
      StructuredQuestion.findOne({ QOTD: true }).sort({ year: -1, part: 1, createdAt: -1 })
    ]);

    const bannerData = banners.map(d => ({
      ...d.toObject(),
      image: toAbsolute(d.image, req),
      imageUrl: toAbsolute(d.imageUrl, req)
    }));

    const testimonialData = testimonials.map(d => ({
      ...d.toObject(),
      photoUrl: toAbsolute(d.photoUrl, req)
    }));

    const qotdData = qotd
      ? (() => {
          const obj = qotd.toObject();
          obj.id = obj.id || String(obj._id);
          const fallbackQuestionId = "Q1";
          obj.questionId = obj.id && /^Q\d+$/i.test(obj.id) ? obj.id : fallbackQuestionId;
          obj.sub_questions = (obj.sub_questions || []).map(sq => {
            if (sq.answerType === "image" && sq.answerImage) {
              sq.answerImage = toAbsolute(sq.answerImage, req);
            }
            return sq;
          });
          return withComputedAnswer(obj);
        })()
      : null;

    // User-specific enrichment: present only when a valid token is sent
    // (route uses optionalAuthenticate, so the home API stays public).
    let subscription = null;
    if (req.user) {
      try {
        await req.user.populate("subscription.plan");
      } catch {
        // ignore populate failures and fall back to unpopulated subscription
      }
      subscription = buildSubscriptionSummary(req.user);
    }

    return successResponse(res, 200, "Home data fetched", {
      banners: bannerData,
      testimonials: testimonialData,
      qotd: qotdData,
      subscription
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
