import assert from "node:assert/strict";
import test from "node:test";
import {
  getMoonshineManifestSize,
  isMoonshineManifestCached,
} from "../src/utils/moonshineCache";

const manifest = JSON.stringify({
  groups: [
    {
      base_url: "https://models.example/moonshine",
      files: [
        { name: "encoder.ort", size: 120 },
        { name: "tokenizer.bin", size: 30 },
      ],
    },
  ],
});

test("calculates the complete Moonshine manifest size", () => {
  assert.equal(getMoonshineManifestSize(manifest), 150);
});

test("reports an uncached manifest when Cache Storage is unavailable", async () => {
  assert.equal(await isMoonshineManifestCached(manifest), false);
});
