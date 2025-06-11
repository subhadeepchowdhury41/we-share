import jwt from "jsonwebtoken";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Get keys from environment variables with fallback to config if available
let publicKey: string;
let privateKey: string;

try {
  publicKey = Buffer.from(
    process.env.PUBLIC_KEY || "",
    "base64"
  ).toString("ascii");
  privateKey = Buffer.from(
    process.env.PRIVATE_KEY || "",
    "base64"
  ).toString("ascii");
} catch (error) {
  console.error("Error loading JWT keys:", error);
  publicKey = "";
  privateKey = "";
}

export function signJwt(object: Object, options?: jwt.SignOptions | undefined) {
  return jwt.sign(object, privateKey, {
    ...(options && options),
    algorithm: "RS256",
  });
}

export function verifyJwt<T>(token: string): T | null {
  try {
    const decoded = jwt.verify(token, publicKey) as T;
    return decoded;
  } catch (e) {
    return null;
  }
}