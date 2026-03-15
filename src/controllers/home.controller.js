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
      Banner.find({ isActive: true }).sort({ createdAt: -1 }),
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

    return successResponse(res, 200, "Home data fetched", {
      banners: bannerData,
      testimonials: testimonialData,
      qotd: qotdData
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
