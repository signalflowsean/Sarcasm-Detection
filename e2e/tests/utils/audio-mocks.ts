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

export interface SpeechRecognitionMockOptions {
  supported?: boolean;
  error?: string | null;
  noSpeechCount?: number;
  transcript?: string;
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
  }, audioBase64);
}

/**
 * Inject audio mocks with SpeechRecognition support.
 * Use this for mobile audio recording tests that need speech recognition.
 */
export async function injectAudioMocksWithSpeech(
  page: Page,
  audioBase64: string,
  speechOptions: SpeechRecognitionMockOptions = {},
) {
  const {
    supported = true,
    error = null,
    noSpeechCount = 0,
    transcript = "Test transcript from speech.",
  } = speechOptions;

  await page.addInitScript(
    ({
      audioData,
      speechSupported,
      speechError,
      speechNoSpeechCount,
      speechTranscript,
    }: {
      audioData: string;
      speechSupported: boolean;
      speechError: string | null;
      speechNoSpeechCount: number;
      speechTranscript: string;
    }) => {
      console.log(
        "[E2E Mock] Initializing audio mocks with speech recognition",
      );

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

      // Mock SpeechRecognition
      // Note: We always create a mock class because Chromium's native SpeechRecognition
      // cannot be reliably removed. Instead, we make the mock throw errors when unsupported.
      let noSpeechCounter = 0;

      class MockSpeechRecognition {
        interimResults = false;
        continuous = false;
        maxAlternatives = 1;
        lang = "en-US";
        onresult: ((event: unknown) => void) | null = null;
        onerror: ((event: unknown) => void) | null = null;
        onend: (() => void) | null = null;

        private _started = false;
        private _timeout: number | null = null;

        start() {
          // If speech recognition is not supported, fire an error immediately
          // This simulates devices where the API exists but doesn't work
          if (!speechSupported) {
            console.log(
              "[E2E Mock] SpeechRecognition.start() - UNSUPPORTED, firing service-not-allowed error",
            );
            // Fire error asynchronously to match real behavior
            window.setTimeout(() => {
              console.log("[E2E Mock] Firing service-not-allowed error now");
              if (this.onerror) {
                this.onerror({ error: "service-not-allowed" });
              }
              if (this.onend) {
                this.onend();
              }
            }, 10);
            return;
          }

          if (this._started) {
            console.warn("[E2E Mock] SpeechRecognition already started");
            return;
          }
          console.log(
            "[E2E Mock] SpeechRecognition.start() - continuous:",
            this.continuous,
          );
          this._started = true;

          // Simulate mobile behavior: ends after a short time in non-continuous mode
          const duration = this.continuous ? 5000 : 2000;

          this._timeout = window.setTimeout(() => {
            if (!this._started) return;

            // If configured to throw error, do that
            if (speechError && this.onerror) {
              console.log("[E2E Mock] Firing speech error:", speechError);
              this.onerror({ error: speechError });
              this._started = false;
              if (this.onend) this.onend();
              return;
            }

            // Simulate no-speech errors (common on mobile)
            if (
              speechNoSpeechCount > 0 &&
              noSpeechCounter < speechNoSpeechCount
            ) {
              noSpeechCounter++;
              console.log(
                `[E2E Mock] Firing no-speech error (${noSpeechCounter}/${speechNoSpeechCount})`,
              );
              if (this.onerror) {
                this.onerror({ error: "no-speech" });
              }
              this._started = false;
              if (this.onend) this.onend();
              return;
            }

            // Otherwise, simulate getting a result
            if (this.onresult) {
              console.log("[E2E Mock] Firing speech result");
              this.onresult({
                resultIndex: 0,
                results: [
                  {
                    isFinal: true,
                    0: { transcript: speechTranscript },
                    length: 1,
                  },
                ],
              });
            }

            // In non-continuous mode (mobile), recognition ends after each result
            if (!this.continuous) {
              this._started = false;
              if (this.onend) this.onend();
            }
          }, duration);
        }

        stop() {
          console.log("[E2E Mock] SpeechRecognition.stop()");
          if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
          }
          this._started = false;
          if (this.onend) this.onend();
        }

        abort() {
          this.stop();
        }
      }

      // Store the mock in a variable that our getters will return
      // Use getters to intercept ALL access to these properties
      // This prevents Chromium from restoring the native implementation
      const mockCtor = MockSpeechRecognition;

      // Delete existing properties first to avoid conflicts
      try {
        delete (window as Record<string, unknown>).SpeechRecognition;
        delete (window as Record<string, unknown>).webkitSpeechRecognition;
      } catch {
        // May fail if properties are non-configurable, continue anyway
      }

      // When speech is unsupported, return undefined so the app sees no SR API
      // When supported, return the mock class
      const getterValue = speechSupported ? mockCtor : undefined;

      Object.defineProperty(window, "SpeechRecognition", {
        get: () => getterValue,
        set: () => {
          /* ignore attempts to set */
        },
        configurable: true,
      });
      Object.defineProperty(window, "webkitSpeechRecognition", {
        get: () => getterValue,
        set: () => {
          /* ignore attempts to set */
        },
        configurable: true,
      });

      console.log(
        "[E2E Mock] SpeechRecognition mocked with getters, support=",
        speechSupported,
        ", error=",
        speechError,
        ", noSpeechCount=",
        speechNoSpeechCount,
      );
    },
    {
      audioData: audioBase64,
      speechSupported: supported,
      speechError: error,
      speechNoSpeechCount: noSpeechCount,
      speechTranscript: transcript,
    },
  );
}
