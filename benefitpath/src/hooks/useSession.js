import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { saveSession, loadSession } from '../firebase.js';

const SESSION_KEY = 'benefitpath_session_id';

function getOrCreateSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = uuidv4();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function useSession() {
  const [sessionId] = useState(() => getOrCreateSessionId());
  const [messages, setMessages] = useState([]);
  const [extractedData, setExtractedData] = useState({});
  const [eligibilityResults, setEligibilityResults] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load session on mount
  useEffect(() => {
    async function load() {
      try {
        const saved = await loadSession(sessionId);
        if (saved) {
          if (saved.messages) setMessages(saved.messages);
          if (saved.extractedData) setExtractedData(saved.extractedData);
          if (saved.eligibilityResults) setEligibilityResults(saved.eligibilityResults);
        }
      } catch (err) {
        console.warn('Could not load session:', err);
      } finally {
        setIsLoaded(true);
      }
    }
    load();
  }, [sessionId]);

  // Auto-save on changes (debounced)
  const persist = useCallback(async (msgs, data, results) => {
    try {
      await saveSession(sessionId, {
        messages: msgs,
        extractedData: data,
        eligibilityResults: results,
        createdAt: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('Auto-save failed:', err);
    }
  }, [sessionId]);

  const addMessage = useCallback((role, content) => {
    setMessages(prev => {
      const next = [...prev, { role, content, timestamp: Date.now() }];
      return next;
    });
  }, []);

  const updateExtractedData = useCallback((newData) => {
    setExtractedData(prev => {
      const merged = { ...prev, ...newData };
      return merged;
    });
  }, []);

  const resetSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    window.location.reload();
  }, []);

  return {
    sessionId,
    messages,
    setMessages,
    extractedData,
    setExtractedData,
    eligibilityResults,
    setEligibilityResults,
    isLoaded,
    addMessage,
    updateExtractedData,
    persist,
    resetSession,
  };
}
