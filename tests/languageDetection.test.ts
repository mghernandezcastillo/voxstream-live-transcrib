import assert from "node:assert/strict";
import test from "node:test";
import { detectEnglishOrSpanish } from "../src/utils/languageDetection";

test("detects common Spanish speech", () => {
  const result = detectEnglishOrSpanish("La aplicación está funcionando muy bien para todos los usuarios.");
  assert.equal(result.language, "spanish");
  assert.ok(result.spanishScore > result.englishScore);
});

test("detects common English speech", () => {
  const result = detectEnglishOrSpanish("The application is working very well for all of our users.");
  assert.equal(result.language, "english");
  assert.ok(result.englishScore > result.spanishScore);
});

test("uses the requested fallback when a probe is inconclusive", () => {
  assert.equal(detectEnglishOrSpanish("VoxStream", "english").language, "english");
  assert.equal(detectEnglishOrSpanish("VoxStream", "spanish").language, "spanish");
});
