/**
 * POST /webhook/whatsapp
 *
 * Handles incoming WhatsApp messages from Twilio.
 * Supports text messages and audio voice notes (OGG/Opus from WhatsApp).
 *
 * Flow:
 *   1. Resume or create session for this phone number
 *   2. If audio → download from Twilio → transcribe with Groq Whisper
 *   3. Send conversation history to Gemini → extract structured data
 *   4. Merge extracted data into session (accumulate, never overwrite)
 *   5. If ready → generate PDF → reply with PDF attachment
 *      Otherwise → reply with next follow-up question
 */

import { Router } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { getOrCreate } from '../sessions.js';
import { sendToGemini, mergeExtractedData } from '../services/gemini.js';
import { transcribe } from '../services/groq.js';
import { downloadMedia, textReply, mediaReply } from '../services/twilio.js';
import { generateSnapPdf, hasEnoughData } from '../services/pdf.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = Router();

const AUDIO_MIME_TYPES = ['audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/amr'];

function isAudio(contentType = '') {
  return AUDIO_MIME_TYPES.some((t) => contentType.toLowerCase().startsWith(t));
}

router.post('/', async (req, res) => {
  res.setHeader('Content-Type', 'text/xml');

  const {
    From: from,
    Body: body = '',
    NumMedia: numMedia = '0',
    MediaUrl0: mediaUrl,
    MediaContentType0: mediaContentType,
  } = req.body;

  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    GEMINI_API_KEY,
    GROQ_API_KEY,
    PUBLIC_BASE_URL,
  } = process.env;

  try {
    const session = getOrCreate(from);

    // ── 1. Resolve the user's text (transcribe audio if needed) ──────────────

    let userText = body.trim();

    if (parseInt(numMedia) > 0 && mediaUrl && isAudio(mediaContentType)) {
      console.log(`[${from}] Audio received (${mediaContentType}) — downloading…`);
      const audioBuffer = await downloadMedia(mediaUrl, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
      console.log(`[${from}] Transcribing ${audioBuffer.length} bytes…`);
      userText = await transcribe(audioBuffer, mediaContentType, GROQ_API_KEY);
      console.log(`[${from}] Transcribed: "${userText}"`);
    }

    if (!userText) {
      return res.send(textReply(
        "Hi! I'm here to help you apply for SNAP and other benefits. Tell me a bit about your situation — you can speak or type in English or Spanish."
      ));
    }

    // ── 2. Append user turn to history ────────────────────────────────────────

    session.messages.push({ role: 'user', content: userText });

    // ── 3. Send to Gemini ─────────────────────────────────────────────────────

    console.log(`[${from}] Sending ${session.messages.length} messages to Gemini…`);
    const geminiResult = await sendToGemini(session.messages, GEMINI_API_KEY);

    // ── 4. Merge extracted data ───────────────────────────────────────────────

    session.extractedData = mergeExtractedData(
      session.extractedData,
      geminiResult.extractedData
    );

    // Append assistant reply to history
    session.messages.push({ role: 'assistant', content: geminiResult.message });

    console.log(`[${from}] readyForResults=${geminiResult.readyForResults} isComplete=${geminiResult.isComplete}`);

    // ── 5. Generate PDF if ready ──────────────────────────────────────────────

    if (geminiResult.readyForResults && hasEnoughData(session.extractedData)) {
      // Generate PDF only once
      if (!session.pdfPath) {
        const filename = `snap-${from.replace(/\W+/g, '')}-${Date.now()}.pdf`;
        const outputPath = path.resolve(__dirname, '../tmp', filename);

        console.log(`[${from}] Generating PDF → ${outputPath}`);
        await generateSnapPdf(session.extractedData, outputPath);

        session.pdfPath = outputPath;
        session.isComplete = true;

        const pdfUrl = `${PUBLIC_BASE_URL}/pdfs/${filename}`;
        console.log(`[${from}] PDF ready at ${pdfUrl}`);

        const name = session.extractedData.firstName || 'there';
        return res.send(
          mediaReply(
            `Great news, ${name}! Based on what you've shared, I've prepared your SNAP application. ` +
            `Here's your filled form — please review it and bring it to your local CAO office. ` +
            `Reply "start over" anytime to begin a new application.`,
            pdfUrl
          )
        );
      } else {
        // Already generated — resend the link
        const filename = path.basename(session.pdfPath);
        const pdfUrl = `${PUBLIC_BASE_URL}/pdfs/${filename}`;
        return res.send(
          mediaReply('Here is your previously generated SNAP application:', pdfUrl)
        );
      }
    }

    // ── 6. Continue conversation ──────────────────────────────────────────────

    return res.send(textReply(geminiResult.message));

  } catch (err) {
    console.error(`[${from ?? 'unknown'}] Error:`, err);
    return res.send(textReply(
      "I'm sorry, something went wrong on my end. Please try sending your message again."
    ));
  }
});

export default router;
