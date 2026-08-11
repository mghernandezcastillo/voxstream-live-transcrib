import assert from "node:assert/strict";
import test from "node:test";
import {
  getQueueDurationSec,
  measureAudioLevel,
  shouldSwitchWebGPUToWasm,
  takeCoalescedChunk,
  trimAudioQueue,
  type LocalAudioChunk,
} from "../src/utils/localAudioQueue";

function chunk(id: string, seconds: number, value: number, sampleRate = 10): LocalAudioChunk {
  return {
    id,
    audio: new Float32Array(seconds * sampleRate).fill(value),
    sampleRate,
    language: "spanish",
    sessionId: 1,
  };
}

test("coalesces chronological backlog without discarding the tail", () => {
  const queue = [chunk("a", 3, 1), chunk("b", 3, 2), chunk("c", 3, 3)];
  const result = takeCoalescedChunk(queue, 6);

  assert.equal(result?.id, "a..b");
  assert.deepEqual(Array.from(result!.audio), [
    ...new Array(30).fill(1),
    ...new Array(30).fill(2),
  ]);
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, "c");
});

test("does not combine chunks from different sessions", () => {
  const newer = chunk("new", 3, 2);
  newer.sessionId = 2;
  const queue = [chunk("old", 3, 1), newer];

  assert.equal(takeCoalescedChunk(queue, 15)?.id, "old");
  assert.equal(queue[0].id, "new");
});

test("bounds the queue by dropping only the oldest complete chunks", () => {
  const queue = [chunk("a", 4, 1), chunk("b", 4, 2), chunk("c", 4, 3)];
  const result = trimAudioQueue(queue, 9);

  assert.equal(result.droppedChunks, 1);
  assert.equal(result.droppedDurationSec, 4);
  assert.equal(getQueueDurationSec(queue), 8);
  assert.deepEqual(queue.map((item) => item.id), ["b", "c"]);
});

test("measures peak and RMS for the silence gate", () => {
  const result = measureAudioLevel(new Float32Array([0.5, -0.5, 0.5, -0.5]));
  assert.equal(result.peak, 0.5);
  assert.equal(result.rms, 0.5);
});

test("switches away from WebGPU when inference is decisively slower than realtime", () => {
  assert.equal(shouldSwitchWebGPUToWasm(12_000, 3, 1), true);
  assert.equal(shouldSwitchWebGPUToWasm(2_000, 3, 3), false);
});

test("keeps a moderately slow WebGPU backend when it still beats WASM", () => {
  assert.equal(shouldSwitchWebGPUToWasm(4_800, 3, 1), false);
  assert.equal(shouldSwitchWebGPUToWasm(4_800, 3, 3), false);
});

test("requires two samples for a very slow but non-catastrophic WebGPU backend", () => {
  assert.equal(shouldSwitchWebGPUToWasm(8_000, 3, 1), false);
  assert.equal(shouldSwitchWebGPUToWasm(8_000, 3, 2), true);
});
