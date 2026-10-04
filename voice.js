export async function textToSpeech(text) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: 'eleven_flash_v2_5' }),
    });
    if (!r.ok) throw new Error(`ElevenLabs error ${r.status}: ${await r.text()}`);
    return Buffer.from(await r.arrayBuffer());
}

export async function speechToText(buf, mimeType) {
    const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
    const form = new FormData();
    form.append('model_id', 'scribe_v2');
    form.append('file', new Blob([buf], { type: mimeType }), `speech.${ext}`);
    const r = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY },
        body: form,
    });
    if (!r.ok) throw new Error(`ElevenLabs error ${r.status}: ${await r.text()}`);
    return (await r.json()).text || '';
}