# E2E Test Fixtures

## test-audio.wav

A small test audio file used for mocking MediaRecorder in E2E tests.

### Generation

The test audio file is optional. If it doesn't exist, the tests will automatically
generate a minimal WAV file in memory (a 0.5-second 440Hz sine wave).

To generate a proper test audio file, you can:

1. **Use any WAV file**: Copy any small WAV file and rename it to `test-audio.wav`

2. **Generate with FFmpeg**:
   ```bash
   # Generate 1 second of 440Hz sine wave
   ffmpeg -f lavfi -i "sine=frequency=440:duration=1" -ar 16000 -ac 1 test-audio.wav
   ```

3. **Generate with Node.js**: Run the generate script:
   ```bash
   node generate-test-audio.js
   ```

### Requirements

- Format: WAV (PCM)
- Sample rate: 16000 Hz (recommended, matches Wav2Vec2)
- Channels: Mono
- Duration: 0.5 - 2 seconds
- Size: Should be small (< 100KB)
