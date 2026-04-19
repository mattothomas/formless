/**
 * Formless WhatsApp Backend
 *
 * Express server that:
 *  - Receives Twilio WhatsApp webhooks at POST /webhook/whatsapp
 *  - Serves generated PDFs at GET /pdfs/:filename (Twilio fetches these for <Media>)
 */

import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import whatsappRoute from './routes/whatsapp.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3001;

// ── Middleware ──────────────────────────────────────────────────────────────

// Twilio sends webhook bodies as application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));

// ── Static file serving ─────────────────────────────────────────────────────

// Generated PDFs are written to ./tmp/ and served here.
// Twilio's <Media> tag fetches the PDF URL — it must be publicly accessible.
// When running locally, set PUBLIC_BASE_URL to your ngrok HTTPS URL.
const tmpDir = path.join(__dirname, 'tmp');
app.use('/pdfs', express.static(tmpDir));

// ── Routes ──────────────────────────────────────────────────────────────────

app.use('/webhook/whatsapp', whatsappRoute);

// Health check — useful for ngrok / load balancer checks
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`Formless backend running on http://localhost:${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/webhook/whatsapp`);
  console.log(`PDF serving:      GET  http://localhost:${PORT}/pdfs/<filename>`);
  if (process.env.PUBLIC_BASE_URL) {
    console.log(`Public base URL:  ${process.env.PUBLIC_BASE_URL}`);
  } else {
    console.warn('WARNING: PUBLIC_BASE_URL is not set — PDF links in WhatsApp replies will not work.');
  }
});
