import assert from "node:assert/strict";
import test from "node:test";
import { ImageValidationError, prepareImage, validateImage } from "./storage.service";

const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

test("validateImage detects a PNG by file signature, not caller metadata", () => {
  assert.equal(validateImage(ONE_PIXEL_PNG), "image/png");
});

test("validateImage rejects arbitrary non-image bytes", () => {
  assert.throws(() => validateImage(Buffer.from("<script>alert(1)</script>")), ImageValidationError);
});

test("prepareImage decodes, strips metadata, and normalizes uploads to JPEG", async () => {
  const prepared = await prepareImage(ONE_PIXEL_PNG);
  assert.equal(validateImage(prepared), "image/jpeg");
  assert.ok(prepared.length > 0);
});
