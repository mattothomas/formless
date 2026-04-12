/**
 * Audio transcription via Groq's Whisper endpoint.
 *
 * WhatsApp delivers voice notes as audio/ogg (opus codec). Groq's
 * whisper-large-v3-turbo handles ogg/opus natively, returns the transcript
 * in ~1-2 seconds, and is multilingual — perfect for Spanglish voice notes.
 */

const GROQ_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';

/**
 * Transcribe an audio buffer to text.
 *
 * @param {Buffer} audioBuffer     Raw audio bytes downloaded from Twilio
 * @param {string} contentType     MIME type from Twilio (e.g. "audio/ogg")
 * @param {string} apiKey          GROQ_API_KEY
 * @returns {Promise<string>}      Transcript text
 */
export async function transcribe(audioBuffer, contentType, apiKey) {
  if (!apiKey) throw new Error('GROQ_API_KEY is not set.');

  // Determine a sane file extension for the multipart upload
  const ext = contentType.includes('ogg')  ? 'ogg'
             : contentType.includes('mp4')  ? 'mp4'
             : contentType.includes('mpeg') ? 'mp3'
             : contentType.includes('wav')  ? 'wav'
             : 'ogg'; // WhatsApp default

  const form = new FormData();
  form.append('file', new Blob([audioBuffer], { type: contentType }), `audio.${ext}`);
  form.append('model', 'whisper-large-v3-turbo');
  form.append('response_format', 'text');
  // Let Groq auto-detect language — handles English, Spanish, Spanglish
  form.append('language', 'es'); // bias toward Spanish; still transcribes mixed

  const res = await fetch(GROQ_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq transcription failed (${res.status}): ${err}`);
  }

  return (await res.text()).trim();
}
