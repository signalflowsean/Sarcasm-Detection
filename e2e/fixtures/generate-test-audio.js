/**
 * Generate a test WAV audio file for E2E testing.
 *
 * Usage: node generate-test-audio.js
 *
 * Creates a 1-second 440Hz sine wave at 16kHz sample rate.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_PATH = path.join(__dirname, 'test-audio.wav')
const SAMPLE_RATE = 16000
const DURATION = 1 // seconds
const FREQUENCY = 440 // Hz (A4 note)
const AMPLITUDE = 0.3 // Volume (0-1)

function generateWav() {
  const numSamples = SAMPLE_RATE * DURATION
  const bytesPerSample = 2
  const dataSize = numSamples * bytesPerSample
  const fileSize = 44 + dataSize - 8

  const buffer = Buffer.alloc(44 + dataSize)

  // RIFF header
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(fileSize, 4)
  buffer.write('WAVE', 8)

  // fmt chunk
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16) // chunk size
  buffer.writeUInt16LE(1, 20) // PCM format
  buffer.writeUInt16LE(1, 22) // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * bytesPerSample, 28) // byte rate
  buffer.writeUInt16LE(bytesPerSample, 32) // block align
  buffer.writeUInt16LE(16, 34) // bits per sample

  // data chunk
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  // Generate sine wave samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / SAMPLE_RATE
    const sample = Math.floor(Math.sin(2 * Math.PI * FREQUENCY * t) * AMPLITUDE * 32767)
    buffer.writeInt16LE(sample, 44 + i * 2)
  }

  fs.writeFileSync(OUTPUT_PATH, buffer)
  console.log(`Generated: ${OUTPUT_PATH}`)
  console.log(`  Duration: ${DURATION}s`)
  console.log(`  Sample rate: ${SAMPLE_RATE} Hz`)
  console.log(`  Frequency: ${FREQUENCY} Hz`)
  console.log(`  Size: ${buffer.length} bytes`)
}

generateWav()
