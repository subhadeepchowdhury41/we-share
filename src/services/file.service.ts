import { Service } from 'typedi';
import * as cloudinary from 'cloudinary';
import { config } from 'dotenv';
import { UploadApiResponse } from 'cloudinary';

config();

cloudinary.v2.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

@Service()
export class FileService {
  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const result = await cloudinary.v2.uploader.upload(file.path, {
        resource_type: 'auto'
      });

      return result.secure_url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  async deleteFile(publicId: string): Promise<void> {
    try {
      await cloudinary.v2.uploader.destroy(publicId);
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
}
