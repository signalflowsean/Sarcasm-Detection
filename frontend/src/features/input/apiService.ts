export async function sendProsodicAudio(audio: Blob): Promise<{ id: string }> {
  // Stubbed prosodic detector call. Replace with real API integration.
  // Intentionally simulates latency for UX feedback during development.
  // IMPORTANT: Remove console.log statements when implementing real API to avoid leaking sensitive user data.
  console.log('Prosodic audio stub', audio.type, audio.size);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { id: crypto.randomUUID() };
}

export async function sendLexicalText(text: string): Promise<{ id: string }> {
  // Stubbed lexical detector call. Replace with real API integration.
  // IMPORTANT: Remove console.log statements when implementing real API to avoid leaking sensitive user data.
  console.log('Lexical text stub', text);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return { id: crypto.randomUUID() };
}




