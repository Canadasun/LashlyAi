import assert from "node:assert/strict";
import test from "node:test";
import { generateLashMap } from "./lashmap.service";

const BASE_EYE_ANALYSIS = { eye_shape: "almond" as const, lash_density: "medium" as const };

test("a textured Lash Set (anime_set) produces a base_layer shorter than the spike_layer", () => {
  const result = generateLashMap(BASE_EYE_ANALYSIS, undefined, undefined, "anime_set");
  assert.ok(result.textured_map, "expected textured_map to be set for anime_set");
  const { base_layer: baseLayer, spike_layer: spikeLayer } = result.textured_map!;
  for (let i = 0; i < baseLayer.zones.length; i++) {
    assert.ok(
      baseLayer.zones[i].length_mm <= spikeLayer.zones[i].length_mm,
      `base layer zone ${baseLayer.zones[i].zone} should not exceed the spike layer`,
    );
  }
  assert.equal(spikeLayer.pattern.length > 0, true);
});

test("a non-textured Lash Set (classic) has no textured_map", () => {
  const result = generateLashMap(BASE_EYE_ANALYSIS, undefined, undefined, "classic");
  assert.equal(result.textured_map, undefined);
});

test("no Lash Set requested (legacy path) has no textured_map", () => {
  const result = generateLashMap(BASE_EYE_ANALYSIS);
  assert.equal(result.textured_map, undefined);
});

test("a custom lash map never gets a textured_map, even if a lash set is also present", () => {
  const result = generateLashMap(BASE_EYE_ANALYSIS, undefined, undefined, "anime_set", undefined, {
    label: "Custom",
    curl: "D",
    diameter: "0.10mm",
    lengths: { inner: 8, inner_mid: 9, center: 10, outer_mid: 10, outer: 9 },
  });
  assert.equal(result.textured_map, undefined);
});
