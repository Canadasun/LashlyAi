import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const LOCAL_STORAGE_DIR = path.join(__dirname, "..", "..", "local-storage");
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

export interface UploadedImage {
  key: string;
  url: string;
}

export async function uploadImage(buffer: Buffer, originalFilename: string): Promise<UploadedImage> {
  if (process.env.AWS_S3_BUCKET) {
    throw new Error(
      "AWS_S3_BUCKET is set but S3 upload isn't implemented yet — this repo currently only " +
        "supports the local-disk storage stub. Remove AWS_S3_BUCKET from .env or implement " +
        "the S3 branch in storage.service.ts.",
    );
  }

  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });

  const ext = path.extname(originalFilename) || ".jpg";
  const key = `${crypto.randomUUID()}${ext}`;
  fs.writeFileSync(path.join(LOCAL_STORAGE_DIR, key), buffer);

  return { key, url: `${PUBLIC_BASE_URL}/local-storage/${key}` };
}

export function localStorageDir(): string {
  return LOCAL_STORAGE_DIR;
}
