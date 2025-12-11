/**
 * Audio mocks for testing.
 *
 * Cross-environment functions (Node.js + Browser):
 * - generateWavBytes() - Returns Uint8Array
 * - generateWavBase64() - Returns base64 string (uses Buffer in Node, btoa in browser)
 *
 * Browser-only functions (require DOM APIs):
 * - createWavBlob() - Uses Blob API
 * - createFakeMediaStream() - MediaStream mock
 * - createMockAudioContext() - AudioContext mock
 * - createMockMediaRecorder() - MediaRecorder mock (uses Blob)
 * - createMockSpeechRecognition() - SpeechRecognition mock (uses window)
 *
 * For Node.js file utilities, see audio-node.ts instead.
 */

/**
 * Audio configuration for WAV generation
 */
export interface WavConfig {
  sampleRate?: number;
  duration?: number;
  frequency?: number;
  amplitude?: number;
}

const DEFAULT_WAV_CONFIG: Required<WavConfig> = {
  sampleRate: 16000,
  duration: 0.5,
  frequency: 440,
  amplitude: 0.3,
};

/**
 * Generate a minimal valid WAV file as a Uint8Array.
 * Works in both Node.js and browser environments.
 */
export function generateWavBytes(config: WavConfig = {}): Uint8Array {
  const { sampleRate, duration, frequency, amplitude } = {
    ...DEFAULT_WAV_CONFIG,
    ...config,
  };

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

  // Generate samples
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sample =
      frequency > 0
        ? Math.floor(Math.sin(2 * Math.PI * frequency * t) * amplitude * 32767)
        : 0;
    view.setInt16(44 + i * 2, sample, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * Generate a WAV file as base64 string.
 * Works in both Node.js and browser environments.
 */
export function generateWavBase64(config?: WavConfig): string {
  const bytes = generateWavBytes(config);

  // Use Buffer in Node.js, btoa in browser
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }

  // Browser fallback
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Create a Blob from WAV bytes.
 * @browser This function requires the Blob API (browser-only).
 * For Node.js, use generateWavBytes() and convert with Buffer.
 */
export function createWavBlob(config?: WavConfig): Blob {
  const bytes = generateWavBytes(config);
  // Type assertion is safe here because generateWavBytes creates an ArrayBuffer
  return new Blob([bytes.buffer as ArrayBuffer], { type: "audio/wav" });
}

/**
 * Create a fake MediaStream for testing.
 * @browser This function mocks browser MediaStream API.
 */
export function createFakeMediaStream(): MediaStream {
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

/**
 * Create a mock AudioContext for testing.
 * @browser This function mocks browser AudioContext API.
 */
export function createMockAudioContext() {
  return class MockAudioContext {
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
  };
}

/**
 * Create a mock MediaRecorder for testing.
 * @browser This function mocks browser MediaRecorder API (uses Blob internally).
 */
export function createMockMediaRecorder(audioBase64: string) {
  return class MockMediaRecorder {
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
        const binaryString = atob(audioBase64);
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
  };
}

/**
 * Configuration for mock MoonshineJS MicrophoneTranscriber.
 */
export interface MoonshineMockConfig {
  /** Transcript to return */
  transcript?: string;
  /** Simulated model loading delay in ms */
  modelLoadDelay?: number;
  /** Error to throw on start */
  throwError?: string | null;
}

/**
 * Create a mock MoonshineJS MicrophoneTranscriber for testing.
 * @browser This function mocks the MoonshineJS library (uses window.setTimeout).
 */
export function createMockMicrophoneTranscriber(
  config: MoonshineMockConfig = {}
) {
  const {
    transcript = "Mock transcript from Moonshine.",
    modelLoadDelay = 100,
    throwError = null,
  } = config;

  return class MockMicrophoneTranscriber {
    // Using underscore prefix convention for internal properties.
    // TypeScript errors on `private` because the class type is inferred as part
    // of the exported function's return type, exposing private members in the API.
    // Could use ES2022 `#` private fields, but underscore is sufficient for mocks.
    _model: string;
    _callbacks: {
      onTranscriptionCommitted?: (text: string) => void;
      onTranscriptionUpdated?: (text: string) => void;
    };
    _enableVAD: boolean;
    _listening = false;
    _pendingTimeouts: number[] = [];

    constructor(
      model: string,
      callbacks?: {
        onTranscriptionCommitted?: (text: string) => void;
        onTranscriptionUpdated?: (text: string) => void;
      },
      enableVAD?: boolean
    ) {
      this._model = model;
      this._callbacks = callbacks || {};
      this._enableVAD = enableVAD ?? true;
    }

    async start(): Promise<void> {
      if (throwError) {
        const error = new Error(throwError);
        error.name = "NotAllowedError";
        throw error;
      }

      // Simulate model loading delay
      await new Promise((resolve) => setTimeout(resolve, modelLoadDelay));

      this._listening = true;

      // Simulate interim transcript
      const interimTimeout = window.setTimeout(() => {
        if (this._listening && this._callbacks.onTranscriptionUpdated) {
          this._callbacks.onTranscriptionUpdated(
            transcript.split(" ").slice(0, 2).join(" ")
          );
        }
      }, 500);
      this._pendingTimeouts.push(interimTimeout);

      // Simulate final transcript
      const finalTimeout = window.setTimeout(() => {
        if (
          this._listening &&
          this._callbacks.onTranscriptionCommitted &&
          transcript.trim()
        ) {
          this._callbacks.onTranscriptionCommitted(transcript);
        }
      }, 1500);
      this._pendingTimeouts.push(finalTimeout);
    }

    stop(): void {
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
  };
}

/**
 * @deprecated
 * Use MoonshineMockConfig with createMockMicrophoneTranscriber instead.
 * Migration guide:
 * - `transcript` → same
 * - `error` → `throwError`
 * - `supported` → no equivalent (MoonshineJS always works in all browsers, as it is implemented in JavaScript/WASM)
 * - `noSpeechCount` → no equivalent (Moonshine uses VAD, not speech events)
 *
 * Note:
 * - In MoonshineJS, browser support is no longer a concern; the mock always works regardless of browser capabilities.
 * - You can only simulate runtime errors (such as network/model download failures) using the `throwError` option in MoonshineMockConfig.
 * - Simulating the absence of the Web Speech API (`supported: false`) is not applicable, as MoonshineJS does not depend on browser APIs.
 * - To simulate mobile speech recognition timeout behavior (`noSpeechCount`), there is currently no equivalent in MoonshineJS, as VAD is disabled and no-speech events are not generated.
 * - These edge cases are no longer testable at the mock level with MoonshineJS. Consider testing them at a higher integration level if needed.
 */
export interface SpeechRecognitionMockConfig {
  /** Whether to support speech recognition */
  supported?: boolean;
  /** Error to throw (e.g., 'not-allowed', 'network', 'no-speech') */
  error?: string | null;
  /** Number of no-speech errors before returning results */
  noSpeechCount?: number;
  /** Transcript to return */
  transcript?: string;
}

/**
 * @deprecated
 * Use createMockMicrophoneTranscriber instead. Kept for backwards compatibility.
 * Create a mock SpeechRecognition for testing.
 * @browser This function mocks browser SpeechRecognition API (uses window.setTimeout).
 */
export function createMockSpeechRecognition(
  config: SpeechRecognitionMockConfig = {}
) {
  const {
    supported = true,
    error = null,
    noSpeechCount = 0,
    transcript = "Mock transcript from speech recognition.",
  } = config;

  if (!supported) {
    return null;
  }

  let noSpeechCounter = 0;

  return class MockSpeechRecognition {
    interimResults = false;
    continuous = false;
    maxAlternatives = 1;
    lang = "en-US";
    onresult: ((event: unknown) => void) | null = null;
    onerror: ((event: unknown) => void) | null = null;
    onend: (() => void) | null = null;

    /** @internal */ _started = false;
    /** @internal */ _timeout: number | null = null;

    start() {
      if (this._started) return;
      this._started = true;

      const duration = this.continuous ? 5000 : 2000;

      this._timeout = window.setTimeout(() => {
        if (!this._started) return;

        if (error && this.onerror) {
          this.onerror({ error });
          this._started = false;
          if (this.onend) this.onend();
          return;
        }

        if (noSpeechCount > 0 && noSpeechCounter < noSpeechCount) {
          noSpeechCounter++;
          if (this.onerror) {
            this.onerror({ error: "no-speech" });
          }
          this._started = false;
          if (this.onend) this.onend();
          return;
        }

        if (this.onresult) {
          this.onresult({
            resultIndex: 0,
            results: [
              {
                isFinal: true,
                0: { transcript },
                length: 1,
              },
            ],
          });
        }

        if (!this.continuous) {
          this._started = false;
          if (this.onend) this.onend();
        }
      }, duration);
    }

    stop() {
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
  };
}
