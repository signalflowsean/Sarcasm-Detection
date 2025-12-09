/**
 * Generate test WAV audio files for testing.
 *
 * Usage: node generate-audio.js
 *
 * Creates test audio files at 16kHz sample rate (matches Wav2Vec2).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SAMPLE_RATE = 16000;

/**
 * Audio configuration presets
 */
const PRESETS = {
  // Standard test audio: 1-second 440Hz sine wave
  standard: {
    filename: "test-audio.wav",
    duration: 1,
    frequency: 440,
    amplitude: 0.3,
  },
  // Short audio for quick tests
  short: {
    filename: "test-audio-short.wav",
    duration: 0.5,
    frequency: 440,
    amplitude: 0.3,
  },
  // Silent audio for edge case testing
  silent: {
    filename: "test-audio-silent.wav",
    duration: 0.5,
    frequency: 0,
    amplitude: 0,
  },
};

/**
 * Generate a WAV file with the given parameters.
 */
function generateWav({ filename, duration, frequency, amplitude }) {
  const outputPath = path.join(__dirname, filename);
  const numSamples = SAMPLE_RATE * duration;
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 44 + dataSize - 8;

  const buffer = Buffer.alloc(44 + dataSize);

  // RIFF header
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write("WAVE", 8);

  // fmt chunk
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28); // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample

  // data chunk
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);

  // Generate samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE;
    const sample =
      frequency > 0
        ? Math.floor(Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767)
        : 0;
    buffer.writeInt16LE(sample, 44 + i * 2);
  }

  fs.writeFileSync(outputPath, buffer);
  console.log(`Generated: ${filename}`);
  console.log(`  Duration: ${duration}s, Frequency: ${frequency}Hz`);
  console.log(`  Size: ${buffer.length} bytes`);
  console.log("");
}

// Generate all presets
console.log("Generating test audio files...\n");
for (const [name, config] of Object.entries(PRESETS)) {
  console.log(`[${name}]`);
  generateWav(config);
}
console.log("Done!");
