import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createMediaAsset, deleteMediaAsset, MediaAsset, MediaPurpose } from "../models/MediaAsset";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const LOCAL_STORAGE_DIR = path.join(__dirname, "..", "..", "local-storage");
const PUBLIC_BASE_URL =
  process.env.PUBLIC_BASE_URL ||
  (process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : `http://localhost:${process.env.PORT || 3000}`);

const bucketName = process.env.AWS_S3_BUCKET_NAME ?? process.env.AWS_S3_BUCKET;
const endpoint = process.env.AWS_ENDPOINT_URL;
const region = process.env.AWS_DEFAULT_REGION ?? process.env.AWS_REGION ?? "auto";
const hasObjectStorage = Boolean(
  bucketName && endpoint && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY,
);

if (!hasObjectStorage && ["production", "staging"].includes(process.env.NODE_ENV ?? "")) {
  throw new Error(
    "Private object storage is required: configure AWS_ENDPOINT_URL, AWS_ACCESS_KEY_ID, " +
      "AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME.",
  );
}

const s3 = hasObjectStorage
  ? new S3Client({
      endpoint,
      region,
      forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })
  : null;

export class ImageValidationError extends Error {}

function detectImageContentType(buffer: Buffer): MediaAsset["content_type"] | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

function extensionFor(contentType: MediaAsset["content_type"]): string {
  if (contentType === "image/jpeg") return ".jpg";
  if (contentType === "image/png") return ".png";
  return ".webp";
}

export function validateImage(buffer: Buffer): MediaAsset["content_type"] {
  if (!buffer.length || buffer.length > MAX_IMAGE_BYTES) {
    throw new ImageValidationError("Photo must be between 1 byte and 10MB.");
  }
  const contentType = detectImageContentType(buffer);
  if (!contentType) {
    throw new ImageValidationError("Photo must be a valid JPEG, PNG, or WebP image.");
  }
  return contentType;
}

export async function prepareImage(buffer: Buffer): Promise<Buffer> {
  validateImage(buffer);
  try {
    return await sharp(buffer, { failOn: "warning", limitInputPixels: 25_000_000 })
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 88, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new ImageValidationError("Photo could not be decoded safely. Choose a different image.");
  }
}

export async function uploadImage(input: {
  buffer: Buffer;
  ownerUserId: string;
  clientProfileId: string;
  purpose: MediaPurpose;
}): Promise<{ key: string; url: string; asset: MediaAsset }> {
  const contentType = validateImage(input.buffer);
  const key = `${input.ownerUserId}/${input.clientProfileId}/${crypto.randomUUID()}${extensionFor(contentType)}`;

  if (s3) {
    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName!,
        Key: key,
        Body: input.buffer,
        ContentType: contentType,
        CacheControl: "private, no-store",
        Metadata: { purpose: input.purpose, owner: input.ownerUserId },
      }),
    );
  } else {
    const localPath = path.join(LOCAL_STORAGE_DIR, key);
    fs.mkdirSync(path.dirname(localPath), { recursive: true });
    fs.writeFileSync(localPath, input.buffer, { mode: 0o600 });
  }

  try {
    const asset = await createMediaAsset({
      ownerUserId: input.ownerUserId,
      clientProfileId: input.clientProfileId,
      objectKey: key,
      contentType,
      byteSize: input.buffer.length,
      purpose: input.purpose,
    });
    return { key, asset, url: `${PUBLIC_BASE_URL}/media/${asset.id}` };
  } catch (error) {
    await deleteStoredObject(key).catch(() => undefined);
    throw error;
  }
}

export async function readStoredObject(key: string): Promise<Uint8Array> {
  if (s3) {
    const result = await s3.send(new GetObjectCommand({ Bucket: bucketName!, Key: key }));
    if (!result.Body) throw new Error("Stored photo has no content.");
    return result.Body.transformToByteArray();
  }
  return fs.promises.readFile(path.join(LOCAL_STORAGE_DIR, key));
}

export async function deleteStoredObject(key: string): Promise<void> {
  if (s3) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucketName!, Key: key }));
    return;
  }
  await fs.promises.rm(path.join(LOCAL_STORAGE_DIR, key), { force: true });
}

export async function deleteStoredMediaAsset(asset: MediaAsset): Promise<void> {
  await deleteStoredObject(asset.object_key);
  await deleteMediaAsset(asset.id);
}
