import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY!;
const ai = new GoogleGenAI({ apiKey });

async function testAudioSchema() {
  const sampleRate = 48000;
  const numSamples = 48000;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  for (let i = 0; i < numSamples; i++) {
    const sample = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 10000;
    buffer.writeInt16LE(Math.floor(sample), 44 + i * 2);
  }

  const base64 = buffer.toString("base64");

  console.log("Testing gemini-3.6-flash with audio/wav AND responseSchema...");
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64,
            },
          },
          { text: "Transcribe audio." },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            transcript: { type: Type.STRING },
            hasSpeech: { type: Type.BOOLEAN },
          },
          required: ["transcript", "hasSpeech"],
        },
      },
    });

    console.log("Response with schema:", res.text);
  } catch (err: any) {
    console.error("Failed with schema:", err?.message || err);
  }

  console.log("\nTesting gemini-3.6-flash with audio/wav WITHOUT responseSchema...");
  try {
    const res2 = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "audio/wav",
              data: base64,
            },
          },
          { text: 'Transcribe audio. Reply ONLY in JSON format: {"transcript": "...", "hasSpeech": false}' },
        ],
      },
    });

    console.log("Response without schema:", res2.text);
  } catch (err: any) {
    console.error("Failed without schema:", err?.message || err);
  }
}

testAudioSchema();
