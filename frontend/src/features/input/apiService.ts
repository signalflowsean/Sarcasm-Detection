export async function sendProsodicAudio(audio: Blob): Promise<{ id: string }> {
  // Stubbed prosodic detector call. Replace with real API integration.
  // Intentionally simulates latency for UX feedback during development.
  // TODO: Remove console.log when implementing real API - logs may contain sensitive audio data
  console.log('Prosodic audio stub', audio.type, audio.size);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { id: crypto.randomUUID() };
}

export async function sendLexicalText(text: string): Promise<{ id: string }> {
  // Stubbed lexical detector call. Replace with real API integration.
  // TODO: Remove console.log when implementing real API - logs may contain sensitive user text
  console.log('Lexical text stub', text);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return { id: crypto.randomUUID() };
}




