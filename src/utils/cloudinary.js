import cloudinary from "cloudinary";

const getCloudinaryConfig = () => {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw new Error("Cloudinary not configured");
  }
  cloudinary.v2.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
};

export const uploadImageFile = async (filePath, folder = "fmf") => {
  getCloudinaryConfig();
  const result = await cloudinary.v2.uploader.upload(filePath, {
    folder,
    resource_type: "image"
  });
  return { url: result.secure_url, publicId: result.public_id };
};
