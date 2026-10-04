# Over-the-Shoulder: Voice Support Helper

A voice-activated tech-support helper built for a hackathon. The user describes a problem and can share their screen. Google's Gemini reads the screenshot and provides a step-by-step fix, one step at a time, while ElevenLabs speaks each step aloud to the user.

*Note: The project idea and workflow are based on the specifications outlined in "Project.pdf".*

## Tech Stack

- Backend: Node.js with Express
- Frontend: Plain HTML and JavaScript
- AI Integration: `@google/genai` (Gemini API for text and vision)
- Voice Integration: ElevenLabs API (Text-to-Speech and optional Speech-to-Text)

## Getting Started

### 1. Prerequisites

- Node.js (v18 or newer)
- API keys for Google AI Studio (Gemini) and ElevenLabs

### 2. Installation

Clone the repository and install the dependencies:

```bash
npm install
```

Required packages include:

- `express`
- `@google/genai`
- `dotenv`

### 3. Environment Variables

Create a `.env` file in the project root and add the following values:

```env
GEMINI_API_KEY=your_gemini_api_key
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=your_elevenlabs_voice_id
```

Do not commit this file to GitHub.

### 4. Running the Application

Start the development server:

```bash
npm run dev
```

Then open the app in your browser at:

```text
http://localhost:3000
```

> Do not use the editor preview server, because screen capture and microphone APIs require localhost or HTTPS.

## Architecture & Project Structure

- `public/index.html`: Frontend user interface for screen capture, microphone input, and API communication. Use `/?mock=1` to test the UI with canned responses.
- `server.js`: Express backend for routes, validation, error handling, caching, and health checks.
- `ai.js`: Gemini integration, prompt engineering, and scenario testing.
- `voice.js`: ElevenLabs Text-to-Speech and Speech-to-Text logic.

## API Contract

The frontend and backend communicate using the following contract. Any failure should return a non-200 status code and a readable JSON error like:

```json
{ "error": "readable message" }
```

### 1. Ask AI for Help

Endpoint:

```http
POST /api/ask
```

Request body:

```json
{
  "messages": [
    {
      "role": "user | model",
      "text": "User's query or model's response",
      "image": "base64_string"
    }
  ]
}
```

Notes:

- `image` is optional.
- Only the last user message may include an image.
- The image should be base64 JPEG data without the `data:image/jpeg;base64,` prefix.

Response:

```json
{ "reply": "AI response text" }
```

### 2. Text-to-Speech

Endpoint:

```http
POST /api/speak
```

Request body:

```json
{ "text": "Text to speak" }
```

Response:

- raw MP3 audio data returned as `audio/mpeg`

### 3. Speech-to-Text (Stretch Goal)

Endpoint:

```http
POST /api/transcribe
```

Headers:

```http
Content-Type: audio/webm
```

or:

```http
Content-Type: audio/mp4
```

Request body:

- raw audio bytes

Response:

```json
{ "text": "Transcribed text" }
```

### 4. Health Check

Endpoint:

```http
GET /api/health
```

Response:

- standard 200 OK for uptime monitoring

## Internal Functions

To support parallel development, the project uses the following internal function contracts:

- `askGemini(messages)` in `ai.js`
  - accepts the messages array
  - converts it to the Gemini format
  - appends the system prompt
  - handles image input and vision requirements
  - returns plain-text AI guidance

- `textToSpeech(text)` in `voice.js`
  - accepts a text string
  - calls ElevenLabs
  - returns a `Buffer` of MP3 bytes

- `speechToText(buffer, mimeType)` in `voice.js`
  - accepts an audio buffer and MIME type
  - calls ElevenLabs Scribe
  - returns the transcribed text

## Privacy Approach

- The user explicitly chooses what window or screen to share.
- A screenshot is only captured and sent at the exact moment the user decides to send a message.
- A clear Stop button ends screen sharing immediately.

## Development Tasks & Work Split

- Person A (AI): Build `ai.js`, craft the support system prompt, handle Gemini message mapping, especially inline image data, and create `test-scenarios.js`.
- Person B (Server/Voice): Build `server.js` and `voice.js`, set up Express routes, payload limits, error handling, ElevenLabs calls, and an in-memory hash cache for TTS audio to reduce API usage.

## Notes

This project is a strong hackathon build because it combines:

- AI-powered troubleshooting
- browser screen capture
- text-to-speech narration
- optional speech-to-text input
- fast, user-friendly support flow

It demonstrates how generative AI can guide users through technical issues in real time, especially when they need one-step-at-a-time instructions.
