import { MOCK_RESPONSE_DELAY_MS } from '../meter/meterConstants';

/**
 * Generate a mock sarcasm score between 0 and 1
 * Centralized for easy modification of distribution in the future
 */
export function generateMockScore(): number {
  return Math.random();
}

export type ProsodicResponse = {
  id: string;
  value: number; // 0.0–1.0 inclusive
};

export type LexicalResponse = {
  id: string;
  value: number; // 0.0–1.0 inclusive
};

export async function sendProsodicAudio(audio: Blob): Promise<ProsodicResponse> {
  // Stubbed prosodic detector call. Replace with real API integration.
  // Intentionally simulates latency for UX feedback during development.
  // eslint-disable-next-line no-console
  console.log('Prosodic audio stub', audio.type, audio.size);
  await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
  return { 
    id: crypto.randomUUID(),
    value: generateMockScore(),
  };
}

export async function sendLexicalText(text: string): Promise<LexicalResponse> {
  // Stubbed lexical detector call. Replace with real API integration.
  // eslint-disable-next-line no-console
  console.log('Lexical text stub', text);
  await new Promise((resolve) => setTimeout(resolve, MOCK_RESPONSE_DELAY_MS));
  return { 
    id: crypto.randomUUID(),
    value: generateMockScore(),
  };
}




