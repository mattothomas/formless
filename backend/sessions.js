/**
 * In-memory session store keyed by WhatsApp phone number.
 * Sessions survive the duration of the server process — good enough for a hackathon.
 * Upgrade path: swap the Map for Redis or Firestore if you need cross-restart persistence.
 */

const store = new Map();

const EMPTY_EXTRACTED_DATA = {
  firstName: null,
  lastName: null,
  address: null,
  county: null,
  phone: null,
  householdMembers: [],
  monthlyIncome: [],
  expenses: {},
  isPregnant: false,
  isPostpartum: false,
  isBreastfeeding: false,
};

export function getOrCreate(from) {
  if (!store.has(from)) {
    store.set(from, {
      from,
      createdAt: Date.now(),
      messages: [],                              // { role: 'user'|'assistant', content: string }
      extractedData: { ...EMPTY_EXTRACTED_DATA },
      pdfPath: null,
      isComplete: false,
    });
  }
  return store.get(from);
}

export function clear(from) {
  store.delete(from);
}

export { store };
