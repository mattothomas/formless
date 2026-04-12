/**
 * Gemini extraction service.
 * Copied from benefitpath/src/utils/geminiClient.js and kept as-is (ES module,
 * native fetch — works identically in Node 18+).
 * Only change: removed the Vite-style happy-path cache since the backend has no UI.
 */

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

const SYSTEM_PROMPT = `You are BenefitPath, a warm, compassionate AI navigator helping low-income families in Pennsylvania discover government benefits they qualify for.

Your job is to have a natural conversation to gather information, then determine eligibility for SNAP, Medicaid/CHIP, TANF, LIHEAP, and WIC.

IMPORTANT RULES:
1. Be warm, empathetic, and use plain language. Never use jargon.
2. Ask ONLY ONE clarifying question at a time.
3. Ask only about MISSING required fields — don't repeat what the user already told you.
4. After 3-5 exchanges, you have enough to generate results. Say so clearly.
5. Never ask for full Social Security numbers in conversation (they go on the form separately).
6. Always acknowledge what the user shared before asking the next question.
7. The user may speak in English, Spanish, or Spanglish — respond in whatever language they used.

REQUIRED FIELDS to collect:
- firstName, lastName (can be first name only if they prefer)
- address (street, city, state, zip)
- county (PA county)
- phone
- householdMembers: [{name, dob, relationship}] — for each person living with them
- monthlyIncome: [{source, amount, frequency}] — wages, child support, SSI, etc.
- expenses: {rent/mortgage, utilities}
- hasChildrenUnder5 (for WIC)
- isPregnant (for WIC)

RESPONSE FORMAT:
Always respond with valid JSON in this exact structure:
{
  "message": "Your conversational response to the user (warm, plain English or Spanish)",
  "isComplete": false,
  "extractedData": {
    "firstName": null,
    "lastName": null,
    "address": null,
    "county": null,
    "phone": null,
    "householdMembers": [],
    "monthlyIncome": [],
    "expenses": {},
    "isPregnant": false,
    "isPostpartum": false,
    "isBreastfeeding": false
  },
  "missingFields": ["list of fields still needed"],
  "readyForResults": false
}

When you have enough information (at minimum: income, household size, county or city), set "readyForResults": true and "isComplete": true.

Extract ALL data mentioned anywhere in the conversation and update extractedData accordingly. Accumulate — never lose data from previous messages.`;

export async function sendToGemini(messages, apiKey) {
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set.');
  }

  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) throw new Error('Empty response from Gemini');

  try {
    return JSON.parse(rawText);
  } catch {
    const match = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);
    throw new Error('Could not parse Gemini response as JSON');
  }
}

// Merge extracted data — accumulate, never overwrite a real value with null
export function mergeExtractedData(existing, incoming) {
  if (!incoming) return existing;
  const merged = { ...existing };

  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val === null || val === undefined) continue;
    if (Array.isArray(val)) {
      if (val.length > 0) merged[key] = val;
    } else if (typeof val === 'object') {
      merged[key] = { ...(merged[key] || {}), ...val };
    } else {
      merged[key] = val;
    }
  }

  return merged;
}
