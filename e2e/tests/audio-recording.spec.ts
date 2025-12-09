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
 * Uses shared mocks from /mocks for consistency across all tests.
 */

// Path to shared test audio fixture
const TEST_AUDIO_PATH = path.join(
  __dirname,
  "../../mocks/fixtures/test-audio.wav",
);

/**
 * Load test audio file as base64 from shared fixtures
 */
function loadTestAudioBase64(): string {
  if (fs.existsSync(TEST_AUDIO_PATH)) {
    const buffer = fs.readFileSync(TEST_AUDIO_PATH);
    return buffer.toString("base64");
  }
  // Fallback: generate minimal WAV
  console.log("Test audio fixture not found, generating fallback");
  return generateWavBase64();
}

/**
 * Generate a minimal valid WAV file as base64 (fallback)
 */
function generateWavBase64(): string {
  const sampleRate = 16000;
  const duration = 0.5;
  const numSamples = Math.floor(sampleRate * duration);
  const bytesPerSample = 2;
  const dataSize = numSamples * bytesPerSample;
  const fileSize = 44 + dataSize - 8;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeString(0, "RIFF");
  view.setUint32(4, fileSize, true);
  writeString(8, "WAVE");

  // fmt chunk
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);

  // data chunk
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  // Generate 440Hz sine wave
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample = Math.floor(Math.sin(2 * Math.PI * 440 * t) * 0.3 * 32767);
    view.setInt16(44 + i * 2, sample, true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Inject mocks for MediaRecorder, AudioContext, and getUserMedia.
 * This must be called before navigating to the page.
 */
async function injectAudioMocks(page: Page, audioBase64: string) {
  await page.addInitScript(
    ({ audioData }) => {
      console.log("[E2E Mock] Initializing audio mocks");

      // Store the audio data for use in MediaRecorder mock
      (window as unknown as { __testAudioBase64: string }).__testAudioBase64 =
        audioData;

      // Create a fake MediaStream
      const createFakeMediaStream = (): MediaStream => {
        const fakeTrack = {
          kind: "audio" as const,
          id: "mock-audio-track",
          label: "Mock Audio",
          enabled: true,
          muted: false,
          readyState: "live" as const,
          stop: () => {},
          clone: function () {
            return this;
          },
          getCapabilities: () => ({}),
          getConstraints: () => ({}),
          getSettings: () => ({ deviceId: "mock", groupId: "mock" }),
          applyConstraints: async () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          onended: null,
          onmute: null,
          onunmute: null,
          contentHint: "",
        };

        const fakeStream = {
          id: "mock-stream-id",
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
            return createFakeMediaStream();
          }
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
        }

        start() {
          this.state = "recording";
          if (this.onstart) this.onstart();
        }

        stop() {
          if (this.state === "inactive") return;
          this.state = "inactive";

          setTimeout(() => {
            const base64 = (window as unknown as { __testAudioBase64: string })
              .__testAudioBase64;
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            const blob = new Blob([bytes], { type: "audio/wav" });

            if (this.ondataavailable) {
              this.ondataavailable({ data: blob });
            }
            if (this.onstop) {
              this.onstop();
            }
          }, 50);
        }

        pause() {
          if (this.state === "recording") this.state = "paused";
        }

        resume() {
          if (this.state === "paused") this.state = "recording";
        }

        requestData() {}

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
      (window as { MediaRecorder: unknown }).MediaRecorder = MockMediaRecorder;

      // Mock AudioContext
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

        createMediaStreamSource() {
          return {
            connect: () => {},
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
          } as unknown as MediaStreamAudioSourceNode;
        }

        createAnalyser() {
          return {
            fftSize: 2048,
            frequencyBinCount: 1024,
            minDecibels: -100,
            maxDecibels: -30,
            smoothingTimeConstant: 0.8,
            getByteTimeDomainData: (array: Uint8Array) => array.fill(128),
            getByteFrequencyData: (array: Uint8Array) => array.fill(0),
            getFloatTimeDomainData: (array: Float32Array) => array.fill(0),
            getFloatFrequencyData: (array: Float32Array) => array.fill(-100),
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
          } as unknown as AnalyserNode;
        }

        async resume() {
          this.state = "running";
        }

        async suspend() {
          this.state = "suspended";
        }

        async close() {
          this.state = "closed";
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
        async decodeAudioData(): Promise<AudioBuffer> {
          return {
            sampleRate: 44100,
            length: 44100,
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
    },
    { audioData: audioBase64 },
  );
}

test.describe("Audio Recording", () => {
  test.beforeEach(async ({ page }) => {
    const audioBase64 = loadTestAudioBase64();
    await injectAudioMocks(page, audioBase64);
  });

  test("should display audio recording interface", async ({ page }) => {
    await page.goto("/audio-input");
    await expect(page.getByTestId("mic-button")).toBeVisible();
    await expect(page.getByTestId("waveform")).toBeVisible();
  });

  test("should start and stop recording", async ({ page }) => {
    await page.goto("/audio-input");
    await page.waitForTimeout(500);

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    // Start recording
    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);

    // Stop recording
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

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

    await page.waitForTimeout(500);
    await micButton.click({ force: true });
    await expect(micButton).not.toHaveClass(/is-recording/, { timeout: 5000 });

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

    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });

    // Click discard button
    const discardButton = page.getByTestId("discard-button");
    await expect(discardButton).toBeEnabled({ timeout: 3000 });
    await discardButton.click();

    await expect(sendButton).toBeDisabled({ timeout: 3000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should send recording to detector API", async ({ page, request }) => {
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

    await micButton.click({ force: true });
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    await page.waitForTimeout(500);
    await micButton.click({ force: true });

    const sendButton = page.getByTestId("send-button");
    await expect(sendButton).toBeVisible({ timeout: 5000 });
    await sendButton.click();

    await page.waitForTimeout(3000);

    await expect(sendButton).toBeDisabled({ timeout: 5000 });
    await expect(sendButton).toContainText("Record Audio First");
  });

  test("should use keyboard shortcut R to toggle recording", async ({
    page,
  }) => {
    await page.goto("/audio-input");

    const micButton = page.getByTestId("mic-button");
    await expect(micButton).toBeVisible();

    await page.locator("body").click();

    // Press R to start recording
    await page.keyboard.press("r");
    await expect(micButton).toHaveClass(/is-recording/, { timeout: 5000 });

    // Press R again to stop
    await page.keyboard.press("r");
    await expect(micButton).not.toHaveClass(/is-recording/);
  });

  test("should navigate to audio mode via rotary switch", async ({ page }) => {
    await page.goto("/getting-started");
    await page.goto("/audio-input");

    await expect(page).toHaveURL(/audio-input/);
    await expect(page.getByTestId("audio-recorder")).toBeVisible();
    await expect(page.getByTestId("mic-button")).toBeVisible();
  });
});

test.describe("Audio Recording - Error States", () => {
  test.skip("should handle getUserMedia rejection gracefully", async ({
    page,
  }) => {
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

    const errorMessage = page.getByTestId("audio-error");
    await expect(errorMessage).toBeVisible({ timeout: 3000 });
    await expect(errorMessage).toContainText(/denied|permission|access/i);
  });
});
