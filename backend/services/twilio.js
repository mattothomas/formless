/**
 * Twilio helpers — TwiML response builders and media downloader.
 * No Twilio SDK needed: TwiML is just XML, and media download is a plain fetch.
 */

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Plain text reply — used for follow-up questions */
export function textReply(message) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`;
}

/** Text + PDF attachment — used when the application is complete */
export function mediaReply(message, mediaUrl) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>
    <Body>${escapeXml(message)}</Body>
    <Media>${escapeXml(mediaUrl)}</Media>
  </Message>
</Response>`;
}

/**
 * Download a Twilio media URL.
 * Twilio requires HTTP Basic Auth (Account SID : Auth Token) to fetch media.
 *
 * @param {string} mediaUrl         The MediaUrl0 from the Twilio webhook POST body
 * @param {string} accountSid
 * @param {string} authToken
 * @returns {Promise<Buffer>}
 */
export async function downloadMedia(mediaUrl, accountSid, authToken) {
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download Twilio media (${res.status}): ${mediaUrl}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
