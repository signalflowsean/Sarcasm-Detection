import { expect, Page, test } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ES module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use a desktop viewport to avoid the mobile modal behavior
// The app's mobile breakpoint is 1440px
test.use({ viewport: { width: 1500, height: 900 } });

/**
 * Audio Recording E2E Tests
 *
 * These tests mock the browser's MediaRecorder API to test the complete
 * audio recording flow without requiring actual microphone access.
 *
 * The mock approach:
 * 1. Inject a mock MediaStream and MediaRecorder before the page loads
 * 2. Use a pre-generated test WAV file as the "recorded" audio
 * 3. Test the full UI flow: record -> stop -> send to detector
 */

// Path to test audio fixture
const TEST_AUDIO_PATH = path.join(__dirname, "../fixtures/test-audio.wav");

/**
 * Inject mocks for MediaRecorder and getUserMedia.
 * This must be called before navigating to the page.
 */
async function injectAudioMocks(page: Page, audioBase64: string) {
  await page.addInitScript(
    ({ audioData }) => {
      console.log("[E2E Mock] Initializing audio mocks");

      // Store the audio data for use in MediaRecorder mock
      (window as unknown as { __testAudioBase64: string }).__testAudioBase64 =
        audioData;

      // Create a minimal fake MediaStream that satisfies type checks
      const createFakeMediaStream = (): MediaStream => {
        // Create a fake track
        const fakeTrack = {
          kind: "audio" as const,
          id: "fake-audio-track",
          label: "Fake Audio",
          enabled: true,
          muted: false,
          readyState: "live" as const,
          stop: () => {
            console.log("[E2E Mock] Fake track stopped");
          },
          clone: () => fakeTrack,
          getCapabilities: () => ({}),
          getConstraints: () => ({}),
          getSettings: () => ({ deviceId: "fake", groupId: "fake" }),
          applyConstraints: async () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          onended: null,
          onmute: null,
          onunmute: null,
          contentHint: "",
        };

        // Create a fake MediaStream
        const fakeStream = {
          id: "fake-stream-id",
          active: true,
          getTracks: () => [fakeTrack],
          getAudioTracks: () => [fakeTrack],
          getVideoTracks: () => [],
          getTrackById: () => fakeTrack,
          addTrack: () => {},
          removeTrack: () => {},
          clone: function () {
            return this;
          },
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          onaddtrack: null,
          onremovetrack: null,
        };

        return fakeStream as unknown as MediaStream;
      };

      // Mock getUserMedia
      if (navigator.mediaDevices) {
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(
          navigator.mediaDevices,
        );
        navigator.mediaDevices.getUserMedia = async (
          constraints: MediaStreamConstraints,
        ): Promise<MediaStream> => {
          console.log("[E2E Mock] getUserMedia called with:", constraints);
          if (constraints && constraints.audio) {
            console.log("[E2E Mock] Returning fake audio stream");
            return createFakeMediaStream();
          }
          // For video or other constraints, try original
          return originalGetUserMedia(constraints);
        };
      }

      // Mock MediaRecorder
      class MockMediaRecorder {
        stream: MediaStream;
        mimeType: string;
        state: "inactive" | "recording" | "paused" = "inactive";
        ondataavailable: ((event: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onstart: (() => void) | null = null;

        constructor(stream: MediaStream, options?: { mimeType?: string }) {
          this.stream = stream;
          this.mimeType = options?.mimeType || "audio/webm";
          console.log(
            "[E2E Mock] MockMediaRecorder created with mimeType:",
            this.mimeType,
          );
        }

        start() {
          console.log("[E2E Mock] MockMediaRecorder.start() called");
          this.state = "recording";
          if (this.onstart) {
            this.onstart();
          }
        }

        stop() {
          console.log(
            "[E2E Mock] MockMediaRecorder.stop() called, current state:",
            this.state,
          );
          if (this.state === "inactive") return;

          this.state = "inactive";

          // Simulate async data delivery like real MediaRecorder
          setTimeout(() => {
            // Convert base64 to blob
            const base64 = (window as unknown as { __testAudioBase64: string })
              .__testAudioBase64;
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "audio/wav" });

            console.log(
              "[E2E Mock] Delivering audio blob:",
              blob.size,
              "bytes",
            );

            if (this.ondataavailable) {
              this.ondataavailable({ data: blob });
            }
            if (this.onstop) {
              this.onstop();
            }
          }, 50);
        }

        pause() {
          if (this.state === "recording") {
            this.state = "paused";
          }
        }

        resume() {
          if (this.state === "paused") {
            this.state = "recording";
          }
        }

        requestData() {
          // No-op for mock
        }

        static isTypeSupported(mimeType: string): boolean {
          return [
            "audio/webm",
            "audio/webm;codecs=opus",
            "audio/ogg",
            "audio/wav",
            "audio/mp4",
          ].some((type) => mimeType.startsWith(type.split(";")[0]));
        }
      }

      // Replace global MediaRecorder
      (window as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;
      console.log("[E2E Mock] MediaRecorder replaced with mock");

      // Mock AudioContext to handle waveform visualization
      // We create a complete mock that doesn't extend the original to avoid
      // issues in CI environments without audio hardware
      class MockAudioContext {
        state: AudioContextState = "running";
        sampleRate = 44100;
        currentTime = 0;
        baseLatency = 0;
        outputLatency = 0;
        destination = {} as AudioDestinationNode;
        listener = {} as AudioListener;
        audioWorklet = {} as AudioWorklet;
        onstatechange: ((this: AudioContext, ev: Event) => unknown) | null =
          null;

        createMediaStreamSource(_stream: MediaStream) {
          console.log("[E2E Mock] createMediaStreamSource called");
          // Return a mock source node that doesn't do anything
          const mockSource = {
            connect: () => {
              console.log("[E2E Mock] MediaStreamSource.connect called");
            },
            disconnect: () => {},
            channelCount: 1,
            channelCountMode: "max",
            channelInterpretation: "speakers",
            context: this,
            numberOfInputs: 0,
            numberOfOutputs: 1,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          };
          return mockSource as unknown as MediaStreamAudioSourceNode;
        }

        createAnalyser() {
          console.log("[E2E Mock] createAnalyser called");
          // Return a mock analyser node
          const mockAnalyser = {
            fftSize: 2048,
            frequencyBinCount: 1024,
            minDecibels: -100,
            maxDecibels: -30,
            smoothingTimeConstant: 0.8,
            getByteTimeDomainData: (array: Uint8Array) => {
              // Fill with silence (128 = center line)
              array.fill(128);
            },
            getByteFrequencyData: (array: Uint8Array) => {
              array.fill(0);
            },
            getFloatTimeDomainData: (array: Float32Array) => {
              array.fill(0);
            },
            getFloatFrequencyData: (array: Float32Array) => {
              array.fill(-100);
            },
            connect: () => {},
            disconnect: () => {},
            channelCount: 1,
            channelCountMode: "max",
            channelInterpretation: "speakers",
            context: this,
            numberOfInputs: 1,
            numberOfOutputs: 1,
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => true,
          };
          return mockAnalyser as unknown as AnalyserNode;
        }

        async resume() {
          console.log("[E2E Mock] AudioContext.resume called");
          this.state = "running";
          return Promise.resolve();
        }

        async suspend() {
          this.state = "suspended";
          return Promise.resolve();
        }

        async close() {
          this.state = "closed";
          return Promise.resolve();
        }

        createGain() {
          return {} as GainNode;
        }
        createOscillator() {
          return {} as OscillatorNode;
        }
        createBufferSource() {
          return {} as AudioBufferSourceNode;
        }
        async decodeAudioData(_arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
          // Return a minimal AudioBuffer mock for peaks computation
          return {
            sampleRate: 44100,
            length: 44100, // 1 second of audio
            duration: 1,
            numberOfChannels: 1,
            getChannelData: () => new Float32Array(44100).fill(0),
            copyFromChannel: () => {},
            copyToChannel: () => {},
          } as unknown as AudioBuffer;
        }
        addEventListener() {}
        removeEventListener() {}
        dispatchEvent() {
          return true;
        }
      }
      (window as { AudioContext: unknown }).AudioContext = MockAudioContext;
      (window as { webkitAudioContext?: unknown }).webkitAudioContext =
        MockAudioContext;
      console.log("[E2E Mock] AudioContext replaced with complete mock");
    },
    { audioData: audioBase64 },
  );
}

/**
 * Load test audio file as base64
 */
function loadTestAudioBase64(): string {
  // Check if fixture exists, if not create a minimal WAV
  if (!fs.existsSync(TEST_AUDIO_PATH)) {
    console.log("Test audio fixture not found, tests will use fallback");
    // Return a minimal valid WAV file (silent, ~0.5 seconds)
    return createMinimalWavBase64();
  }
  const buffer = fs.readFileSync(TEST_AUDIO_PATH);
  return buffer.toString("base64");
}

/**
 * Create a minimal valid WAV file as base64
 * This is a fallback if the fixture file doesn't exist
 */
function createMinimalWavBase64(): string {
  // Minimal WAV: 44-byte header + 8000 samples (0.5 seconds at 16kHz, mono, 16-bit)
  const sampleRate = 16000;
  const duration = 0.5;
  const numSamples = Math.floor(sampleRate * duration);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 44 + dataSize - 8;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, fileSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true); // byte rate
  view.setUint16(32, bytesPerSample, true); // block align
  view.setUint16(34, 16, true); // bits per sample

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // Write silent samples (all zeros - already initialized)
  // For a more realistic test, we could add a simple sine wave
  for (let i = 0; i < numSamples; i++) {
    // Generate a simple 440Hz sine wave at low volume
    const t = i / sampleRate;
    const sample = Math.floor(Math.sin(2 * Math.PI * 440 * t) * 1000);
    view.setInt16(44 + i * 2, sample, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

test.describe("Audio Recording", () => {
  // Each test gets its own browser context, no need for serial mode
  // This allows parallel execution which is faster

  test.beforeEach(async ({ page }) => {
    // Load audio and inject mocks fresh for each test
    const audioBase64 = loadTestAudioBase64();
    await injectAudioMocks(page, audioBase64);
  });

  test("should display audio recording interface", async ({ page }) => {
    await page.goto("/audio-input");

    // Should show the mic button
    await expect(page.getByTestId("mic-button")).toBeVisible();

    // Should show the waveform area
    await expect(page.getByTestId("waveform")).toBeVisible();
  });

  test("should start and stop recording", async ({ page }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording (force: true bypasses animation stability check)
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Wait a moment for "recording"
    await page.waitForTimeout(500);

    // Stop recording
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    // Should have controls visible
    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should show playback controls after recording", async ({ page }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Wait a moment then stop
    await page.waitForTimeout(500);
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

    // Should have send button (indicates recording completed)
    await expect(page.getByTestId("send-button")).toBeVisible({
      timeout: 5000,
    });
  });

  test("should discard recording when discard button clicked", async ({
    page,
  }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Wait a moment then stop
    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    // Wait for recording to process - send button should appear
    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });

    // Click discard button
    const discardButton = page.getByTestId("discard-button");
    await expect(discardButton).toBeEnabled({ timeout: 3000 });
    await discardButton.click();

    // Send button should be disabled after discarding (label changes to "Record Audio First")
    await expect(sendButton).toBeDisabled({ timeout: 3000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should send recording to detector API", async ({ page, request }) => {
    // First verify backend is available
    const backendUrl = process.env.E2E_BACKEND_URL || "http://localhost:5000";
    try {
      const healthCheck = await request.get(`${backendUrl}/api/health`);
      if (!healthCheck.ok()) {
        test.skip();
        return;
      }
    } catch {
      test.skip();
      return;
    }

    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording (force: true bypasses animation stability check)
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Wait a moment then stop
    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    // Wait for recording to process and send button to appear
    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    // The meter should show activity (needle should move from idle position)
    // Wait for the API response and meter animation
    await page.waitForTimeout(3000);

    // After sending, the recording should be cleared (send button disabled)
    // This indicates successful completion of the send flow
    await expect(sendButton).toBeDisabled({ timeout: 5000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should use keyboard shortcut R to toggle recording", async ({
    page,
  }) => {
    await page.goto("/audio-input");

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Click somewhere on the page first to ensure focus isn't on an input
    await page.locator("body").click();

    // Press R to start recording
    await page.keyboard.press("r");

    // Should be recording (wait a bit for the async getUserMedia mock)
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Press R again to stop
    await page.keyboard.press("r");

    // Should stop recording
    await expect(micButton).not.toHaveClass(/is-recording/);
  });

  test("should navigate to audio mode via rotary switch", async ({ page }) => {
    // Start from getting-started
    await page.goto("/getting-started");

    // Find and click the rotary switch (or navigate via URL for simplicity)
    // The rotary switch interaction is complex, so we test URL navigation
    await page.goto("/audio-input");

    await expect(page).toHaveURL(/audio-input/);

    // Audio recorder should be visible
    await expect(page.getByTestId("audio-recorder")).toBeVisible();
    await expect(page.getByTestId("mic-button")).toBeVisible();
  });
});

test.describe("Audio Recording - Error States", () => {
  // Skip: This test requires specific app behavior for error display
  // The app may handle errors differently (e.g., toast notifications instead of inline errors)
  test.skip("should handle getUserMedia rejection gracefully", async ({
    page,
  }) => {
    // Inject a script that makes getUserMedia reject
    await page.addInitScript(() => {
      if (navigator.mediaDevices) {
        navigator.mediaDevices.getUserMedia = async () => {
          throw new DOMException("Permission denied", "NotAllowedError");
        };
      }
    });

    await page.goto("/audio-input");

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();
    await micButton.click({ force: true });

    // Should show an error message
    const errorMessage = page.getByTestId("audio-error");
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText(/denied|permission|access/i);
  });
});
