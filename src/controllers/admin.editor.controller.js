import fs from "fs";
import { errorResponse } from "../utils/response.js";
import { uploadImageFile } from "../utils/cloudinary.js";

export const uploadEditorImage = async (req, res) => {
  try {
    if (!req.file) return errorResponse(res, 400, "image file required");

    const uploaded = await uploadImageFile(req.file.path, "fmf/editor");
    try {
      await fs.promises.unlink(req.file.path);
    } catch {
      // ignore cleanup errors
    }

    return res.status(200).json({ url: uploaded.url, publicId: uploaded.publicId });
  } catch (e) {
    return errorResponse(res, 500, e.message);
  }
};
