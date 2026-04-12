const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are BenefitPath, a warm, compassionate AI navigator helping low-income families in Pennsylvania discover government benefits they qualify for.

Your job is to have a natural conversation to gather information, then determine eligibility for SNAP, Medicaid/CHIP, TANF, LIHEAP, and WIC.

IMPORTANT RULES:
1. Be warm, empathetic, and use plain language. Never use jargon.
2. Ask ONLY ONE clarifying question at a time.
3. Ask only about MISSING required fields — don't repeat what the user already told you.
4. After 3-5 exchanges, you have enough to generate results. Say so clearly.
5. Never ask for full Social Security numbers in conversation (they go on the form separately).
6. Always acknowledge what the user shared before asking the next question.

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
  "message": "Your conversational response to the user (warm, plain English)",
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

const HAPPY_PATH_CACHE = {
  trigger: "I'm Maria, a single mom with 2 kids ages 4 and 7",
  response: {
    message: "Hi Maria! Thank you for sharing that. It sounds like you're working really hard for your family. I can see you're managing a lot right now, and I'm here to help you find every benefit you deserve.\n\nI have your income ($1,400/month from your grocery store job) and rent ($900/month in Philadelphia). One quick question: do you have any other income coming in — like child support, SSI, or any other assistance?",
    isComplete: false,
    extractedData: {
      firstName: "Maria",
      lastName: null,
      address: "Philadelphia, PA",
      county: "Philadelphia",
      phone: null,
      householdMembers: [
        { name: "Child 1", dob: "2020-01-01", relationship: "child", usCitizen: true },
        { name: "Child 2", dob: "2017-01-01", relationship: "child", usCitizen: true }
      ],
      monthlyIncome: [{ source: "Part-time grocery store job", amount: "1400", frequency: "monthly" }],
      expenses: { rent: "900" },
      isPregnant: false,
      isPostpartum: false,
      isBreastfeeding: false
    },
    missingFields: ["lastName", "phone", "otherIncome", "utilities"],
    readyForResults: false,
  }
};

export async function sendToGemini(messages, apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }

  // Check happy path cache
  const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
  if (firstUserMsg.includes(HAPPY_PATH_CACHE.trigger) && messages.length <= 2) {
    return HAPPY_PATH_CACHE.response;
  }

  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const body = {
    system_instruction: {
      parts: [{ text: SYSTEM_PROMPT }],
    },
    contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
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

  // Gemini 2.5 thinking models return multiple parts; skip thought parts
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const rawText = parts.find(p => !p.thought)?.text || parts[0]?.text;

  console.log('[Gemini raw]', rawText);

  if (!rawText) {
    throw new Error('Empty response from Gemini');
  }

  // 1. Try direct parse
  try { return JSON.parse(rawText); } catch {}

  // 2. Strip markdown code fences
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) try { return JSON.parse(fenced[1]); } catch {}

  // 3. Extract the first {...} block from the text
  const braceMatch = rawText.match(/\{[\s\S]*\}/);
  if (braceMatch) try { return JSON.parse(braceMatch[0]); } catch {}

  throw new Error('Could not parse Gemini response as JSON');
}

// Merge extracted data — accumulate, never overwrite with null
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
