const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

const { askGemini } = require('./ai');
const { textToSpeech } = require('./voice');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/ask', async (req, res) => {
  try {
    const { messages } = req.body || {};

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    const reply = await askGemini(messages);
    return res.json({ reply });
  } catch (error) {
    console.error('Ask error:', error);
    return res.status(500).json({ error: error.message || 'Failed to get AI help.' });
  }
});

app.post('/api/speak', async (req, res) => {
  try {
    const { text } = req.body || {};

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text is required' });
    }

    const audioBuffer = await textToSpeech(text);
    res.setHeader('Content-Type', 'audio/mpeg');
    return res.send(audioBuffer);
  } catch (error) {
    console.error('Speak error:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate speech.' });
  }
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Endpoint not found' });
  }

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
