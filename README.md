# Freeform

Government benefits exist. Most people who need them never get them. Not because they don't qualify, but because the process is exhausting, confusing, and built for people who already have time and resources.

Freeform fixes that.

---

## What it does

You talk. We fill the forms.

Tell Freeform what is going on in your life, in plain English, Spanish, or both. It figures out what you qualify for across SNAP, Medicaid, LIHEAP, WIC, and TANF, then generates your pre-filled Pennsylvania applications as downloadable PDFs. The whole thing takes minutes, not hours.

No account. No bureaucratic language. No cost.

---

## The vision

This is what the future of public services looks like.

Not a portal. Not a 40-question form. Not a phone tree. A conversation.

The same way AI is reshaping medicine, law, and finance, it can reshape access to government assistance. The difference is that in those fields, AI is helping people who already have access. Here, it is reaching people who have been left out entirely.

Freeform is a proof of concept that the hardest parts of navigating poverty, which are not the circumstances but the paperwork, can be solved with technology that already exists. The infrastructure is there. The benefits are there. We just built the bridge.

A single parent who just lost their job should not have to spend three hours reading instructions to get food assistance. A recent immigrant should not miss out on heating help because they did not know the program existed. A family in crisis should not have to choose between figuring out government forms and taking care of their kids.

We believe this approach, conversational intake paired with automatic form generation, will become the default way people access public services. We built the first version of it in a weekend.

---

## Running it locally

```bash
cd benefitpath
npm install
cp .env.example .env   # fill in your keys
npm run dev
```

Open `http://localhost:5173`.

To start a fresh session during a demo: `http://localhost:5173?reset`

---

## Environment variables

```
VITE_GEMINI_API_KEY=          # powers the conversation and data extraction
VITE_FIREBASE_API_KEY=        # optional: enables cross-device session persistence
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Firebase is optional. Without it, sessions are held in memory and work fine for demos.

---

## How it works

1. User describes their situation in natural language (text or voice)
2. Gemini extracts structured data from the conversation and identifies missing fields
3. The system asks targeted follow-up questions, one at a time, until it has enough to proceed
4. Eligibility is calculated against current PA benefit thresholds (SNAP, Medicaid, LIHEAP, WIC, TANF)
5. Pre-filled PDF applications are generated entirely in the browser using pdf-lib
6. User downloads, signs, and submits

No data leaves the browser except to the AI model. No server required for PDF generation.

---

## Stack

| Layer | Tool | Why |
|-------|------|-----|
| Frontend | React + Vite | Fast iteration |
| AI | Gemini 2.5 Flash | Multilingual, fast, structured JSON output |
| PDF | pdf-lib (browser) | No server, no upload, works offline |
| Voice | Web Speech API | Zero dependency, built into every browser |
| Session | Firebase Firestore | Optional persistence across devices |
| Animations | Motion (Framer) | Purposeful transitions only |

---

## Forms supported

| Form | Method | Status |
|------|--------|--------|
| Pennsylvania Medicaid Financial Eligibility | AcroForm field fill | Working |
| Pennsylvania SNAP (C-257599) | Coordinate overlay | In progress |

---

## Built for

Reduced Inequalities track. Hackathon 2026.

The people who need government assistance the most are the same people least equipped to navigate the system that provides it. That is the inequality we are targeting. Not with awareness campaigns or policy proposals, but with a tool that works right now, for real people, in the real world.
