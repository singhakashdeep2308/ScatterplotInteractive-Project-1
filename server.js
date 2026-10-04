import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import { askGemini } from './ai.js';
import { textToSpeech, speechToText } from './voice.js';

const app = express();
app.use(express.json({ limit: '10mb' })); // large limit is needed for screenshots
app.use(express.static('public'));

// Log every request with its status and how long it took.
app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
});

const sleep = ms => new Promise(r => setTimeout(r, ms));
const isBusy = e => /503|UNAVAILABLE|429|high demand/i.test(e?.message || '');

// Retry when Gemini is overloaded or rate limited (waits 1s, then 2s).
async function askWithRetry(messages, tries = 3) {
    for (let i = 0; i < tries; i++) {
        try {
            return await askGemini(messages);
        } catch (e) {
            if (!isBusy(e) || i === tries - 1) throw e;
            await sleep(1000 * 2 ** i);
        }
    }
}

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/ask', async (req, res) => {
    try {
        const { messages } = req.body;
        const valid = Array.isArray(messages) && messages.length > 0 &&
            messages.every(m =>
                (m.role === 'user' || m.role === 'model') &&
                typeof m.text === 'string' && m.text.trim() &&
                (m.image === undefined || typeof m.image === 'string'));
        if (!valid || messages[messages.length - 1].role !== 'user') {
            return res.status(400).json({ error: 'Invalid messages.' });
        }
        res.json({ reply: await askWithRetry(messages) });
    } catch (e) {
        console.error(e);
        const busy = isBusy(e);
        res.status(busy ? 503 : 500).json({
            error: busy ? 'The AI is busy right now. Try again in a few seconds.' : e.message,
        });
    }
});

// Remember recent audio so repeated lines don't use up ElevenLabs credits.
const audioCache = new Map();
const MAX_CACHED = 50;

app.post('/api/speak', async (req, res) => {
    try {
        const { text } = req.body;
        if (typeof text !== 'string' || !text.trim()) {
            return res.status(400).json({ error: 'Missing text to speak.' });
        }
        const key = crypto.createHash('sha256').update(text).digest('hex');
        let audio = audioCache.get(key);
        if (!audio) {
            audio = await textToSpeech(text);
            if (audioCache.size >= MAX_CACHED) audioCache.delete(audioCache.keys().next().value);
            audioCache.set(key, audio);
        }
        res.set('Content-Type', 'audio/mpeg');
        res.send(audio);
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'The voice service failed. Try again.' });
    }
});

// The page sends the recording as raw audio bytes. The Content-Type says which format.
app.post('/api/transcribe', express.raw({ type: '*/*', limit: '15mb' }), async (req, res) => {
    try {
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
            return res.status(400).json({ error: 'No audio received.' });
        }
        const text = await speechToText(req.body, req.headers['content-type'] || 'audio/webm');
        res.json({ text });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Could not transcribe that. Try again.' });
    }
});

app.listen(3000, () => console.log('http://localhost:3000'));