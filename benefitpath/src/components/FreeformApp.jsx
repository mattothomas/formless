import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Send, Columns2, AlignLeft } from 'lucide-react';
import { sendToGemini, mergeExtractedData } from '../utils/geminiClient.js';
import { calculateEligibility } from '../utils/eligibility.js';
import { generateMedicaidPDF, generateSnapPDF, downloadPDF } from '../utils/pdfGenerator.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSession } from '../hooks/useSession.js';
import LiveFormPanel from './LiveFormPanel.jsx';
import { t } from '../utils/i18n.js';
import { resolveFax } from '../utils/countyFax.js';

const EXAMPLE_TEXT =
  "I just got laid off from my job last week. I have a 4-year-old daughter and I'm behind on rent — $950 a month in Philadelphia. She doesn't have health insurance and I don't know where to start.";

// ── Root ─────────────────────────────────────────────────────────────────────

export default function FreeformApp({ onSwitchDesign }) {
  const {
    messages: savedMessages,
    setMessages,
    extractedData,
    setExtractedData,
    eligibilityResults,
    setEligibilityResults,
    isLoaded,
    persist,
    resetSession,
  } = useSession();

  const [screen, setScreen] = useState('landing'); // landing | intake | document
  const [lang, setLang] = useState('en');
  const isDemoMode = new URLSearchParams(window.location.search).has('demo');

  // Jump straight to document if session already has results
  useEffect(() => {
    if (isLoaded && eligibilityResults && eligibilityResults.length > 0) {
      setScreen('document');
    } else if (isLoaded && savedMessages.length > 0) {
      setScreen('intake');
    }
  }, [isLoaded]); // eslint-disable-line

  function handleBegin() { setScreen('intake'); }
  function handleReview() { setScreen('document'); }
  function handleReturn() { setScreen('intake'); }
  function handleReset() { resetSession(); setScreen('landing'); }

  return (
    <div style={{ ...c.root, position: 'relative' }}>
      {isDemoMode && (
        <div style={{
          position: 'fixed', top: '0.75rem', right: '50%', transform: 'translateX(50%)',
          background: '#c0392b', color: '#fff', fontSize: '9px', fontWeight: 700,
          letterSpacing: '0.18em', padding: '4px 12px', zIndex: 9999, pointerEvents: 'none',
        }}>
          LIVE DEMO
        </div>
      )}
      <AnimatePresence mode="wait">
        {screen === 'landing' && (
          <Landing key="landing" onBegin={handleBegin} lang={lang} setLang={setLang} />
        )}
        {screen === 'intake' && (
          <Intake
            key="intake"
            savedMessages={savedMessages}
            setMessages={setMessages}
            extractedData={extractedData}
            setExtractedData={setExtractedData}
            eligibilityResults={eligibilityResults}
            setEligibilityResults={setEligibilityResults}
            persist={persist}
            onReview={handleReview}
            lang={lang}
            isDemoMode={isDemoMode}
          />
        )}
        {screen === 'document' && (
          <Document
            key="document"
            extractedData={extractedData}
            eligibilityResults={eligibilityResults}
            onReturn={handleReturn}
            onReset={handleReset}
            lang={lang}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Landing ──────────────────────────────────────────────────────────────────

function Landing({ onBegin, lang, setLang }) {
  const headline = t(lang, 'landingHeadline');
  return (
    <motion.div
      key="landing-inner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      style={{ ...c.screen, display: 'flex', flexDirection: 'column' }}
    >
      {/* Top bar */}
      <div style={c.topBar}>
        <button onClick={() => { window.location.href = '/?reset'; }} style={{ ...c.wordmark, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          FREEFORM
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setLang(l => l === 'en' ? 'es' : 'en')}
            style={c.ghostSmall}
          >
            {t(lang, 'landingLangToggle')}
          </button>
          <span style={c.topBarRight}>Pennsylvania · 2026</span>
        </div>
      </div>

      {/* Main content */}
      <div style={c.landingBody}>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
        >
          <p style={c.landingEyebrow}>{t(lang, 'landingEyebrow')}</p>
          <h1 style={c.landingHeadline}>
            {headline[0]}<br />
            {headline[1]}<br />
            {headline[2]}
          </h1>
          <p style={c.landingBody2}>{t(lang, 'landingBody')}</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.35 }}
          style={{ marginTop: '3rem' }}
        >
          <button onClick={onBegin} style={c.beginBtn}>
            {t(lang, 'landingBegin')}
          </button>
          <div style={c.programStrip}>
            {['SNAP', 'Medicaid', 'LIHEAP', 'WIC', 'TANF'].map((p, i) => (
              <span key={p} style={c.programTag}>
                {p}
                {i < 4 && <span style={{ color: '#C0BAB0', marginLeft: '0.75rem' }}>·</span>}
              </span>
            ))}
          </div>
          <div style={c.trustRow}>
            <span style={c.trustLock}>🔒</span>
            <span style={c.trustText}>{t(lang, 'landingTrust')}</span>
          </div>
          <div style={c.whatsappRow}>
            <div style={c.whatsappQR}>
              {/* Swap in actual QR SVG for your Twilio WhatsApp number */}
              <div style={{ width: 48, height: 48, background: '#E8E6DF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                📱
              </div>
            </div>
            <div>
              <p style={c.whatsappLabel}>No smartphone? No problem.</p>
              <p style={c.whatsappSub}>Text or voice message us on WhatsApp — same result, no app needed.</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom rule */}
      <div style={c.landingFooter}>
        <span style={c.footerText}>{t(lang, 'landingFooter')}</span>
      </div>
    </motion.div>
  );
}

// ── Intake ───────────────────────────────────────────────────────────────────

const SYSTEM_SEED = {
  id: 'seed',
  role: 'system',
  content: 'Tell us what\'s going on — in your own words, at your own pace. There\'s no wrong place to start.',
};

const DEMO_MARIA_MSG = "I'm Maria Santos. Single mom, two kids — my daughter Lily is 4 and Marco is 7. I just got laid off from my job at the grocery store. We live at 1234 Broad Street, Philadelphia. Rent is $900 a month. No health insurance.";

function Intake({
  savedMessages, setMessages, extractedData, setExtractedData,
  eligibilityResults, setEligibilityResults, persist, onReview, lang, isDemoMode,
}) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showPrivacyBanner, setShowPrivacyBanner] = useState(true);
  const [splitView, setSplitView] = useState(isDemoMode && window.innerWidth >= 900);
  const [sessionId] = useState(() => Math.random().toString(36).slice(2, 8).toUpperCase());
  const lastAiMsgId = useRef(null);
  const sendMessageRef = useRef(null);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  useEffect(() => {
    const t = setTimeout(() => setShowPrivacyBanner(false), 5000);
    return () => clearTimeout(t);
  }, []);

  // Demo mode: auto-send Maria's story after a short delay
  useEffect(() => {
    if (!isDemoMode || savedMessages.length > 0) return;
    const timer = setTimeout(() => {
      sendMessageRef.current?.(DEMO_MARIA_MSG);
    }, 1500);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line

  const messages = savedMessages.length > 0 ? savedMessages : [SYSTEM_SEED];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTranscript = useCallback((text) => {
    setInputText(prev => prev ? prev + ' ' + text : text);
  }, []);

  const { isListening, isSupported, interimText, toggleListening } = useSpeech({
    onTranscript: handleTranscript,
    lang,
  });

  async function sendMessage(text) {
    if (!text.trim() || isTyping) return;
    setInputText('');

    const userMsg = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const base = messages.filter(m => m.id !== 'seed');
    const nextMessages = [...base, userMsg];
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      const apiMessages = nextMessages.map(m => ({
        role: m.role === 'system' ? 'assistant' : 'user',
        content: m.content,
      }));
      const response = await sendToGemini(apiMessages, apiKey);
      const assistantMsg = { id: (Date.now() + 1).toString(), role: 'system', content: response.message };
      lastAiMsgId.current = assistantMsg.id;
      const updated = [...nextMessages, assistantMsg];
      setMessages(updated);

      const merged = mergeExtractedData(extractedData, response.extractedData);
      setExtractedData(merged);

      if (response.readyForResults || response.isComplete) {
        const results = calculateEligibility(merged);
        setEligibilityResults(results);
        await persist(updated, merged, results);
        setTimeout(() => onReview(), 400);
      } else {
        await persist(updated, merged, null);
      }
    } catch {
      const errMsg = { id: (Date.now() + 1).toString(), role: 'system', content: 'Something went wrong. Please try again.' };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  sendMessageRef.current = sendMessage;

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
  }

  const exchangeCount = messages.filter(m => m.role === 'user').length;
  const showReview = exchangeCount >= 3 && !isTyping;

  // Calculate form fill percentage based on key fields collected
  const fillPct = (() => {
    const d = extractedData || {};
    const checks = [
      !!d.firstName,
      !!d.lastName,
      !!d.address,
      !!d.county,
      !!d.phone,
      !!d.dateOfBirth,
      !!d.maritalStatus,
      !!(d.householdMembers && d.householdMembers.length > 0),
      !!(d.monthlyIncome && d.monthlyIncome.length > 0),
      !!(d.expenses && (d.expenses.rent || d.expenses.utilities || d.expenses.heating)),
    ];
    const filled = checks.filter(Boolean).length;
    return Math.round((filled / checks.length) * 100);
  })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ ...c.screen, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div style={c.topBar}>
        <button onClick={() => { window.location.href = '/?reset'; }} style={{ ...c.wordmark, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
          FREEFORM
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button
            onClick={() => setSplitView(v => !v)}
            title={splitView ? 'Single column view' : 'Live form view'}
            style={{ ...c.ghostSmall, display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '3px 8px' }}
          >
            {splitView ? <AlignLeft size={11} /> : <Columns2 size={11} />}
            <span style={{ fontSize: '10px' }}>{splitView ? t(lang, 'intakeSingleToggle') : t(lang, 'intakeLiveFormToggle')}</span>
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <span style={{ fontSize: '10px', color: '#2D8C5A' }}>🔒</span>
            <span style={c.topBarRight}>Session {sessionId} · {t(lang, 'sessionLabel')}</span>
          </div>
        </div>
      </div>

      {/* Body — single or split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Transcript */}
      <div style={{ flex: splitView ? '0 0 55%' : '1 1 100%', overflowY: 'auto', borderRight: splitView ? '1px solid #D8D6CF' : 'none' }}>
        <div style={{ padding: '0' }}>
          {/* Privacy banner */}
          <AnimatePresence>
            {showPrivacyBanner && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={c.privacyBanner}
              >
                <span style={{ fontSize: '11px', flexShrink: 0 }}>🔒</span>
                <span>Your story stays private. Everything you share is encrypted before leaving your device and is never stored on our servers.</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Section label */}
          <div style={c.transcriptLabel}>{t(lang, 'intakeTranscriptLabel')}</div>

          {messages.map((msg, i) => {
            const isUser = msg.role === 'user';
            const lineNum = String(i + 1).padStart(2, '0');
            return (
              <motion.div
                key={msg.id || i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.05, 0.4) }}
                style={{
                  ...c.transcriptRow,
                  ...(isUser ? c.transcriptRowUser : {}),
                }}
              >
                <span style={{ ...c.lineNum, ...(isUser ? { color: '#1C3A2A' } : {}) }}>
                  {lineNum}
                </span>
                <div style={{ flex: 1 }}>
                  <span style={{ ...c.speaker, ...(isUser ? c.speakerUser : {}) }}>
                    {isUser ? t(lang, 'intakeSpeakerUser') : t(lang, 'intakeSpeakerAI')}
                  </span>
                  <p style={{ ...c.transcriptText, ...(isUser ? c.transcriptTextUser : {}) }}>
                    {!isUser && msg.id === lastAiMsgId.current
                      ? <TypingText text={msg.content} />
                      : msg.content}
                  </p>
                </div>
              </motion.div>
            );
          })}

          {/* Typing */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={c.transcriptRow}
            >
              <span style={c.lineNum}>—</span>
              <div style={{ flex: 1 }}>
                <span style={c.speaker}>FREEFORM</span>
                <p style={c.transcriptText}>
                  <span style={{ display: 'inline-flex', gap: '4px', alignItems: 'center', marginTop: '2px' }}>
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        animate={{ opacity: [0.2, 1, 0.2] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                        style={{ display: 'block', width: 5, height: 5, background: '#888682' }}
                      />
                    ))}
                  </span>
                </p>
              </div>
            </motion.div>
          )}

          {/* Interim speech */}
          {interimText && (
            <div style={{ ...c.transcriptRow, opacity: 0.5 }}>
              <span style={c.lineNum}>·</span>
              <div style={{ flex: 1 }}>
                <span style={{ ...c.speaker, color: '#c0392b' }}>{t(lang, 'intakeSpeakerListening')}</span>
                <p style={{ ...c.transcriptText, fontStyle: 'italic' }}>{interimText}</p>
              </div>
            </div>
          )}

          {/* Example */}
          {messages.length <= 1 && !isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{ padding: '0 1.5rem 1.5rem', borderBottom: '1px solid #E8E6DF' }}
            >
              <p style={{ fontSize: '11px', color: '#888682', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 0.6rem' }}>
                {t(lang, 'intakeExamplePrompt')}
              </p>
              <button onClick={() => { sendMessage(EXAMPLE_TEXT); setShowPrivacyBanner(false); }} style={c.exampleBtn}>
                {t(lang, 'intakeExampleBtn')}
              </button>
            </motion.div>
          )}

          {/* Review prompt */}
          {showReview && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={c.reviewPrompt}
            >
              <div>
                <p style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#A8C4B0', margin: '0 0 0.3rem' }}>
                  {fillPct >= 80 ? t(lang, 'reviewNearlyDone') : fillPct >= 50 ? t(lang, 'reviewAlmostThere') : t(lang, 'reviewBuilding')}
                </p>
                <p style={{ fontSize: '13px', color: '#D4E6DA', margin: 0, lineHeight: 1.5 }}>
                  {t(lang, 'reviewSubtext')}
                </p>
              </div>
              <button onClick={onReview} style={c.reviewBtn}>
                {t(lang, 'reviewBtn')}
              </button>
            </motion.div>
          )}

          <div ref={bottomRef} style={{ height: '1px' }} />
        </div>
      </div>

      {/* Live form panel (split view) */}
      {splitView && (
        <div style={{ flex: '0 0 45%', overflowY: 'auto' }}>
          <LiveFormPanel extractedData={extractedData} isListening={isListening} />
        </div>
      )}
      </div>{/* end body wrapper */}

      {/* Input */}
      <div style={c.inputArea}>
        <div style={c.inputRow}>
          <button
            onClick={isSupported ? toggleListening : undefined}
            style={{ ...c.inputIconBtn, background: isListening ? '#c0392b' : '#1C3A2A', opacity: isSupported ? 1 : 0.35, cursor: isSupported ? 'pointer' : 'default' }}
            title={isListening ? 'Stop recording' : isSupported ? 'Speak' : 'Voice input not available in this browser'}
          >
            {isListening ? <Square size={12} color="#fff" /> : <Mic size={12} color="#fff" />}
          </button>
          <textarea
            ref={inputRef}
            value={inputText}
            onChange={e => { setInputText(e.target.value); setShowPrivacyBanner(false); }}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? t(lang, 'intakePlaceholderListening') : t(lang, 'intakePlaceholder')}
            rows={2}
            disabled={isTyping || isListening}
            style={c.inputTextarea}
          />
          <button
            onClick={() => sendMessage(inputText)}
            disabled={!inputText.trim() || isTyping}
            style={{ ...c.inputIconBtn, background: '#1C3A2A', opacity: !inputText.trim() || isTyping ? 0.3 : 1 }}
          >
            <Send size={12} color="#fff" />
          </button>
        </div>
        <p style={c.inputHint}>
          {isListening ? t(lang, 'intakeHintListening') : t(lang, 'intakeHint')}
        </p>
      </div>
    </motion.div>
  );
}

// ── Document ─────────────────────────────────────────────────────────────────

function Document({ extractedData, eligibilityResults, onReturn, onReset, lang }) {
  const [generatingMedicaid, setGeneratingMedicaid] = useState(false);
  const [generatingSnap, setGeneratingSnap] = useState(false);
  const [medicaidDone, setMedicaidDone] = useState(false);
  const [snapDone, setSnapDone] = useState(false);
  const [snapWarned, setSnapWarned] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const [faxState, setFaxState] = useState('idle'); // idle | searching | sending | done

  const d = extractedData || {};
  const results = eligibilityResults || [];
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || '—';
  const totalIncome = (d.monthlyIncome || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const householdSize = (d.householdMembers || []).length + 1;
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const eligible = results.filter(r => r.eligible === 'yes');
  const maybe = results.filter(r => r.eligible === 'maybe');
  const faxInfo = resolveFax(d.county, d.zip || (d.address || '').match(/\d{5}/)?.[0]);

  async function handleFax() {
    if (faxState !== 'idle') return;
    setFaxState('searching');
    await new Promise(r => setTimeout(r, 1800));
    setFaxState('sending');
    await new Promise(r => setTimeout(r, 2600));
    setFaxState('done');
  }

  async function handleMedicaid() {
    setGeneratingMedicaid(true); setPdfError(null);
    try {
      downloadPDF(await generateMedicaidPDF(d), 'PA-Medicaid-Application.pdf');
      setMedicaidDone(true);
    } catch { setPdfError('Could not generate Medicaid PDF. Please try again.'); }
    finally { setGeneratingMedicaid(false); }
  }

  async function handleSnap() {
    if (!snapWarned) { setSnapWarned(true); return; }
    setGeneratingSnap(true);
    try {
      downloadPDF(await generateSnapPDF(d), 'PA-SNAP-Application.pdf');
      setSnapDone(true);
    } catch { setPdfError('Could not generate SNAP PDF.'); }
    finally { setGeneratingSnap(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      style={{ ...c.screen, display: 'flex', flexDirection: 'column' }}
    >
      {/* Header */}
      <div style={c.topBar}>
        <button onClick={onReturn} style={c.returnLink}>{t(lang, 'docReturn')}</button>
        <span style={{ ...c.topBarRight, color: '#888682' }}>{t(lang, 'docDraft')} · {today}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', background: '#F0EDE6' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', padding: '2rem 1.25rem' }}>

          {/* Eligibility finding */}
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.1 }}
              style={c.eligBlock}
            >
              <div style={c.eligHeader}>
                <span style={c.eligHeaderLabel}>{t(lang, 'eligLabel')}</span>
                <span style={c.eligHeaderSub}>{t(lang, 'eligConfirmed', eligible.length)} · {t(lang, 'eligVerify', maybe.length)}</span>
              </div>
              <motion.div
                style={c.eligGrid}
                variants={{ show: { transition: { staggerChildren: 0.1 } } }}
                initial="hidden"
                animate="show"
              >
                {results.map(r => (
                  <motion.div
                    key={r.program}
                    variants={{ hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.3 } } }}
                    style={{ ...c.eligItem, ...(r.eligible === 'yes' ? c.eligYes : r.eligible === 'maybe' ? c.eligMaybe : c.eligNo) }}
                  >
                    <div style={c.eligItemTop}>
                      <span style={c.eligIcon}>{r.icon}</span>
                      <span style={c.eligName}>{r.programName}</span>
                      <span style={c.eligStatus}>
                        {r.eligible === 'yes' ? t(lang, 'eligYes') : r.eligible === 'maybe' ? t(lang, 'eligMaybe') : t(lang, 'eligNo')}
                      </span>
                    </div>
                    {r.confidence && (
                      <div style={{ marginTop: '0.4rem' }}>
                        <div style={{ height: 2, background: '#E8E6DF', borderRadius: 1 }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${r.confidence}%` }}
                            transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                            style={{ height: '100%', background: r.eligible === 'yes' ? '#1C3A2A' : r.eligible === 'maybe' ? '#92400E' : '#888682', borderRadius: 1 }}
                          />
                        </div>
                        <span style={{ fontSize: '9px', color: '#888682', marginTop: '2px', display: 'block' }}>
                          {r.confidence}% confidence
                        </span>
                      </div>
                    )}
                    {r.urgent && (
                      <div style={c.urgentFlag}>{t(lang, 'urgentFlag')}</div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          )}

          {/* The document */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            style={c.docWrap}
          >
            {/* Document masthead */}
            <div style={c.docMasthead}>
              <div style={c.docFormRef}>FORM PA-BENEFIT-001</div>
              <h1 style={c.docMainTitle}>Pennsylvania Benefit Application</h1>
              <div style={c.docSubRow}>
                <span>Medicaid Financial Eligibility · SNAP</span>
                <span style={{ color: '#C0BAB0' }}>·</span>
                <span>Prepared {today}</span>
                <span style={{ color: '#C0BAB0' }}>·</span>
                <span style={{ color: '#c0392b', fontWeight: 500 }}>Review before submitting</span>
              </div>
            </div>

            {/* Sections */}
            <div style={c.docBody}>
              <FormSection number="I" title={t(lang, 'sectionI')}>
                <FieldRow label="Legal Name" value={fullName} />
                <FieldRow label="Date of Birth" value={d.dateOfBirth || 'Not provided'} />
                <FieldRow label="Marital Status" value={d.maritalStatus || 'Single'} />
                <FieldRow label="Contact Phone" value={d.phone || 'Not provided'} />
              </FormSection>

              <FormSection number="II" title={t(lang, 'sectionII')}>
                <FieldRow label="Current Address" value={d.address || 'Not provided'} span />
                <FieldRow label="County" value={d.county || 'Not provided'} />
                <FieldRow label="Housing Status" value={(d.expenses || {}).rent ? 'Renting' : 'Not specified'} />
              </FormSection>

              <FormSection number="III" title={t(lang, 'sectionIII')}>
                <FieldRow label="Total Members (incl. applicant)" value={String(householdSize)} />
                <FieldRow label="Children Under 18" value={String((d.householdMembers || []).filter(m => m.relationship?.toLowerCase().includes('child') || m.relationship?.toLowerCase().includes('daughter') || m.relationship?.toLowerCase().includes('son')).length || '—')} />
                {(d.householdMembers || []).map((m, i) => (
                  <FieldRow
                    key={i}
                    label={`Member ${i + 2} — ${m.relationship || 'Household Member'}`}
                    value={[m.name, m.dob ? `DOB ${m.dob}` : ''].filter(Boolean).join(' · ') || '—'}
                    span
                  />
                ))}
              </FormSection>

              <FormSection number="IV" title={t(lang, 'sectionIV')}>
                <FieldRow label="Employment Status" value={totalIncome === 0 ? 'Unemployed — No current income' : 'Employed'} />
                <FieldRow label="Monthly Gross Income" value={totalIncome > 0 ? `$${totalIncome.toLocaleString()}/month` : '$0.00'} />
                {(d.monthlyIncome || []).length > 0
                  ? (d.monthlyIncome || []).map((inc, i) => (
                      <FieldRow
                        key={i}
                        label={`Income Source ${i + 1}`}
                        value={[inc.source, inc.amount ? `$${inc.amount}` : '', inc.frequency].filter(Boolean).join(' · ')}
                        span
                      />
                    ))
                  : <FieldRow label="Income Sources" value="None reported" span />
                }
              </FormSection>

              <FormSection number="V" title={t(lang, 'sectionV')}>
                <FieldRow label="Rent / Mortgage" value={(d.expenses || {}).rent ? `$${d.expenses.rent}/month` : '$0'} />
                <FieldRow label="Utilities" value={(d.expenses || {}).utilities ? `$${d.expenses.utilities}/month` : '$0'} />
                <FieldRow label="Heating" value={(d.expenses || {}).heating ? `$${d.expenses.heating}/month` : '$0'} />
                <FieldRow label="Childcare" value={(d.expenses || {}).childcare ? `$${d.expenses.childcare}/month` : '$0'} />
              </FormSection>

              <FormSection number="VI" title={t(lang, 'sectionVI')}>
                <FieldRow label="Current Health Insurance" value="None — Currently uninsured" />
                <FieldRow label="Application For" value="Pennsylvania Medicaid / CHIP" />
              </FormSection>

              <FormSection number="VII" title={t(lang, 'sectionVII')} last>
                <p style={c.certText}>
                  I certify under penalty of perjury that the information provided in this application is true
                  and complete to the best of my knowledge. I understand that providing false information may
                  result in disqualification from benefits and applicable legal penalties.
                </p>
                <FieldRow label="Electronic Signature" value={fullName !== '—' ? fullName : '[To be signed upon submission]'} />
                <FieldRow label="Date of Certification" value={today} />
              </FormSection>
            </div>
          </motion.div>

          {/* Action block */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            style={c.actionBlock}
          >
            <div style={c.actionHeader}>
              <span style={c.actionHeaderLabel}>{t(lang, 'downloadLabel')}</span>
              <span style={c.actionHeaderSub}>{t(lang, 'downloadSub')}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button onClick={handleMedicaid} disabled={generatingMedicaid} style={c.dlPrimary}>
                {generatingMedicaid ? t(lang, 'generating') : medicaidDone ? t(lang, 'dlMedicaidDone') : t(lang, 'dlMedicaid')}
              </button>
              <button onClick={handleSnap} disabled={generatingSnap} style={c.dlSecondary}>
                {generatingSnap ? t(lang, 'generating') : snapDone ? t(lang, 'dlSnapDone') : t(lang, 'dlSnap')}
              </button>
              {snapWarned && !snapDone && (
                <p style={c.snapNote}>{t(lang, 'snapNote')}</p>
              )}
              {pdfError && <p style={{ fontSize: '12px', color: '#c0392b', margin: 0 }}>{pdfError}</p>}
              <p style={c.privacyAttestation}>{t(lang, 'privacyAttestation')}</p>
            </div>

            <div style={c.actionDivider} />

            {/* Fax button */}
            {faxInfo && faxState !== 'done' && (
              <button
                onClick={handleFax}
                disabled={faxState !== 'idle'}
                style={{
                  ...c.dlGhost,
                  width: '100%',
                  marginBottom: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1rem',
                  color: faxState === 'idle' ? '#111110' : '#555250',
                  borderColor: faxState === 'idle' ? '#D8D6CF' : '#E8E6DF',
                }}
              >
                {faxState === 'idle' && (
                  <>
                    <span style={{ fontSize: '14px' }}>📠</span>
                    <span style={{ fontSize: '12px' }}>
                      Fax to {faxInfo.county} County DHS Office
                    </span>
                  </>
                )}
                {faxState === 'searching' && (
                  <>
                    <motion.span
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                      style={{ display: 'inline-block', fontSize: '13px' }}
                    >
                      ⟳
                    </motion.span>
                    <span style={{ fontSize: '12px' }}>
                      Locating {faxInfo.county} County Assistance Office…
                    </span>
                  </>
                )}
                {faxState === 'sending' && (
                  <>
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 0.7, repeat: Infinity }}
                      style={{ fontSize: '13px' }}
                    >
                      📠
                    </motion.span>
                    <span style={{ fontSize: '12px' }}>
                      Faxing to {faxInfo.county} CAO · {faxInfo.fax}…
                    </span>
                  </>
                )}
              </button>
            )}
            {faxState === 'done' && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.75rem 1rem',
                  background: '#F0F9F4',
                  border: '1px solid #C8E8D8',
                  marginBottom: '0.5rem',
                }}
              >
                <span style={{ fontSize: '14px' }}>✓</span>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: '#1C3A2A', margin: 0 }}>
                    Sent to {faxInfo.county} County Assistance Office
                  </p>
                  <p style={{ fontSize: '11px', color: '#888682', margin: '2px 0 0' }}>
                    Fax · {faxInfo.fax} · Your documents are on their way.
                  </p>
                </div>
              </motion.div>
            )}

            <div style={c.actionDivider} />

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={onReturn} style={{ ...c.dlGhost, flex: 1 }}>{t(lang, 'continueBtn')}</button>
              <button onClick={onReset} style={{ ...c.dlGhost, flex: 1 }}>{t(lang, 'resetBtn')}</button>
            </div>
          </motion.div>

          {/* Next steps */}
          <div style={c.nextSteps}>
            <p style={c.nextStepsLabel}>{t(lang, 'nextStepsLabel')}</p>
            <div style={c.nextStepsList}>
              {t(lang, 'nextSteps').map(([title, detail], i) => (
                <div key={i} style={c.nextStep}>
                  <span style={c.nextStepNum}>{String(i + 1).padStart(2, '0')}</span>
                  <div>
                    <p style={c.nextStepTitle}>{title}</p>
                    <p style={c.nextStepDetail}>{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </motion.div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

// Animates text typing in character by character on each new value
function TypingText({ text }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!text) { setDisplayed(''); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i += 4;
      if (i >= text.length) {
        setDisplayed(text);
        setDone(true);
        clearInterval(timer);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <span>
      {displayed}
      {!done && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 0.8, repeat: Infinity }}
          style={{ display: 'inline-block', width: '1px', height: '1em', background: '#888682', marginLeft: '1px', verticalAlign: 'text-bottom' }}
        />
      )}
    </span>
  );
}

function FormSection({ number, title, children, last = false }) {
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid #E8E6DF', marginBottom: last ? 0 : '0', paddingBottom: 0 }}>
      <div style={c.sectionHead}>
        <span style={c.sectionNum}>{number}</span>
        <span style={c.sectionTitle}>{title.toUpperCase()}</span>
      </div>
      <div style={c.sectionBody}>
        {children}
      </div>
    </div>
  );
}

function FieldRow({ label, value, span = false }) {
  return (
    <div style={{ gridColumn: span ? '1 / -1' : 'auto', borderBottom: '1px solid #F0EDE6', paddingBottom: '0.7rem', marginBottom: '0' }}>
      <p style={c.fieldLabel}>{label}</p>
      <p style={c.fieldValue}>{value}</p>
    </div>
  );
}

// ── Design tokens ─────────────────────────────────────────────────────────────

const c = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#F7F6F3',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#111110',
  },
  screen: {
    height: '100vh',
    overflow: 'hidden',
  },

  // ── Top bar
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1.5rem',
    borderBottom: '1px solid #D8D6CF',
    background: '#F7F6F3',
    flexShrink: 0,
  },
  wordmark: {
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.2em',
    color: '#111110',
  },
  topBarRight: {
    fontSize: '11px',
    letterSpacing: '0.1em',
    color: '#888682',
    textTransform: 'uppercase',
  },
  returnLink: {
    fontSize: '12px',
    color: '#555250',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
  },
  ghostSmall: {
    fontSize: '11px',
    color: '#888682',
    background: 'none',
    border: '1px solid #D8D6CF',
    padding: '3px 10px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.03em',
  },

  // ── Landing
  landingBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '3rem 1.5rem 2rem',
    maxWidth: '580px',
  },
  landingEyebrow: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#888682',
    margin: '0 0 1.5rem',
  },
  landingHeadline: {
    fontSize: 'clamp(2.8rem, 8vw, 4.5rem)',
    fontWeight: 500,
    lineHeight: 1.08,
    letterSpacing: '-0.02em',
    color: '#111110',
    margin: '0 0 1.75rem',
  },
  landingBody2: {
    fontSize: '15px',
    lineHeight: 1.7,
    color: '#555250',
    margin: 0,
    maxWidth: '480px',
  },
  beginBtn: {
    display: 'inline-block',
    padding: '0.85rem 2rem',
    background: '#1C3A2A',
    color: '#F7F6F3',
    border: 'none',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginBottom: '2rem',
  },
  programStrip: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0',
    alignItems: 'center',
  },
  programTag: {
    fontSize: '12px',
    color: '#888682',
    letterSpacing: '0.05em',
  },
  landingFooter: {
    padding: '1rem 1.5rem',
    borderTop: '1px solid #D8D6CF',
    flexShrink: 0,
  },
  footerText: {
    fontSize: '11px',
    color: '#B0ADA6',
  },

  // ── WhatsApp
  whatsappRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.85rem',
    marginTop: '1.75rem',
    padding: '0.85rem 1rem',
    background: '#F0EDE6',
    border: '1px solid #D8D6CF',
    maxWidth: '340px',
  },
  whatsappQR: {
    flexShrink: 0,
  },
  whatsappLabel: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#111110',
    margin: '0 0 2px',
  },
  whatsappSub: {
    fontSize: '11px',
    color: '#888682',
    margin: 0,
    lineHeight: 1.5,
  },

  // ── Trust / security
  trustRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    marginTop: '1.5rem',
  },
  trustLock: {
    fontSize: '12px',
  },
  trustText: {
    fontSize: '11px',
    color: '#888682',
    letterSpacing: '0.02em',
  },
  privacyBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '0.5rem',
    padding: '0.75rem 1.5rem',
    background: '#EDF7F2',
    borderBottom: '1px solid #C8E8D8',
    fontSize: '12px',
    color: '#1C5C3A',
    lineHeight: 1.55,
    overflow: 'hidden',
  },
  privacyAttestation: {
    fontSize: '11px',
    color: '#888682',
    margin: '0.6rem 0 0',
    letterSpacing: '0.01em',
    lineHeight: 1.5,
  },

  // ── Intake / transcript
  transcriptLabel: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    color: '#C0BAB0',
    padding: '1.25rem 1.5rem 0.75rem',
    borderBottom: '1px solid #E8E6DF',
    marginBottom: 0,
  },
  transcriptRow: {
    display: 'flex',
    gap: '1rem',
    padding: '1.1rem 1.5rem',
    borderBottom: '1px solid #E8E6DF',
    alignItems: 'flex-start',
  },
  transcriptRowUser: {
    background: '#EFEDE6',
  },
  lineNum: {
    fontSize: '10px',
    color: '#C0BAB0',
    fontVariantNumeric: 'tabular-nums',
    fontFeatureSettings: '"tnum"',
    width: '1.4rem',
    flexShrink: 0,
    paddingTop: '2px',
    letterSpacing: '0.05em',
  },
  speaker: {
    display: 'block',
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: '#B0ADA6',
    marginBottom: '0.3rem',
    textTransform: 'uppercase',
  },
  speakerUser: {
    color: '#1C3A2A',
  },
  transcriptText: {
    fontSize: '14px',
    lineHeight: 1.65,
    color: '#111110',
    margin: 0,
  },
  transcriptTextUser: {
    color: '#1A2E22',
  },
  exampleBtn: {
    fontSize: '12px',
    color: '#555250',
    background: 'transparent',
    border: '1px solid #D8D6CF',
    padding: '0.55rem 1rem',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.01em',
  },
  reviewPrompt: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '1rem',
    padding: '1.25rem 1.5rem',
    background: '#1C3A2A',
    flexWrap: 'wrap',
  },
  reviewBtn: {
    padding: '0.6rem 1.25rem',
    background: '#F7F6F3',
    color: '#1C3A2A',
    border: 'none',
    fontSize: '12px',
    fontWeight: 600,
    letterSpacing: '0.04em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
  },

  // ── Input area
  inputArea: {
    borderTop: '1px solid #D8D6CF',
    padding: '0.85rem 1.5rem',
    background: '#F7F6F3',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.6rem',
  },
  inputIconBtn: {
    flexShrink: 0,
    width: '2.2rem',
    height: '2.2rem',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  inputTextarea: {
    flex: 1,
    border: '1px solid #D8D6CF',
    padding: '0.55rem 0.8rem',
    fontSize: '14px',
    lineHeight: 1.55,
    resize: 'none',
    fontFamily: 'inherit',
    background: '#fff',
    color: '#111110',
    outline: 'none',
  },
  inputHint: {
    fontSize: '10px',
    color: '#C0BAB0',
    margin: '0.4rem 0 0',
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
  },

  // ── Document / eligibility
  eligBlock: {
    background: '#fff',
    border: '1px solid #D8D6CF',
    marginBottom: '1.5rem',
  },
  eligHeader: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    padding: '0.85rem 1.25rem',
    borderBottom: '1px solid #E8E6DF',
  },
  eligHeaderLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#111110',
  },
  eligHeaderSub: {
    fontSize: '11px',
    color: '#888682',
  },
  eligGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  },
  eligItem: {
    padding: '0.9rem 1.25rem',
    borderRight: '1px solid #E8E6DF',
    borderBottom: '1px solid #E8E6DF',
  },
  eligYes: {
    background: '#F0F9F4',
  },
  eligMaybe: {
    background: '#FEFCE8',
  },
  eligNo: {
    background: '#fff',
    opacity: 0.6,
  },
  eligItemTop: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  eligIcon: {
    fontSize: '14px',
  },
  eligName: {
    fontSize: '12px',
    fontWeight: 500,
    color: '#111110',
    flex: 1,
  },
  eligStatus: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: '#1C3A2A',
    textTransform: 'uppercase',
    display: 'block',
    marginTop: '0.3rem',
    width: '100%',
    paddingLeft: '0',
  },
  urgentFlag: {
    fontSize: '10px',
    color: '#c0392b',
    marginTop: '0.4rem',
    letterSpacing: '0.02em',
  },

  // ── Document
  docWrap: {
    background: '#fff',
    border: '1px solid #D8D6CF',
    marginBottom: '1.5rem',
  },
  docMasthead: {
    padding: '1.5rem 1.5rem 1.25rem',
    borderBottom: '2px solid #111110',
  },
  docFormRef: {
    fontSize: '10px',
    fontWeight: 600,
    letterSpacing: '0.18em',
    color: '#888682',
    marginBottom: '0.5rem',
    textTransform: 'uppercase',
  },
  docMainTitle: {
    fontSize: '20px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    margin: '0 0 0.4rem',
    color: '#111110',
  },
  docSubRow: {
    display: 'flex',
    gap: '0.6rem',
    alignItems: 'center',
    fontSize: '12px',
    color: '#888682',
    flexWrap: 'wrap',
  },
  docBody: {
    padding: '0',
  },
  sectionHead: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.5rem',
    borderBottom: '1px solid #E8E6DF',
    background: '#F7F6F3',
  },
  sectionNum: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#888682',
    letterSpacing: '0.1em',
    width: '1rem',
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#111110',
  },
  sectionBody: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0',
    padding: '1rem 1.5rem',
    rowGap: '0.85rem',
    columnGap: '2rem',
  },
  fieldLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#888682',
    margin: '0 0 3px',
    fontWeight: 500,
  },
  fieldValue: {
    fontSize: '13px',
    color: '#111110',
    margin: 0,
    fontWeight: 400,
    lineHeight: 1.4,
  },
  certText: {
    gridColumn: '1 / -1',
    fontSize: '12px',
    lineHeight: 1.75,
    color: '#555250',
    margin: '0 0 1rem',
    borderBottom: '1px solid #F0EDE6',
    paddingBottom: '1rem',
  },

  // ── Action block
  actionBlock: {
    background: '#fff',
    border: '1px solid #D8D6CF',
    padding: '1.25rem 1.5rem',
    marginBottom: '1.5rem',
  },
  actionHeader: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.2rem',
    marginBottom: '1rem',
  },
  actionHeaderLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#111110',
  },
  actionHeaderSub: {
    fontSize: '12px',
    color: '#888682',
  },
  dlPrimary: {
    width: '100%',
    padding: '0.85rem 1.25rem',
    background: '#1C3A2A',
    color: '#F7F6F3',
    border: 'none',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  dlSecondary: {
    width: '100%',
    padding: '0.85rem 1.25rem',
    background: 'transparent',
    color: '#111110',
    border: '1px solid #D8D6CF',
    fontSize: '13px',
    fontWeight: 500,
    letterSpacing: '0.02em',
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'left',
  },
  dlGhost: {
    padding: '0.75rem 0',
    background: 'transparent',
    color: '#888682',
    border: '1px solid #E8E6DF',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: '0.02em',
  },
  actionDivider: {
    height: '1px',
    background: '#E8E6DF',
    margin: '1rem 0',
  },
  snapNote: {
    fontSize: '12px',
    color: '#7C3A00',
    background: '#FEF3C7',
    border: '1px solid #FDE68A',
    padding: '0.6rem 0.85rem',
    margin: 0,
    lineHeight: 1.5,
  },

  // ── Next steps
  nextSteps: {
    background: '#fff',
    border: '1px solid #D8D6CF',
    padding: '1.25rem 1.5rem',
    marginBottom: '3rem',
  },
  nextStepsLabel: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.18em',
    color: '#888682',
    margin: '0 0 1rem',
  },
  nextStepsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.85rem',
  },
  nextStep: {
    display: 'flex',
    gap: '1rem',
    alignItems: 'flex-start',
  },
  nextStepNum: {
    fontSize: '10px',
    fontWeight: 700,
    color: '#C0BAB0',
    letterSpacing: '0.05em',
    flexShrink: 0,
    paddingTop: '1px',
    fontVariantNumeric: 'tabular-nums',
  },
  nextStepTitle: {
    fontSize: '13px',
    fontWeight: 500,
    color: '#111110',
    margin: '0 0 2px',
  },
  nextStepDetail: {
    fontSize: '12px',
    color: '#888682',
    margin: 0,
  },
};
