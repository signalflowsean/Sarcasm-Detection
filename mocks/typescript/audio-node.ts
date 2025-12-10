/// <reference types="node" />
/**
 * Node.js-only audio utilities for test environments.
 *
 * ⚠️  DO NOT import this file in browser code that gets bundled.
 * This file uses Node.js built-ins (`fs`, `path`) which will cause bundlers
 * (Vite, Webpack, etc.) to fail at BUILD TIME with module resolution errors.
 *
 * Safe to use in:
 * - E2E tests (Playwright runs in Node.js)
 * - Backend test utilities
 * - Build scripts and CLI tools
 *
 * For browser-compatible mocks, use audio.ts instead.
 *
 * @requires @types/node - Install in consuming project: npm i -D @types/node
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { generateWavBase64, generateWavBytes, type WavConfig } from "./audio";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Path to the shared test audio fixture.
 */
export const TEST_AUDIO_PATH = path.join(
  __dirname,
  "../fixtures/test-audio.wav"
);

/**
 * Load test audio fixture from disk.
 * Falls back to generating audio if fixture doesn't exist.
 *
 * @example
 * ```typescript
 * import { loadTestAudioBase64 } from '../../mocks/typescript/audio-node';
 * const audioBase64 = loadTestAudioBase64();
 * ```
 */
export function loadTestAudioBase64(): string {
  try {
    if (fs.existsSync(TEST_AUDIO_PATH)) {
      const buffer = fs.readFileSync(TEST_AUDIO_PATH);
      return buffer.toString("base64");
    }
  } catch {
    // Fall through to generation
  }
  console.warn("Test audio fixture not found, generating fallback");
  return generateWavBase64();
}

/**
 * Check if the test audio fixture exists on disk.
 */
export function testAudioFixtureExists(): boolean {
  return fs.existsSync(TEST_AUDIO_PATH);
}

/**
 * Save generated WAV bytes to a file.
 * Useful for creating test fixtures.
 */
export function saveWavFile(filePath: string, wavBytes: Uint8Array): void {
  fs.writeFileSync(filePath, Buffer.from(wavBytes));
}

/**
 * Create a Node.js Buffer from WAV bytes.
 * This is the Node.js equivalent of createWavBlob() for use in E2E tests.
 *
 * @example
 * ```typescript
 * import { createWavBuffer } from '../../mocks/typescript/audio-node';
 * const buffer = createWavBuffer();
 * // Use with fs.writeFileSync or multipart form uploads
 * ```
 */
export function createWavBuffer(config?: WavConfig): Buffer {
  return Buffer.from(generateWavBytes(config));
}
