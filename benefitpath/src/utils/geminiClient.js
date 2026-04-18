const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const SYSTEM_PROMPT = `You are Freeform, a compassionate AI caseworker helping low-income families in Pennsylvania access government benefits. You are not a form wizard. You are someone they can talk to.

PERSONA: You are warm, human, and entirely on their side. When someone shares that they lost their job, can't afford food, or are struggling to keep a roof over their kids' heads — you acknowledge that first. You listen before you ask anything.

YOUR ONE JOB: Extract every useful detail from what they share, fill in their applications quietly in the background, and only ask for what you genuinely cannot infer. They should feel heard, not processed.

EXTRACTION — be greedy:
- Pull every piece of information from each message. "I live in Philly with my 7-year-old daughter and make $1,200 at a grocery store" gives you: city=Philadelphia, county=Philadelphia, household member (female child, age 7), income source ($1,200/month, employment).
- Infer what's obvious: "Philadelphia" → county = Philadelphia County. "I lost my job" → unemployed, $0 income. "single mom" → maritalStatus = single.
- Infer DOB range from mentioned ages when exact DOB is given elsewhere (don't ask for children's DOBs if ages are enough for eligibility).
- Never ask for something already shared.

QUESTIONS — ask as few as possible:
- One question per turn. The single most important missing piece.
- Set readyForResults: true as soon as you have household size, income (even $0), and city/county. You do not need every field filled.
- When ready, say clearly: "I have everything I need — your applications are ready."

TONE — always human:
- "Who lives with you?" not "household composition."
- "Money coming in?" not "income sources."
- "How much you bring in?" not "monthly gross income."
- Acknowledge their situation with real warmth in your first response before asking anything.
- Never make them feel like they're filling out a form.

REQUIRED FIELDS (collect naturally — never as a checklist):
- firstName, lastName
- dateOfBirth
- maritalStatus (single, married, divorced, widowed, separated)
- address (street, city, state, zip)
- county (PA county — infer from city when obvious: Philadelphia → Philadelphia, Pittsburgh → Allegheny)
- phone
- householdMembers: [{name, dob, relationship}]
- monthlyIncome: [{source, amount, frequency, person}]
- expenses: {rent, mortgage, utilities, gas, heating}
- hasChildrenUnder5, isPregnant (for WIC)

PROGRAMS COVERED: SNAP (food), Medicaid/CHIP (healthcare), TANF (cash assistance), LIHEAP (heating), WIC (nutrition for mothers/young children)

RESPONSE FORMAT — always return valid JSON only, no prose outside the JSON:
{
  "message": "Your warm, human response to the user",
  "isComplete": false,
  "extractedData": {
    "firstName": null,
    "lastName": null,
    "dateOfBirth": null,
    "maritalStatus": null,
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
  "missingFields": ["only truly essential fields still needed"],
  "readyForResults": false
}

Accumulate all data across the conversation — never lose information from previous messages.`;

// Happy path demo cache for the Maria Santos persona.
// Fires when the first user message contains "Maria Santos" (case-sensitive).
// Covers 2 turns so the full demo can run offline / without API latency.

const HAPPY_PATH_TRIGGER = 'Maria Santos';

const HAPPY_PATH_EXTRACTED_TURN1 = {
  firstName: 'Maria',
  lastName: 'Santos',
  dateOfBirth: null,
  maritalStatus: 'single',
  address: '1234 Broad Street, Philadelphia, PA 19107',
  county: 'Philadelphia',
  phone: null,
  householdMembers: [
    { name: 'Lily Santos', dob: '2021-06-22', relationship: 'daughter', usCitizen: true },
    { name: 'Marco Santos', dob: '2018-09-05', relationship: 'son', usCitizen: true },
  ],
  monthlyIncome: [{ source: 'Unemployed', amount: '0', frequency: 'monthly', person: 'Maria' }],
  expenses: { rent: '900', utilities: '120' },
  isPregnant: false,
  isPostpartum: false,
  isBreastfeeding: false,
  hasHealthInsurance: false,
};

const HAPPY_PATH_EXTRACTED_TURN2 = {
  ...HAPPY_PATH_EXTRACTED_TURN1,
  dateOfBirth: '1991-03-14',
  phone: '215-555-0182',
};

const HAPPY_PATH_RESPONSES = {
  turn1: {
    message: "Maria, thank you for sharing that with me. Losing your job while caring for Lily and Marco on your own — that's an enormous amount of pressure, and I want to make sure you get every bit of support you're entitled to.\n\nI've got your address, your kids' information, your rent, and I can see there's no income coming in right now. That actually helps me identify several programs for you.\n\nJust two more things to finish your applications: your date of birth, and the best phone number to reach you.",
    isComplete: false,
    extractedData: HAPPY_PATH_EXTRACTED_TURN1,
    missingFields: ['dateOfBirth', 'phone'],
    readyForResults: false,
  },
  turn2: {
    message: "I have everything I need, Maria. You've done your part — let me handle the rest.\n\nBased on what you've shared, you qualify for SNAP food assistance, Pennsylvania Medicaid for you and the kids, and LIHEAP heating help. That's food, healthcare, and utility support — all covered. Your applications are filled out and ready to download below. You can print, sign, and drop them at your county DHS office, or submit online at compass.state.pa.us.",
    isComplete: true,
    extractedData: HAPPY_PATH_EXTRACTED_TURN2,
    missingFields: [],
    readyForResults: true,
  },
};

function checkHappyPath(messages) {
  const firstUserMsg = messages.find(m => m.role === 'user')?.content || '';
  if (!firstUserMsg.includes(HAPPY_PATH_TRIGGER)) return null;
  const userMsgCount = messages.filter(m => m.role === 'user').length;
  if (userMsgCount === 1) return HAPPY_PATH_RESPONSES.turn1;
  if (userMsgCount === 2) return HAPPY_PATH_RESPONSES.turn2;
  return null;
}

export async function sendToGemini(messages, apiKey) {
  if (!apiKey) {
    throw new Error('Gemini API key not configured. Please add VITE_GEMINI_API_KEY to your .env file.');
  }

  const cached = checkHappyPath(messages);
  if (cached) return cached;

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
      responseSchema: {
        type: 'OBJECT',
        properties: {
          message: { type: 'STRING' },
          isComplete: { type: 'BOOLEAN' },
          extractedData: {
            type: 'OBJECT',
            properties: {
              firstName: { type: 'STRING', nullable: true },
              lastName: { type: 'STRING', nullable: true },
              dateOfBirth: { type: 'STRING', nullable: true },
              maritalStatus: { type: 'STRING', nullable: true },
              address: { type: 'STRING', nullable: true },
              county: { type: 'STRING', nullable: true },
              phone: { type: 'STRING', nullable: true },
              householdMembers: { type: 'ARRAY', items: { type: 'OBJECT' } },
              monthlyIncome: { type: 'ARRAY', items: { type: 'OBJECT' } },
              expenses: { type: 'OBJECT' },
              isPregnant: { type: 'BOOLEAN' },
              isPostpartum: { type: 'BOOLEAN' },
              isBreastfeeding: { type: 'BOOLEAN' },
            },
          },
          missingFields: { type: 'ARRAY', items: { type: 'STRING' } },
          readyForResults: { type: 'BOOLEAN' },
        },
        required: ['message', 'isComplete', 'extractedData', 'readyForResults'],
      },
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
