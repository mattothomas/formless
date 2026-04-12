import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app;
let db;

function getFirebaseApp() {
  if (!app) {
    // Only initialize if we have a real project ID
    if (!firebaseConfig.projectId || firebaseConfig.projectId === 'undefined') {
      return null;
    }
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return app;
}

export function getDb() {
  getFirebaseApp();
  return db;
}

export async function saveSession(sessionId, data) {
  const database = getDb();
  if (!database) return; // Firebase not configured, silently skip
  try {
    const ref = doc(database, 'sessions', sessionId);
    await setDoc(ref, {
      ...data,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (err) {
    console.warn('Firebase save failed (non-fatal):', err.message);
  }
}

export async function loadSession(sessionId) {
  const database = getDb();
  if (!database) return null;
  try {
    const ref = doc(database, 'sessions', sessionId);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn('Firebase load failed (non-fatal):', err.message);
    return null;
  }
}
