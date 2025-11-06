export async function sendProsodicAudio(audio: Blob): Promise<{ id: string }> {
  // Stubbed prosodic detector call. Replace with real API integration.
  // Intentionally simulates latency for UX feedback during development.
  // eslint-disable-next-line no-console
  console.log('Prosodic audio stub', audio.type, audio.size);
  await new Promise((resolve) => setTimeout(resolve, 400));
  return { id: crypto.randomUUID() };
}

export async function sendLexicalText(text: string): Promise<{ id: string }> {
  // Stubbed lexical detector call. Replace with real API integration.
  // eslint-disable-next-line no-console
  console.log('Lexical text stub', text);
  await new Promise((resolve) => setTimeout(resolve, 250));
  return { id: crypto.randomUUID() };
}




