# Elniv

Elniv is a calm AI companion for reflection and clearer thinking. This repository is the web app; it talks to the [Elniv API](https://github.com/elniv/elniv-backend) (FastAPI) and to Supabase Auth.

Contact: yoitselniv@gmail.com

## What's in the app

- Sign up, sign in, password reset, email-confirmation links, account settings (name, password)
- First-run onboarding
- Chat with conversation history (rename, delete, delete all), Markdown replies, retry on failed sends, read-aloud
- Voice messages: record in the browser, review and play back, transcribe into the composer (audio is not stored)
- Check-ins (mood, focus area, note) with history, a trend line and "Talk about this" into chat
- Settings: theme, reduced motion, bring-your-own model and API key (OpenRouter, OpenAI, Gemini, Groq), voice status, data controls
- Light and dark themes, responsive down to small phones, keyboard and screen-reader support

## Stack

React 19 + TypeScript, bundled with esbuild (no framework, no router or state library: a small History-API router and React context). Styling is a single hand-written stylesheet driven by design tokens (`src/styles/global.css`). Runtime dependencies: `react`, `react-dom`.

The logo lives in one file, `src/assets/brand/elniv-mark.svg`. Every use in the app imports that file, the favicon is copied from it at build time, and `npm run icons` regenerates the PNG app icons in `public/icons`.

## Local setup

Requirements: Node 20+ and a running Elniv API.

```bash
npm install
cp .env.example .env     # fill in the three values
npm run dev              # http://localhost:3000
```

## Environment variables

Read at **build time** and embedded in the bundle, so they are public. Never put secrets here.

| Variable | Purpose |
| --- | --- |
| `ELNIV_API_URL` | Base URL of the Elniv API, no trailing slash and no `/api/v1` |
| `ELNIV_SUPABASE_URL` | Your Supabase project URL |
| `ELNIV_SUPABASE_ANON_KEY` | The Supabase **anon (public)** key. Never use the service-role key |

If any is missing, the app shows a configuration screen instead of a broken UI.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server with rebuild on change (port 3000) |
| `npm run build` | Production build to `dist/` (minified, hashed assets, code-split routes) |
| `npm run preview` | Serve `dist/` locally with SPA fallback |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Node's built-in test runner) |
| `npm run icons` | Regenerate PNG icons from the SVG mark |

## Deployment

`dist/` is a static single-page app. Host it anywhere that serves `index.html` for unknown paths: `public/_redirects` + `_headers` cover Netlify and Cloudflare Pages, and `vercel.json` covers Vercel. Set the three variables in the host's build settings, build with `npm run build`, publish `dist`.

Then, **on the API**, set `CORS_ORIGINS` to the exact origin of the deployed site (for example `https://app.example.com`). Wildcards are rejected by the API. In Supabase, add the site URL and `https://<your-site>/reset-password` to *Authentication → URL Configuration* so confirmation and reset emails link back correctly.

## Backend integration

Auth is Supabase: the browser signs in against Supabase Auth directly and sends the resulting access token as `Authorization: Bearer …` to the API, refreshing it before expiry and once more on a 401. The API contract used (all under `/api/v1`):

- `POST /chat/stream` (Server-Sent Events: `delta`, `done`, `error`); `POST /chat/` is the non-streaming fallback used when the server has no stream route
- `GET /conversations/`, `PATCH|DELETE /conversations/{id}`, `GET /conversations/{id}/messages`
- `GET|POST /checkins/`, `DELETE /checkins/{id}`
- `GET|PUT|DELETE /llm-settings/`, `GET /llm-settings/providers`
- `GET /voice/status`, `POST /voice/transcribe` (multipart `audio`)

`POST /chat/stream`, `GET /conversations/{id}/messages`, the `/voice/*` routes, CORS and the `has_api_key` field on LLM settings were added to the API alongside this app, so deploy the matching backend version.

## Voice

Recording uses `MediaRecorder` and the microphone permission prompt. The clip is uploaded to the API, transcribed by a speech-to-text provider (Groq or OpenAI), and the text is placed in the composer for you to edit and send. Audio is never stored. Voice turns on automatically when the server has `TRANSCRIPTION_API_KEY` set, or when the user saved their own OpenAI/Groq key in Settings; otherwise the mic button explains that voice isn't set up. Browsers without `MediaRecorder` get the same explanation and typing keeps working.

## Known limits

- Replies stream in as they're generated. If the connection drops mid-reply, the partial text is discarded (the server saves a turn only when the reply completes) and the message shows Retry.
- Voice needs a transcription key and a browser with `MediaRecorder`; read-aloud uses the browser's speech synthesis and needs no key.
- There are no standalone Privacy or Terms pages, so none are linked. The About page states what is stored.
