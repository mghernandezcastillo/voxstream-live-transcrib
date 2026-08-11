class VoxStreamPcmCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const requestedDuration = Number(options?.processorOptions?.chunkDurationSec) || 3;
    this.bufferSize = Math.max(4096, Math.round(sampleRate * requestedDuration));
    this.buffer = new Float32Array(this.bufferSize);
    this.offset = 0;
  }

  process(inputs, outputs) {
    const inputChannels = inputs[0];
    const outputChannels = outputs[0];

    // The node remains connected to the graph, but it must not replay captured
    // tab audio through the app and create echo/doubling.
    for (const output of outputChannels) output.fill(0);
    if (!inputChannels || inputChannels.length === 0) return true;

    const frameCount = inputChannels[0].length;
    for (let frame = 0; frame < frameCount; frame += 1) {
      let monoSample = 0;
      for (let channel = 0; channel < inputChannels.length; channel += 1) {
        monoSample += inputChannels[channel][frame] || 0;
      }
      this.buffer[this.offset++] = monoSample / inputChannels.length;

      if (this.offset === this.bufferSize) {
        const completed = this.buffer;
        this.port.postMessage(completed, [completed.buffer]);
        this.buffer = new Float32Array(this.bufferSize);
        this.offset = 0;
      }
    }

    return true;
  }
}

registerProcessor("voxstream-pcm-capture", VoxStreamPcmCaptureProcessor);
