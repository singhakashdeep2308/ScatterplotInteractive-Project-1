import { GoogleGenAI } from '@google/genai';

// Models are tried in order. Override with GEMINI_MODELS in .env, for example:
// GEMINI_MODELS=gemini-3.5-flash-lite,gemini-3.8-flash
const MODEL_CANDIDATES = (process.env.GEMINI_MODELS || 'gemini-3.5-flash-lite,gemini-3.8-flash')
  .split(',').map(s => s.trim()).filter(Boolean);

const SYSTEM_PROMPT = `You are an expert tech-support assistant helping a non-technical user troubleshoot a technical issue.
You may receive a screenshot of one window. Use it to find the exact buttons and messages the user sees.

Rules:
- Speak calmly and clearly, in plain language with no jargon.
- Work in stages. Each reply covers ONE stage with 1 to 3 small actions, then waits for the user to try them.
- If a screenshot is provided, the intro starts with one sentence about what you see on the screen.
- Ask a clarifying question only when necessary. Put it in "intro" and return an empty "actions" list.
- If the problem is unclear, suggest the next best diagnostic step.
- Never ask for passwords or private information. Warn before anything that could delete data. For hardware faults, suggest a technician.

Format:
- "intro": at most 2 sentences.
- Each action has a "title" (an instruction of at most 8 words) and a "detail" (where to click, at most 12 words).
- "stage": estimate the total number of stages for the whole fix (usually 2 to 4). "current" goes up by one each time the user says the last stage worked. If they say it did not work, keep "current" the same and try a different approach.
- "expected": a short phrase saying what the user should see afterwards.
- "spoken": what you would say out loud, at most 40 words, as natural speech with no symbols, arrows or lists.
- When the problem is fixed, use the title "All set", an empty "actions" list, and no "expected".

Reply with ONLY a JSON object in exactly this shape, and nothing else:
{
  "title": "Short heading for this stage",
  "intro": "One or two sentences.",
  "stage": { "current": 1, "total": 3 },
  "actions": [ { "title": "Open Printers and scanners", "detail": "Settings, then Bluetooth and devices" } ],
  "expected": "The status changes to Ready.",
  "spoken": "What to say out loud."
}`;

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

// Remove markdown symbols and extra whitespace.
const clean = (s) => String(s ?? '').replace(/[*#`~]/g, '').replace(/\s+/g, ' ').trim();

// Turn the model's output into a tidy JSON string. If it is not valid JSON, return plain text instead.
function tidy(raw) {
  const text = (raw || '').replace(/```(?:json)?/g, '').trim();
  try {
    const d = JSON.parse(text);
    const total = Math.min(6, Number(d.stage?.total) || 0);
    const out = {
      title: clean(d.title) || 'Here is what to try',
      intro: clean(d.intro),
      stage: total > 0
        ? { current: Math.min(total, Math.max(1, Number(d.stage.current) || 1)), total }
        : undefined,
      actions: (Array.isArray(d.actions) ? d.actions : [])
        .slice(0, 4)
        .map((a) => ({ title: clean(a.title), detail: clean(a.detail) }))
        .filter((a) => a.title),
      expected: clean(d.expected) || undefined,
      spoken: clean(d.spoken).replace(/→/g, ', then'),
    };
    if (!out.spoken) out.spoken = [out.intro, ...out.actions.map((a) => a.title)].filter(Boolean).join('. ');
    return JSON.stringify(out);
  } catch {
    return clean(text);
  }
}

export async function askGemini(messages = []) {
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
          responseMimeType: 'application/json',
          temperature: 0.4,
        },
      });

      return tidy(response.text) || 'I could not generate a response right now.';
    } catch (error) {
      lastError = error;
      const message = error?.message || '';
      const isUnavailable = /UNAVAILABLE|NOT_FOUND|RESOURCE_EXHAUSTED|503|429|404|high demand/.test(message);
      if (!isUnavailable) {
        throw error;
      }
      console.warn(`Model ${model} failed, trying the next one:`, message.slice(0, 120));
    }
  }

  throw lastError || new Error('Gemini request failed.');
}
