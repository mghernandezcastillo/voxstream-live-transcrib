import assert from "node:assert/strict";
import test from "node:test";
import {
  areAllMoonshineLanguagesReady,
  getEndToEndLatencyMs,
  getMoonshineBatchDurationSec,
  getMoonshineModelProfile,
  getOtherMoonshineLanguage,
  MOONSHINE_MAX_LINE_DURATION_SEC,
} from "../src/utils/moonshineRuntime";

test("requires both resident Moonshine languages before startup completes", () => {
  assert.equal(areAllMoonshineLanguagesReady([]), false);
  assert.equal(areAllMoonshineLanguagesReady(["english"]), false);
  assert.equal(areAllMoonshineLanguagesReady(["spanish"]), false);
  assert.equal(areAllMoonshineLanguagesReady(["english", "spanish"]), true);
  assert.equal(getOtherMoonshineLanguage("english"), "spanish");
  assert.equal(getOtherMoonshineLanguage("spanish"), "english");
});

test("uses Tiny Streaming for predictable English realtime performance", () => {
  assert.deepEqual(getMoonshineModelProfile("english"), {
    model: "tiny-streaming",
    shortLabel: "Tiny Streaming",
    streaming: true,
    maxBatchDurationSec: 2,
  });
});

test("identifies Spanish Base as non-streaming", () => {
  const profile = getMoonshineModelProfile("spanish");
  assert.equal(profile.model, "base");
  assert.equal(profile.streaming, false);
  assert.equal(profile.maxBatchDurationSec, 5);
});

test("batches backlog without creating unbounded inference calls", () => {
  assert.equal(getMoonshineBatchDurationSec("english", 0.5), 0.5);
  assert.equal(getMoonshineBatchDurationSec("english", 8), 2);
  assert.equal(getMoonshineBatchDurationSec("spanish", 3.5), 3.5);
  assert.equal(getMoonshineBatchDurationSec("spanish", 8), 5);
});

test("caps line duration and calculates capture-to-result latency", () => {
  assert.equal(MOONSHINE_MAX_LINE_DURATION_SEC, 6);
  assert.equal(getEndToEndLatencyMs(1_000, 2_750), 1_750);
  assert.equal(getEndToEndLatencyMs(0, 2_750), 0);
});
