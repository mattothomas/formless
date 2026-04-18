/**
 * Session store keyed by WhatsApp phone number.
 * Persists to disk so sessions survive server restarts during the demo day.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SESSION_FILE = join(__dirname, 'tmp', 'sessions.json');

const store = new Map();

// Load persisted sessions from disk on startup
function loadFromDisk() {
  try {
    if (!existsSync(SESSION_FILE)) return;
    const raw = readFileSync(SESSION_FILE, 'utf8');
    const entries = JSON.parse(raw);
    for (const [key, val] of entries) {
      store.set(key, val);
    }
    console.log(`[sessions] Loaded ${store.size} session(s) from disk`);
  } catch (err) {
    console.warn('[sessions] Could not load sessions from disk:', err.message);
  }
}

function saveToDisk() {
  try {
    mkdirSync(join(__dirname, 'tmp'), { recursive: true });
    writeFileSync(SESSION_FILE, JSON.stringify([...store.entries()], null, 2), 'utf8');
  } catch (err) {
    console.warn('[sessions] Could not save sessions to disk:', err.message);
  }
}

loadFromDisk();

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
      messages: [],
      extractedData: { ...EMPTY_EXTRACTED_DATA },
      pdfPath: null,
      isComplete: false,
    });
    saveToDisk();
  }
  return store.get(from);
}

export function update(from, patch) {
  const session = getOrCreate(from);
  Object.assign(session, patch);
  saveToDisk();
  return session;
}

export function clear(from) {
  store.delete(from);
  saveToDisk();
}

export { store, saveToDisk };
