import assert from "node:assert/strict";
import test from "node:test";
import { ImageValidationError, prepareImage, validateImage, validateVideo } from "./storage.service";

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

function ftypBox(brand: string): Buffer {
  // Minimal ISO-BMFF "ftyp" box: [size(4)]["ftyp"][major_brand(4)][...]. Real files
  // have more after this, but validateVideo only inspects the first 12 bytes.
  return Buffer.concat([
    Buffer.from([0x00, 0x00, 0x00, 0x18]),
    Buffer.from("ftyp", "ascii"),
    Buffer.from(brand, "ascii"),
    Buffer.alloc(16),
  ]);
}

test("validateVideo detects MP4 by ftyp brand", () => {
  assert.equal(validateVideo(ftypBox("isom")), "video/mp4");
});

test("validateVideo detects QuickTime/.mov by its distinct ftyp brand", () => {
  assert.equal(validateVideo(ftypBox("qt  ")), "video/quicktime");
});

test("validateVideo rejects arbitrary non-video bytes", () => {
  assert.throws(() => validateVideo(Buffer.from("not a video")), ImageValidationError);
});

test("validateVideo rejects an empty buffer", () => {
  assert.throws(() => validateVideo(Buffer.alloc(0)), ImageValidationError);
});
