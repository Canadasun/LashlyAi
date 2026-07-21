import assert from "node:assert/strict";
import test from "node:test";
import { computeServiceDifficulty } from "./serviceDifficulty.service";

test("classic set on an easy-access eye shape with medium density scores Quick/Standard", () => {
  const result = computeServiceDifficulty({
    eyeShape: "round",
    lashDensity: "medium",
    lashSet: "classic",
  });
  assert.equal(result.score, 20);
  assert.equal(result.label, "Quick");
  assert.deepEqual(result.estimated_minutes, { min: 100, max: 130 });
});

test("megavolume on a hooded eye with sparse density and wispy technique stacks to Expert-Level", () => {
  const result = computeServiceDifficulty({
    eyeShape: "hooded",
    lashDensity: "sparse",
    technique: "wispy",
    lashSet: "megavolume",
  });
  // 75 (base) + 10 (sparse) + 10 (hooded) + 10 (wispy) = 105, clamped to 100
  assert.equal(result.score, 100);
  assert.equal(result.label, "Expert-Level");
  assert.equal(result.estimated_minutes.min, 160 + 15 + 15 + 15);
});

test("notable eye asymmetry adds more than mild asymmetry", () => {
  const mild = computeServiceDifficulty({
    eyeShape: "almond",
    lashDensity: "medium",
    eyeSymmetry: "mild_asymmetry",
    lashSet: "volume",
  });
  const notable = computeServiceDifficulty({
    eyeShape: "almond",
    lashDensity: "medium",
    eyeSymmetry: "notable_asymmetry",
    lashSet: "volume",
  });
  assert.ok(notable.score > mild.score);
});

test("no lash set falls back to the legacy default base instead of throwing", () => {
  const result = computeServiceDifficulty({
    eyeShape: "almond",
    lashDensity: "medium",
  });
  assert.equal(result.score, 25);
  assert.equal(result.label, "Quick");
});

test("score never exceeds the 0-100 range", () => {
  const result = computeServiceDifficulty({
    eyeShape: "monolid",
    lashDensity: "sparse",
    eyeSymmetry: "notable_asymmetry",
    technique: "wispy",
    lashSet: "anime_set",
  });
  assert.ok(result.score <= 100);
});
