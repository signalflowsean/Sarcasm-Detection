/**
 * Shared audio mock utilities for E2E tests.
 *
 * These mocks are injected into the browser context to simulate
 * audio recording without requiring actual microphone access.
 */

import type { Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

// ES module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to shared test audio fixture
const TEST_AUDIO_PATH = path.join(
  __dirname,
  "../../../mocks/fixtures/test-audio.wav",
);

/**
 * Load test audio file as base64 from shared fixtures.
 * Falls back to generating a minimal WAV if fixture doesn't exist.
 */
export function loadTestAudioBase64(): string {
  if (fs.existsSync(TEST_AUDIO_PATH)) {
    const buffer = fs.readFileSync(TEST_AUDIO_PATH);
    return buffer.toString("base64");
  }
  console.log("Test audio fixture not found, generating fallback");
  return generateWavBase64();
}

/**
 * Generate a minimal valid WAV file as base64 (fallback).
 */
export function generateWavBase64(): string {
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
  // Use Buffer for Node.js environment
  return Buffer.from(bytes).toString("base64");
}

export interface MoonshineMockOptions {
  /** Transcript to return from speech recognition */
  transcript?: string;
  /** Simulated model loading delay in ms (default: 100ms for tests) */
  modelLoadDelay?: number;
  /** Whether to throw an error on start */
  throwError?: string | null;
}

/**
 * Inject basic audio mocks (mediaDevices, MediaRecorder, AudioContext).
 * Use this for desktop audio recording tests.
 */
export async function injectAudioMocks(page: Page, audioBase64: string) {
  await page.addInitScript((audioData: string) => {
    console.log("[E2E Mock] Initializing audio mocks");

    // Store audio data for MediaRecorder mock
    (window as unknown as { __testAudioBase64: string }).__testAudioBase64 =
      audioData;

    // Create fake MediaStream
    function createFakeMediaStream(): MediaStream {
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
    }

    // Ensure mediaDevices exists (may not exist in headless CI)
    if (!navigator.mediaDevices) {
      const mediaDevices = {
        getUserMedia: async (
          constraints?: MediaStreamConstraints,
        ): Promise<MediaStream> => {
          console.log("[E2E Mock] getUserMedia called with:", constraints);
          if (constraints && constraints.audio) {
            return createFakeMediaStream();
          }
          throw new DOMException("Not supported", "NotSupportedError");
        },
        enumerateDevices: async () => [
          {
            deviceId: "default",
            kind: "audioinput",
            label: "Mock Microphone",
            groupId: "default",
          },
        ],
        getSupportedConstraints: () => ({ audio: true, video: true }),
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => true,
        ondevicechange: null,
      };
      Object.defineProperty(navigator, "mediaDevices", {
        value: mediaDevices,
        writable: true,
        configurable: true,
      });
      console.log("[E2E Mock] Created navigator.mediaDevices from scratch");
    } else {
      // mediaDevices exists, override getUserMedia
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(
        navigator.mediaDevices,
      );
      navigator.mediaDevices.getUserMedia = async (
        constraints?: MediaStreamConstraints,
      ): Promise<MediaStream> => {
        console.log("[E2E Mock] getUserMedia called with:", constraints);
        if (constraints && constraints.audio) {
          return createFakeMediaStream();
        }
        if (originalGetUserMedia) {
          return originalGetUserMedia(constraints!);
        }
        throw new DOMException("Not supported", "NotSupportedError");
      };
      console.log("[E2E Mock] Overrode existing getUserMedia");
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

        window.setTimeout(() => {
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
      onstatechange: ((this: AudioContext, ev: Event) => unknown) | null = null;

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
        return {
          gain: {
            value: 1.0,
            setValueAtTime: () => {},
            linearRampToValueAtTime: () => {},
          },
          connect: () => {},
          disconnect: () => {},
        } as unknown as GainNode;
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

    // Mock Web Speech API (SpeechRecognition)
    // This is critical for e2e tests - without this, the app tries to use the real
    // Web Speech API or falls back to MoonshineJS which downloads a 200MB model
    class MockSpeechRecognition {
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onresult: ((event: unknown) => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onstart: (() => void) | null = null;
      private _listening = false;
      private _shouldRestart = true;
      // Explicit number type since this code runs in browser context (via addInitScript)
      // where setTimeout returns a number, not a Node.js Timeout object
      private _startupTimeoutId: number | null = null;
      private _autoEndTimeoutId: number | null = null;

      private _clearTimeouts() {
        if (this._startupTimeoutId !== null) {
          clearTimeout(this._startupTimeoutId);
          this._startupTimeoutId = null;
        }
        if (this._autoEndTimeoutId !== null) {
          clearTimeout(this._autoEndTimeoutId);
          this._autoEndTimeoutId = null;
        }
      }

      start() {
        console.log("[E2E Mock] SpeechRecognition.start()");
        // Clear any pending timeouts from previous start() calls
        this._clearTimeouts();
        this._listening = true;
        this._shouldRestart = true;

        // Simulate async startup
        // Use window.setTimeout to explicitly use browser API (returns number)
        this._startupTimeoutId = window.setTimeout(() => {
          if (this._listening && this.onstart) {
            this.onstart();
          }
        }, 10);

        // Simulate periodic "no-speech" to trigger restart (mimics real behavior)
        this._autoEndTimeoutId = window.setTimeout(() => {
          if (this._listening && this._shouldRestart && this.onend) {
            console.log("[E2E Mock] SpeechRecognition auto-ended (simulating)");
            this.onend();
          }
        }, 5000);
      }

      stop() {
        console.log("[E2E Mock] SpeechRecognition.stop()");
        this._clearTimeouts();
        this._listening = false;
        this._shouldRestart = false;
        if (this.onend) {
          window.setTimeout(() => this.onend?.(), 10);
        }
      }

      abort() {
        console.log("[E2E Mock] SpeechRecognition.abort()");
        this._clearTimeouts();
        this._listening = false;
        this._shouldRestart = false;
        if (this.onend) {
          window.setTimeout(() => this.onend?.(), 10);
        }
      }
    }

    // Install the mock
    (window as { SpeechRecognition?: unknown }).SpeechRecognition =
      MockSpeechRecognition;
    (window as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
      MockSpeechRecognition;
    console.log("[E2E Mock] Web Speech API (SpeechRecognition) mocked");

    // Signal that mocks are ready
    (window as unknown as { __audioMocksReady: boolean }).__audioMocksReady =
      true;
    console.log("[E2E Mock] Audio mocks initialized and ready");
  }, audioBase64);
}

/**
 * Wait for audio mocks to be ready in the page.
 * Call this after page.goto() to ensure mocks are set up.
 */
export async function waitForAudioMocksReady(
  page: Page,
  timeout = 5000,
): Promise<void> {
  await page.waitForFunction(
    () =>
      (window as unknown as { __audioMocksReady?: boolean }).__audioMocksReady,
    { timeout },
  );
}

/**
 * Inject audio mocks (MediaRecorder, AudioContext, getUserMedia).
 *
 * IMPORTANT: This does NOT mock MoonshineJS itself. ES module imports cannot
 * be intercepted at runtime - the app will use the real MoonshineJS library.
 * This means E2E tests are true integration tests that depend on the Moonshine
 * CDN being available for model downloads.
 *
 * What IS mocked:
 * - navigator.mediaDevices.getUserMedia (returns fake stream)
 * - MediaRecorder (returns test audio blob on stop)
 * - AudioContext (for waveform visualization)
 *
 * What is NOT mocked:
 * - MoonshineJS MicrophoneTranscriber (uses real library)
 * - ONNX model downloads (use page.route() to intercept if needed)
 */
export async function injectAudioMocksWithMoonshine(
  page: Page,
  audioBase64: string,
  moonshineOptions: MoonshineMockOptions = {},
) {
  const {
    transcript = "Test transcript from speech.",
    modelLoadDelay = 100,
    throwError = null,
  } = moonshineOptions;

  await page.addInitScript(
    ({
      audioData,
      speechTranscript,
      loadDelay,
      errorToThrow,
    }: {
      audioData: string;
      speechTranscript: string;
      loadDelay: number;
      errorToThrow: string | null;
    }) => {
      console.log("[E2E Mock] Initializing audio mocks with Moonshine");

      // Store audio data for MediaRecorder mock
      (window as unknown as { __testAudioBase64: string }).__testAudioBase64 =
        audioData;

      // Create fake MediaStream
      function createFakeMediaStream(): MediaStream {
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
      }

      // Ensure mediaDevices exists (may not exist in headless CI)
      if (!navigator.mediaDevices) {
        const mediaDevices = {
          getUserMedia: async (
            constraints?: MediaStreamConstraints,
          ): Promise<MediaStream> => {
            console.log("[E2E Mock] getUserMedia called with:", constraints);
            if (constraints && constraints.audio) {
              return createFakeMediaStream();
            }
            throw new DOMException("Not supported", "NotSupportedError");
          },
          enumerateDevices: async () => [
            {
              deviceId: "default",
              kind: "audioinput",
              label: "Mock Microphone",
              groupId: "default",
            },
          ],
          getSupportedConstraints: () => ({ audio: true, video: true }),
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => true,
          ondevicechange: null,
        };
        Object.defineProperty(navigator, "mediaDevices", {
          value: mediaDevices,
          writable: true,
          configurable: true,
        });
        console.log("[E2E Mock] Created navigator.mediaDevices from scratch");
      } else {
        // mediaDevices exists, override getUserMedia
        const originalGetUserMedia = navigator.mediaDevices.getUserMedia?.bind(
          navigator.mediaDevices,
        );
        navigator.mediaDevices.getUserMedia = async (
          constraints?: MediaStreamConstraints,
        ): Promise<MediaStream> => {
          console.log("[E2E Mock] getUserMedia called with:", constraints);
          if (constraints && constraints.audio) {
            return createFakeMediaStream();
          }
          if (originalGetUserMedia) {
            return originalGetUserMedia(constraints!);
          }
          throw new DOMException("Not supported", "NotSupportedError");
        };
        console.log("[E2E Mock] Overrode existing getUserMedia");
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

          window.setTimeout(() => {
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
          return {
            gain: {
              value: 1.0,
              setValueAtTime: () => {},
              linearRampToValueAtTime: () => {},
            },
            connect: () => {},
            disconnect: () => {},
          } as unknown as GainNode;
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

      // Mock MoonshineJS MicrophoneTranscriber
      class MockMicrophoneTranscriber {
        private _model: string;
        private _callbacks: {
          onTranscriptionCommitted?: (text: string) => void;
          onTranscriptionUpdated?: (text: string) => void;
        };
        private _enableVAD: boolean;
        private _listening = false;
        private _pendingTimeouts: number[] = [];

        constructor(
          model: string,
          callbacks?: {
            onTranscriptionCommitted?: (text: string) => void;
            onTranscriptionUpdated?: (text: string) => void;
          },
          enableVAD?: boolean,
        ) {
          this._model = model;
          this._callbacks = callbacks || {};
          this._enableVAD = enableVAD ?? true;
          console.log(
            "[E2E Mock] MockMicrophoneTranscriber created with model:",
            model,
          );
        }

        async start(): Promise<void> {
          console.log("[E2E Mock] MockMicrophoneTranscriber.start()");

          // Simulate error if configured
          if (errorToThrow) {
            const error = new Error(errorToThrow);
            error.name = "NotAllowedError";
            throw error;
          }

          // Simulate model loading delay
          await new Promise((resolve) => window.setTimeout(resolve, loadDelay));

          this._listening = true;

          // Simulate interim transcript after 500ms
          const interimTimeout = window.setTimeout(() => {
            if (this._listening && this._callbacks.onTranscriptionUpdated) {
              console.log("[E2E Mock] Firing interim transcript");
              this._callbacks.onTranscriptionUpdated(
                speechTranscript.split(" ").slice(0, 2).join(" "),
              );
            }
          }, 500);
          this._pendingTimeouts.push(interimTimeout);

          // Simulate final transcript after 1500ms
          const finalTimeout = window.setTimeout(() => {
            if (this._listening && this._callbacks.onTranscriptionCommitted) {
              console.log("[E2E Mock] Firing committed transcript");
              this._callbacks.onTranscriptionCommitted(speechTranscript);
            }
          }, 1500);
          this._pendingTimeouts.push(finalTimeout);
        }

        stop(): void {
          console.log("[E2E Mock] MockMicrophoneTranscriber.stop()");
          this._listening = false;
          // Clear all pending timeouts
          for (const timeoutId of this._pendingTimeouts) {
            window.clearTimeout(timeoutId);
          }
          this._pendingTimeouts = [];
        }

        isListening(): boolean {
          return this._listening;
        }
      }

      // Store mock for potential use, but note the limitation below
      (
        window as unknown as {
          __MockMicrophoneTranscriber: typeof MockMicrophoneTranscriber;
        }
      ).__MockMicrophoneTranscriber = MockMicrophoneTranscriber;

      // IMPORTANT LIMITATION:
      // This mock CANNOT intercept the real MoonshineJS library because ES module
      // imports are resolved at build time, not runtime. The app's static import:
      //   import * as Moonshine from '@moonshine-ai/moonshine-js'
      // will always use the real library.
      //
      // For E2E tests, this means:
      // - The real MoonshineJS library will be used (integration testing)
      // - Tests depend on the model being downloadable from Moonshine CDN
      // - To fully mock, you would need to intercept network requests via
      //   Playwright's page.route() to mock ONNX model downloads
      //
      // The MediaRecorder and AudioContext mocks above DO work because they
      // replace global browser APIs before the app loads.

      console.log(
        "[E2E Mock] Audio mocks initialized (MoonshineJS uses real library)",
      );

      // Mock Web Speech API (SpeechRecognition)
      // This is critical for e2e tests - without this, the app tries to use the real
      // Web Speech API which may not work properly in headless Chrome
      class MockSpeechRecognition {
        continuous = false;
        interimResults = false;
        lang = "en-US";
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;
        onstart: (() => void) | null = null;
        private _listening = false;
        private _shouldRestart = true;

        start() {
          console.log("[E2E Mock] SpeechRecognition.start()");
          this._listening = true;
          this._shouldRestart = true;

          // Simulate async startup
          window.setTimeout(() => {
            if (this._listening && this.onstart) {
              this.onstart();
            }
          }, 10);

          // Simulate periodic "no-speech" to trigger restart (mimics real behavior)
          window.setTimeout(() => {
            if (this._listening && this._shouldRestart && this.onend) {
              console.log(
                "[E2E Mock] SpeechRecognition auto-ended (simulating)",
              );
              this.onend();
            }
          }, 5000);
        }

        stop() {
          console.log("[E2E Mock] SpeechRecognition.stop()");
          this._listening = false;
          this._shouldRestart = false;
          if (this.onend) {
            window.setTimeout(() => this.onend?.(), 10);
          }
        }

        abort() {
          console.log("[E2E Mock] SpeechRecognition.abort()");
          this._listening = false;
          this._shouldRestart = false;
          if (this.onend) {
            window.setTimeout(() => this.onend?.(), 10);
          }
        }
      }

      // Install the mock
      (window as { SpeechRecognition?: unknown }).SpeechRecognition =
        MockSpeechRecognition;
      (
        window as { webkitSpeechRecognition?: unknown }
      ).webkitSpeechRecognition = MockSpeechRecognition;
      console.log("[E2E Mock] Web Speech API (SpeechRecognition) mocked");

      // Signal that mocks are ready
      (window as unknown as { __audioMocksReady: boolean }).__audioMocksReady =
        true;
      console.log(
        "[E2E Mock] Audio mocks with Moonshine initialized and ready",
      );
    },
    {
      audioData: audioBase64,
      speechTranscript: transcript,
      loadDelay: modelLoadDelay,
      errorToThrow: throwError,
    },
  );
}

// Keep the old interface name for backwards compatibility during transition
export type SpeechRecognitionMockOptions = MoonshineMockOptions;

/**
 * @deprecated Use injectAudioMocksWithMoonshine instead
 * Kept for backwards compatibility during transition
 */
export async function injectAudioMocksWithSpeech(
  page: Page,
  audioBase64: string,
  speechOptions: SpeechRecognitionMockOptions = {},
) {
  return injectAudioMocksWithMoonshine(page, audioBase64, speechOptions);
}
