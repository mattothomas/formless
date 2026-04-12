# BenefitPath

A voice/text AI navigator that helps low-income families in Pennsylvania discover government benefits they qualify for and generates a pre-filled PA SNAP application PDF ready to download.

## Quick Start

```bash
cd formless/benefitpath
npm install
cp .env.example .env
# Fill in your API keys in .env
npm run dev
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
VITE_GEMINI_API_KEY=          # Google AI Studio → Get API Key
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

**Gemini:** https://aistudio.google.com/app/apikey  
**Firebase:** https://console.firebase.google.com → Create project → Project settings → Your apps

> The app runs without Firebase (sessions won't persist across devices). Gemini is required for the AI conversation.

## Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable **Firestore Database** (start in production mode)
3. Enable **Firebase Hosting**
4. Copy your app config into `.env`
5. Update `.firebaserc` with your project ID

## Deploy to Firebase Hosting

```bash
npm install -g firebase-tools
firebase login
firebase init  # select Hosting + Firestore, dist as public dir, SPA rewrites
npm run build
firebase deploy
```

## Benefits Covered (PA 2025-2026 rules)

| Program | Threshold |
|---------|-----------|
| SNAP | Gross income ≤ 200% FPL |
| Medicaid | Income ≤ 138% FPL (adults); higher for children/pregnant |
| TANF | Families with children under 18, low income |
| LIHEAP | ≤ 60% state median income, open through May 8 2026 |
| WIC | Pregnant/postpartum/children under 5, ≤ 185% FPL |

## Demo Happy Path

Click **"Try the example story"** in the chat to pre-fill Maria's scenario — a single mom of 2 who qualifies for SNAP, Medicaid, CHIP, LIHEAP, and potentially WIC.

## Tech Stack

- **React + Vite** — frontend
- **Gemini 1.5 Flash** — AI conversation and data extraction
- **pdf-lib** — PDF generation overlaid on official PA SNAP form (PA 600 FS)
- **Firebase Firestore** — session persistence
- **Web Speech API** — voice input with text fallback
