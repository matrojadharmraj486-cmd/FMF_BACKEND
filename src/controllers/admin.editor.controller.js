import { errorResponse } from "../utils/response.js";

const toAbsolute = (url, req) => {
  if (!url) return url;
  const forwardedProto = req.headers["x-forwarded-proto"];
  const proto = (forwardedProto ? forwardedProto.split(",")[0] : req.protocol) || "https";
  const origin = `${proto}://${req.get("host")}`;
  return url.startsWith("http") ? url : `${origin}${url}`;
};

export const uploadEditorImage = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "image file required");
    const relative = `/uploads/${req.file.filename}`;
    const url = toAbsolute(relative, req);
    return res.status(200).json({ url });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};

