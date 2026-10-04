const path = require('path');
const dotenv = require('dotenv');
const { GoogleGenAI } = require('@google/genai');

dotenv.config({ path: path.join(__dirname, '.env') });

const MODEL_CANDIDATES = ['gemini-3.8-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

const SYSTEM_PROMPT = `You are an expert tech-support assistant helping a user troubleshoot a technical issue.

Rules:
- Speak calmly and clearly.
- Give one actionable step at a time.
- If a screenshot is provided, use it to reason about the issue.
- Ask clarifying questions only when necessary.
- Keep the guidance concise and beginner-friendly.
- Do not overwhelm the user with many steps at once.
- If the problem is unclear, suggest the next best diagnostic step.
- Structure the answer as a short troubleshooting step with simple instructions.`;

function buildContents(messages = []) {
  return messages.map((message) => {
    const role = message.role === 'model' ? 'model' : 'user';
    const parts = [];

    if (message.text) {
      parts.push({ text: message.text });
    }

    if (message.image) {
      parts.push({
        inlineData: {
          mimeType: 'image/jpeg',
          data: message.image,
        },
      });
    }

    return { role, parts };
  });
}

async function askGemini(messages = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is missing. Add it to .env in this folder.');
  }

  const ai = new GoogleGenAI({ apiKey });

  let lastError;

  for (const model of MODEL_CANDIDATES) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: buildContents(messages),
        config: {
          systemInstruction: SYSTEM_PROMPT,
        },
      });

      return response.text || 'I could not generate a response right now.';
    } catch (error) {
      lastError = error;
      const message = error?.message || '';
      const isUnavailable = /UNAVAILABLE|NOT_FOUND|RESOURCE_EXHAUSTED|429|404/.test(message);
      if (!isUnavailable) {
        throw error;
      }
    }
  }

  throw lastError || new Error('Gemini request failed.');
}

if (require.main === module) {
  askGemini([
    { role: 'user', text: 'I need a quick explanation of how AI works in a few words.' },
  ])
    .then((reply) => {
      console.log(reply);
    })
    .catch((error) => {
      console.error('Gemini error:', error.message);
      process.exit(1);
    });
}

module.exports = { askGemini };
