# Cybuddy — Your Campus Buddy, For Every Student

**Voice-first, screen-reader-native, accessibility-built campus companion for Iowa State University.** One voice asks the question, and Canvas, Outlook, CyRide, and Workday answer.

Built so no student gets left behind navigating ISU — including blind, low-vision, dyslexic, ADHD, and chronic-illness students who deserve the same effortless campus experience as everyone else.

## What Cybuddy does

- **Just ask Cy.** Tap the floating mic on any tab. Cy answers questions grounded in your live data — *"What's due this week?"*, *"Anything important in my inbox?"*, *"What CyRide buses are running right now?"*, *"What do I need to do in Workday?"* The backend pulls live context from all four services in parallel before every reply, so Cy never makes things up.
- **Vision tab.** Live camera preview with auto-describe. Point your phone at anything — a CyRide bus pulling up, a syllabus page, a building entrance — and Cy describes it out loud every few seconds. Or tap **Describe once** for a single look. Built for blind and low-vision students.
- **Plain-English mode.** Ask Cy to rewrite a confusing email or syllabus in clear, scannable language. Built for dyslexia, ADHD, and ESL students.
- **Screen-reader native.** Every screen, every button, every state has `accessibilityLabel` + `accessibilityHint`. The Vision description panel uses an `accessibilityLiveRegion` so VoiceOver announces new descriptions automatically.
- **Consolidated dashboard.** Canvas assignments, Outlook calendar + email, CyRide live routes, Workday notifications + holds — all in one place. Reduces app-switching cognitive load.

## Architecture

A Turborepo monorepo:

- **`apps/backend`** — Node.js + Express API. JWT auth, OAuth wrappers for Microsoft Graph (Outlook), Canvas LMS, Workday, plus a live CyRide feed. Voice and vision routes call Cloudflare Workers AI through a personal proxy worker.
- **`apps/mobile`** — React Native + Expo (SDK 54). TypeScript. Voice assistant, Vision tab with live camera, full accessibility props on every interactive element.
- **`packages/shared`** — Common TypeScript types, OAuth config constants.

## Tech stack

| Layer | What |
|---|---|
| Voice reasoning | **Moonshot Kimi K2.6** on Cloudflare Workers AI (1T params, 262k context, multimodal, reasoning) |
| Vision | Same Kimi K2.6 with `image_url` content blocks |
| Speech-to-text | **Whisper Large v3 Turbo** on Groq (~164× realtime) |
| Text-to-speech | **`@cf/myshell-ai/melotts`** on Cloudflare Workers AI (free tier) |
| Mobile | React Native, Expo SDK 54, expo-camera, expo-image-manipulator, expo-av, expo-secure-store |
| Backend | Node.js, Express, TypeScript, JWT auth, axios |
| Monorepo | Turborepo, pnpm workspaces |

## Getting started

### Prerequisites

- Node.js 18+ and pnpm
- Expo Go on your iPhone or Android (or a custom dev client for wake-word features)
- A Cloudflare Workers AI proxy worker (the [`originx-ai-proxy`](apps/backend/src/services/cloudflareAI.ts) shape — accepts `POST /v1/ai/run/<model>` with bearer auth)
- Optional: Microsoft tenant for real OAuth (dev-bypass mode works without it)

### Install

```bash
git clone https://github.com/savanasunilkumar/cybuddy.git
cd cybuddy
pnpm install
```

### Configure environment

Backend (`apps/backend/.env`):

```bash
NODE_ENV=development
PORT=3001
JWT_SECRET=fallback-secret-change-in-production
ENABLE_DEV_AUTH_BYPASS=true

# Cloudflare AI proxy (required for voice + vision)
AI_PROXY_URL=https://your-proxy-worker.workers.dev
AI_PROXY_TOKEN=your-shared-bearer-token
AI_MODEL=@cf/moonshotai/kimi-k2.6

# Optional — real OAuth instead of dev bypass
MICROSOFT_CLIENT_ID=
MICROSOFT_CLIENT_SECRET=
MICROSOFT_TENANT_ID=
CANVAS_BASE_URL=https://canvas.iastate.edu
CANVAS_API_KEY=
```

Mobile (`apps/mobile/.env`):

```bash
EXPO_PUBLIC_GROQ_API_KEY=your-groq-key  # for Whisper STT
EXPO_PUBLIC_ELEVENLABS_API_KEY=         # optional, only if switching from melotts
```

### Run

```bash
# Terminal 1 — backend
pnpm --filter @cypilot/backend dev

# Terminal 2 — mobile (Metro bundler)
pnpm --filter @cypilot/mobile start
```

Then open Expo Go on your phone and scan the QR. Phone + Mac must be on the same WiFi.

## API endpoints

### Voice + Vision (the new stuff)
- `POST /api/voice/chat` — text in, Cy reply out. Pulls live context from Outlook + Canvas + CyRide + Workday before calling Kimi K2.6.
- `POST /api/voice/tts` — text in, base64 WAV out. Routed through the AI proxy worker.
- `POST /api/voice/describe` — base64 image in, scene description out. Kimi K2.6 vision.

### Auth
- `POST /auth/login` — Microsoft OAuth login URL
- `POST /auth/callback` — OAuth code exchange
- `POST /auth/dev-login` — dev-bypass login (no Microsoft needed)
- `POST /auth/refresh` — refresh tokens

### Data
- `GET /api/canvas/courses`, `/api/canvas/assignments/upcoming`, `/api/canvas/announcements/recent`
- `GET /api/outlook/emails/important`, `/api/outlook/events/upcoming`
- `GET /api/workday/notifications`, `/api/workday/action-items`, `/api/workday/tuition-fees`, `/api/workday/student-record`
- `GET /api/cyride/routes/active`, `/api/cyride/routes/from-to`, `/api/cyride/stops/nearby`
- `GET /api/dashboard` — aggregated rollup

## Project structure

```
cybuddy/
├── apps/
│   ├── backend/              # Express API
│   │   └── src/
│   │       ├── routes/       # auth, canvas, outlook, workday, cyride, voice, dashboard
│   │       └── services/     # cloudflareAI (Kimi K2.6 + melotts), per-source services
│   └── mobile/               # React Native + Expo
│       └── src/
│           ├── screens/      # Dashboard, Outlook, Academics, CyRide, Vision, VoiceAssistant, Login
│           ├── services/     # api, auth, groq (STT), cloudflareTTS, cameraDescribe
│           ├── hooks/        # useVoiceAI
│           └── contexts/     # AuthContext, VoiceContext
├── packages/
│   └── shared/               # Cross-cutting TS types + constants
├── package.json
├── turbo.json
└── pnpm-workspace.yaml
```

## Inspiration

In 2007, a 16-year-old in Andhra Pradesh, India was barred by India's CBSE from studying science because he was blind. He fought the board, won, topped his class — then every major Indian engineering institute including IIT and BITS rejected his application for the same reason.

His name is **Srikanth Bolla**. He went on to become the first international blind student at MIT Sloan, founded Bollant Industries (backed by Ratan Tata), and was mentored by Dr. APJ Abdul Kalam.

> *"If IIT didn't want me, I didn't want IIT either."* — Srikanth Bolla

Most students like Srikanth don't make it to MIT. The barriers aren't just at elite institutions — they're in the small daily friction of campus life. Cybuddy is built for the next Srikanth, while they're still in undergrad.

## License

MIT.
