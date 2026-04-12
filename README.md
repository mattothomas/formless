# Freeform

Government benefits exist. Most people who need them never get them — not because they don't qualify, but because the process is exhausting, confusing, and designed for people who already have time and resources.

Freeform fixes that.

---

## What it does

You talk. We fill the forms.

Tell Freeform what's going on in your life — in plain English, Spanish, or both. It figures out what you qualify for across SNAP, Medicaid, LIHEAP, WIC, and TANF, then generates your pre-filled Pennsylvania applications as downloadable PDFs. The whole thing takes minutes, not hours.

No account. No bureaucratic language. No cost.

---

## The problem we're solving

A single parent working two jobs doesn't have time to read a 12-page SNAP application. A recent immigrant doesn't know LIHEAP exists. A family in a crisis doesn't know where to start.

The gap between "you qualify" and "you receive benefits" is almost entirely paperwork. We close that gap.

---

## Running it locally

```bash
cd benefitpath
npm install
# add your keys to .env (see .env.example)
npm run dev
```

Open `http://localhost:5173`.

---

## Environment

```
VITE_GEMINI_API_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

Firebase is optional — sessions fall back to in-memory if not configured.

---

## Stack

- **Frontend** — React + Vite
- **AI** — Gemini 2.5 Flash (conversation + data extraction)
- **PDF generation** — pdf-lib, runs entirely in the browser
- **Voice** — Web Speech API (no third-party dependency)
- **Session** — Firebase Firestore (optional)

---

## Forms supported

| Form | Status |
|------|--------|
| Pennsylvania Medicaid Financial Eligibility | ✅ Fully filled |
| Pennsylvania SNAP (C-257599) | 🔧 In progress |

---

## Built for

Reduced Inequalities track — hackathon 2026.

The people who need government assistance the most are the same people least equipped to navigate the system that provides it. That's the inequality we're targeting.
