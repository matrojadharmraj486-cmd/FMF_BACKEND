import multer from "multer";
import path from "path";
import fs from "fs";
import { logger } from "../utils/logger.js";

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(process.cwd(), "uploads");

const mimeToExt = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "image/heic": ".heic",
  "image/heif": ".heif"
};

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      logger.info("Upload directory created", {
        uploadDir
      });
    }
    cb(null, uploadDir);
  },

  filename: (req, file, cb) => {
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype && file.mimetype.startsWith("image/")) {
      ext = mimeToExt[file.mimetype] || "";
    }
    const generatedName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    logger.info("Incoming file accepted for upload", {
      originalName: file.originalname,
      generatedName,
      mimeType: file.mimetype,
      uploadDir
    });
    cb(null, generatedName);
  }

});

export const upload = multer({ storage });
