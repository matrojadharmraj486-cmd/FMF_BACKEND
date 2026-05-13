import { v2 as cloudinary } from "cloudinary";

let isConfigured = false;

const ensureCloudinaryConfig = () => {
  if (isConfigured) return;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary not configured");
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
  isConfigured = true;
};

export const uploadImageFile = async (filePath, folder = "fmf") => {
  ensureCloudinaryConfig();
  const result = await cloudinary.uploader.upload(filePath, {
    folder,
    resource_type: "image"
  });
  return { url: result.secure_url, publicId: result.public_id };
};

export const uploadImageData = async (dataUri, folder = "fmf") => {
  ensureCloudinaryConfig();
  const result = await cloudinary.uploader.upload(dataUri, {
    folder,
    resource_type: "image"
  });
  return { url: result.secure_url, publicId: result.public_id };
};
