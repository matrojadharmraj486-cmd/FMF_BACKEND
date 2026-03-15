import Banner from "../models/Banner.js";
import Qotd from "../models/Qotd.js";
import Testimonial from "../models/Testimonial.js";
import { successResponse, errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

export const getHomeData = async (req, res) => {
  try {
    const [banners, testimonials, qotd] = await Promise.all([
      Banner.find({ isActive: true }).sort({ createdAt: -1 }),
      Testimonial.find({}).sort({ createdAt: -1 }),
      Qotd.findOne({ isActive: true }).sort({ createdAt: -1 })
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
      ? {
          question: qotd.question,
          answerType: qotd.answerType,
          answer: qotd.answerType === "text" ? qotd.answerText : undefined,
          answerImageUrl: qotd.answerType === "image" ? toAbsolute(qotd.answerImage, req) : undefined
        }
      : {
          question: null,
          answerType: null,
          answer: null,
          answerImageUrl: null
        };

    return successResponse(res, 200, "Home data fetched", {
      banners: bannerData,
      testimonials: testimonialData,
      qotd: qotdData
    });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
