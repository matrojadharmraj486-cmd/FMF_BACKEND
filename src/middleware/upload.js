import multer from "multer";
import path from "path";
import fs from "fs";
import os from "os";
import { logger } from "../utils/logger.js";

const uploadDir = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(os.tmpdir(), "fmf-uploads");

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
    const generatedName = Date.now() + path.extname(file.originalname);
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
