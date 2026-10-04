async function textToSpeech(text) {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is missing. Add it to .env in this folder.');
  }

  if (!process.env.ELEVENLABS_VOICE_ID) {
    throw new Error('ELEVENLABS_VOICE_ID is missing. Add it to .env in this folder.');
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.7,
      },
    }),
  });

  if (!response.ok) {
    const textError = await response.text();
    throw new Error(`ElevenLabs TTS failed: ${textError}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function speechToText(buffer, mimeType = 'audio/webm') {
  if (!process.env.ELEVENLABS_API_KEY) {
    throw new Error('ELEVENLABS_API_KEY is missing. Add it to .env in this folder.');
  }

  const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': mimeType,
    },
    body: buffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`ElevenLabs transcription failed: ${errorText}`);
  }

  const result = await response.json();
  return result.text || '';
}

module.exports = { textToSpeech, speechToText };
