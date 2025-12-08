/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

// Version constants injected by Vite at build time
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;

// View Transitions API types
interface ViewTransition {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition(): void
}

interface Document {
  startViewTransition?(callback: () => void | Promise<void>): ViewTransition
}
