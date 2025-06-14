import dotenv from "dotenv";
dotenv.config();

export const cloudinaryConfig = {
  cloud_name: 'dw4fvqtns',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
}
