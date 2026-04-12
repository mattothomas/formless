import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Send } from 'lucide-react';
import { sendToGemini, mergeExtractedData } from '../utils/geminiClient.js';
import { calculateEligibility } from '../utils/eligibility.js';
import { generateMedicaidPDF, generateSnapPDF, downloadPDF } from '../utils/pdfGenerator.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSession } from '../hooks/useSession.js';

const WELCOME = {
  id: 'welcome',
  role: 'system',
  content: 'Describe your situation in your own words — what\'s going on for you right now?',
};

const EXAMPLE_TEXT = "I just lost my job at the warehouse. I have a 4-year-old daughter and I can't pay rent next month. I live in Philadelphia.";

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

  const [screen, setScreen] = useState('conversation');
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [snapWarned, setSnapWarned] = useState(false);
  const [generatingMedicaid, setGeneratingMedicaid] = useState(false);
  const [generatingSnap, setGeneratingSnap] = useState(false);
  const [medicaidDone, setMedicaidDone] = useState(false);
  const [snapDone, setSnapDone] = useState(false);
  const [pdfError, setPdfError] = useState(null);

  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Messages — seed with welcome if empty
  const messages = (savedMessages.length === 0 && isLoaded)
    ? [WELCOME]
    : (savedMessages.length > 0 ? savedMessages : [WELCOME]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // If session already had results, go to form view
  useEffect(() => {
    if (isLoaded && eligibilityResults && eligibilityResults.length > 0) {
      setScreen('form-preview');
    }
  }, [isLoaded]); // eslint-disable-line

  const handleTranscript = useCallback((text) => {
    setInputText(prev => prev ? prev + ' ' + text : text);
  }, []);

  const { isListening, isSupported, interimText, toggleListening } = useSpeech({
    onTranscript: handleTranscript,
  });

  async function sendMessage(text) {
    if (!text.trim() || isTyping) return;
    setInputText('');

    const userMsg = { id: Date.now().toString(), role: 'user', content: text.trim() };
    const nextMessages = [...messages.filter(m => m.id !== 'welcome'), userMsg];
    setMessages(nextMessages);
    setIsTyping(true);

    try {
      const apiMessages = nextMessages.map(m => ({ role: m.role === 'system' ? 'assistant' : 'user', content: m.content }));
      const response = await sendToGemini(apiMessages, apiKey);

      const assistantMsg = { id: (Date.now() + 1).toString(), role: 'system', content: response.message };
      const updatedMessages = [...nextMessages, assistantMsg];
      setMessages(updatedMessages);

      const mergedData = mergeExtractedData(extractedData, response.extractedData);
      setExtractedData(mergedData);

      if (response.readyForResults || response.isComplete) {
        const results = calculateEligibility(mergedData);
        setEligibilityResults(results);
        await persist(updatedMessages, mergedData, results);
        setTimeout(() => setScreen('form-preview'), 400);
      } else {
        await persist(updatedMessages, mergedData, null);
      }
    } catch (err) {
      const errMsg = { id: (Date.now() + 1).toString(), role: 'system', content: 'Something went wrong. Please try again.' };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  async function handleDownloadMedicaid() {
    setGeneratingMedicaid(true);
    setPdfError(null);
    try {
      const bytes = await generateMedicaidPDF(extractedData);
      downloadPDF(bytes, 'PA-Medicaid-Application.pdf');
      setMedicaidDone(true);
    } catch (err) {
      setPdfError('Could not generate PDF. Please try again.');
    } finally {
      setGeneratingMedicaid(false);
    }
  }

  async function handleDownloadSnap() {
    if (!snapWarned) { setSnapWarned(true); return; }
    setGeneratingSnap(true);
    try {
      const bytes = await generateSnapPDF(extractedData);
      downloadPDF(bytes, 'PA-SNAP-Application.pdf');
      setSnapDone(true);
    } catch (err) {
      setPdfError('Could not generate SNAP PDF.');
    } finally {
      setGeneratingSnap(false);
    }
  }

  const d = extractedData || {};
  const fullName = [d.firstName, d.lastName].filter(Boolean).join(' ') || '—';
  const totalIncome = (d.monthlyIncome || []).reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
  const householdSize = (d.householdMembers || []).length + 1;
  const results = eligibilityResults || [];
  const eligible = results.filter(r => r.eligible === 'yes');
  const maybe = results.filter(r => r.eligible === 'maybe');
  const canReview = messages.filter(m => m.role === 'user').length >= 1;

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#fff', fontFamily: "'Inter', system-ui, sans-serif" }}>
      <AnimatePresence mode="wait">
        {screen === 'conversation' ? (
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            {/* Header */}
            <header style={styles.header}>
              <div style={styles.headerInner}>
                <span style={styles.brandLabel}>Freeform</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={styles.sessionLabel}>Session Active</span>
                  <button onClick={onSwitchDesign} style={styles.switchBtn}>Classic View</button>
                </div>
              </div>
            </header>

            {/* Transcript */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <div style={{ padding: '1.5rem 1rem' }}>
                {messages.map((msg, i) => (
                  <motion.div
                    key={msg.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: Math.min(i * 0.03, 0.3) }}
                    style={{ marginBottom: '1.5rem', display: 'flex', gap: '0.75rem' }}
                  >
                    <div style={{ width: '2.5rem', paddingTop: '2px', flexShrink: 0 }}>
                      <span style={styles.roleLabel}>{msg.role === 'system' ? 'SYS' : 'YOU'}</span>
                    </div>
                    <div style={{ flex: 1, fontSize: '15px', lineHeight: '1.6', color: '#111' }}>
                      {msg.content}
                    </div>
                  </motion.div>
                ))}

                {isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}
                  >
                    <div style={{ width: '2.5rem', flexShrink: 0 }}>
                      <span style={styles.roleLabel}>SYS</span>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', paddingTop: '4px' }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3] }}
                          transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                          style={{ width: 6, height: 6, borderRadius: '50%', background: '#999' }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}

                {interimText && (
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                    <div style={{ width: '2.5rem', flexShrink: 0 }}>
                      <span style={{ ...styles.roleLabel, color: '#c00' }}>MIC</span>
                    </div>
                    <div style={{ fontSize: '14px', color: '#999', fontStyle: 'italic' }}>{interimText}</div>
                  </div>
                )}

                {/* Try example */}
                {messages.length <= 1 && !isTyping && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ marginTop: '1rem', marginLeft: '3.25rem' }}>
                    <button onClick={() => sendMessage(EXAMPLE_TEXT)} style={styles.exampleBtn}>
                      Try example story →
                    </button>
                  </motion.div>
                )}

                {/* Review button */}
                {canReview && !isTyping && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e5e5e5' }}
                  >
                    <button onClick={() => setScreen('form-preview')} style={styles.primaryBtn}>
                      Review Application
                    </button>
                  </motion.div>
                )}

                <div ref={bottomRef} />
              </div>
            </div>

            {/* Input bar */}
            <div style={styles.inputBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                {isSupported && (
                  <button
                    onClick={toggleListening}
                    style={{ ...styles.micBtn, background: isListening ? '#dc2626' : '#111' }}
                  >
                    {isListening ? <Square size={14} color="#fff" /> : <Mic size={14} color="#fff" />}
                  </button>
                )}
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Listening…' : 'Type your answer, or press the mic…'}
                  rows={1}
                  disabled={isTyping || isListening}
                  style={styles.textarea}
                />
                <button
                  onClick={() => sendMessage(inputText)}
                  disabled={!inputText.trim() || isTyping}
                  style={{ ...styles.sendBtn, opacity: (!inputText.trim() || isTyping) ? 0.4 : 1 }}
                >
                  <Send size={14} color="#fff" />
                </button>
              </div>
              <div style={{ marginTop: '0.4rem', marginLeft: isSupported ? '3.25rem' : '0', fontSize: '10px', color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                {isListening ? 'Recording — press to stop' : 'Enter to send · Shift+Enter for new line'}
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            {/* Header */}
            <header style={styles.header}>
              <div style={styles.headerInner}>
                <button onClick={() => setScreen('conversation')} style={styles.returnBtn}>← Return</button>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span style={styles.sessionLabel}>Draft</span>
                  <button onClick={onSwitchDesign} style={styles.switchBtn}>Classic View</button>
                </div>
              </div>
            </header>

            {/* Document */}
            <div style={{ flex: 1, overflowY: 'auto', background: '#f5f5f5' }}>
              <div style={{ padding: '1rem' }}>

                {/* Eligibility bar */}
                {results.length > 0 && (
                  <div style={styles.eligibilityBar}>
                    <span style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#555', marginRight: '0.75rem' }}>Eligibility</span>
                    {eligible.map(r => (
                      <span key={r.program} style={styles.badgeYes}>{r.icon} {r.programName}</span>
                    ))}
                    {maybe.map(r => (
                      <span key={r.program} style={styles.badgeMaybe}>{r.icon} {r.programName}</span>
                    ))}
                  </div>
                )}

                {/* Document card */}
                <div style={styles.docCard}>
                  {/* Doc header */}
                  <div style={{ borderBottom: '1px solid #111', padding: '1rem' }}>
                    <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.15em', color: '#888', marginBottom: '0.4rem' }}>
                      PA-MEDICAID / SNAP · {new Date().toLocaleDateString('en-US')}
                    </div>
                    <h1 style={{ fontSize: '17px', fontWeight: 500, margin: 0, lineHeight: 1.3 }}>
                      Pennsylvania Benefit Application
                    </h1>
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '0.25rem' }}>
                      Medicaid Financial Eligibility · SNAP
                    </div>
                  </div>

                  {/* Doc body */}
                  <div style={{ padding: '1rem' }}>
                    <DocSection title="I. Applicant Information">
                      <DataField label="Full Name" value={fullName} />
                      <DataField label="Date of Birth" value={d.dateOfBirth || '—'} />
                      <DataField label="Marital Status" value={d.maritalStatus || 'Single'} />
                      <DataField label="Phone" value={d.phone || '—'} />
                    </DocSection>

                    <DocSection title="II. Residence">
                      <DataField label="Current Address" value={d.address || '—'} />
                      <DataField label="County" value={d.county || '—'} />
                      <DataField label="Housing Status" value={(d.expenses || {}).rent ? 'Renting' : '—'} />
                    </DocSection>

                    <DocSection title="III. Household Composition">
                      <DataField label="Total Members (incl. applicant)" value={String(householdSize)} />
                      {(d.householdMembers || []).map((m, i) => (
                        <DataField key={i} label={`Member ${i + 1}`} value={`${m.name || '—'} · ${m.relationship || ''} · DOB ${m.dob || '—'}`} />
                      ))}
                      {(d.householdMembers || []).length === 0 && (
                        <DataField label="Members" value="No additional members listed" />
                      )}
                    </DocSection>

                    <DocSection title="IV. Income &amp; Employment">
                      <DataField label="Employment Status" value={totalIncome === 0 ? 'Unemployed / No current income' : 'Employed'} />
                      <DataField label="Monthly Gross Income" value={totalIncome > 0 ? `$${totalIncome.toLocaleString()}` : '$0.00'} />
                      {(d.monthlyIncome || []).map((inc, i) => (
                        <DataField key={i} label={`Income Source ${i + 1}`} value={`${inc.source || '—'} · $${inc.amount || 0} · ${inc.frequency || ''}`} />
                      ))}
                      {(d.monthlyIncome || []).length === 0 && (
                        <DataField label="Income Sources" value="None reported — recently unemployed" />
                      )}
                    </DocSection>

                    <DocSection title="V. Expenses">
                      <DataField label="Monthly Rent" value={(d.expenses || {}).rent ? `$${d.expenses.rent}` : '$0'} />
                      <DataField label="Utilities" value={(d.expenses || {}).utilities ? `$${d.expenses.utilities}` : '$0'} />
                      <DataField label="Heating" value={(d.expenses || {}).heating ? `$${d.expenses.heating}` : '$0'} />
                      <DataField label="Childcare" value={(d.expenses || {}).childcare ? `$${d.expenses.childcare}` : '$0'} />
                    </DocSection>

                    <DocSection title="VI. Medical Coverage">
                      <DataField label="Current Insurance" value="None — Uninsured (applying for Medicaid)" />
                      <DataField label="Applying For" value="Pennsylvania Medicaid / CHIP" />
                    </DocSection>

                    <DocSection title="VII. Certification" last>
                      <div style={{ fontSize: '11px', lineHeight: 1.6, color: '#555' }}>
                        I certify under penalty of perjury that the information provided is true and complete to
                        the best of my knowledge. I understand that providing false information may result in
                        disqualification and legal penalties.
                      </div>
                      <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e5e5' }}>
                        <DataField label="Electronic Signature" value={fullName !== '—' ? fullName : '[TO BE SIGNED]'} />
                        <DataField label="Date" value={new Date().toLocaleDateString('en-US')} />
                      </div>
                    </DocSection>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
                  <button onClick={handleDownloadMedicaid} disabled={generatingMedicaid} style={styles.primaryBtn}>
                    {generatingMedicaid ? 'Generating…' : medicaidDone ? '✓ Medicaid PDF Downloaded' : '↓ Download Medicaid Application (PDF)'}
                  </button>

                  <button
                    onClick={handleDownloadSnap}
                    disabled={generatingSnap}
                    style={{ ...styles.secondaryBtn, ...(generatingSnap ? { opacity: 0.6 } : {}) }}
                  >
                    {generatingSnap ? 'Generating…' : snapDone ? '✓ SNAP PDF Downloaded' : '↓ Download SNAP Application (PDF)'}
                  </button>

                  {snapWarned && !snapDone && (
                    <div style={styles.warningNote}>
                      We focused on Medicaid for this demo — SNAP form filling is still in progress. Click again to try anyway.
                    </div>
                  )}

                  {pdfError && <div style={{ fontSize: '12px', color: '#c00', padding: '0.5rem' }}>{pdfError}</div>}

                  <button onClick={() => setScreen('conversation')} style={styles.ghostBtn}>
                    ← Continue Conversation
                  </button>

                  <button onClick={() => { resetSession(); setScreen('conversation'); }} style={styles.ghostBtn}>
                    Start New Application
                  </button>
                </div>

                {/* Next steps */}
                <div style={styles.nextSteps}>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '0.75rem', fontWeight: 500 }}>
                    Next Steps
                  </div>
                  <ol style={{ margin: 0, padding: '0 0 0 1.2rem', fontSize: '12px', lineHeight: 1.7, color: '#555' }}>
                    <li>Download and review your pre-filled applications above</li>
                    <li>Sign and date the last page of each form</li>
                    <li>Submit at <strong>compass.state.pa.us</strong> or your county DHS office</li>
                    <li>For LIHEAP heating help, call <strong>1-800-692-7462</strong> before May 8, 2026</li>
                    <li>For WIC, call <strong>1-800-WIC-WINS</strong> to find your nearest clinic</li>
                  </ol>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DocSection({ title, children, last = false }) {
  return (
    <div style={{ marginBottom: last ? 0 : '1.5rem', paddingBottom: last ? 0 : '1.5rem', borderBottom: last ? 'none' : '1px solid #e5e5e5' }}>
      <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.15em', fontWeight: 500, color: '#111', marginBottom: '1rem' }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  );
}

function DataField({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '9px', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#999', marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '13px', lineHeight: 1.5, color: '#111', fontFamily: 'monospace' }}>{value}</div>
    </div>
  );
}

const styles = {
  header: {
    borderBottom: '1px solid #111',
    padding: '0.75rem 1rem',
  },
  headerInner: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandLabel: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 500,
    color: '#111',
  },
  sessionLabel: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#999',
  },
  roleLabel: {
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#bbb',
  },
  switchBtn: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#888',
    background: 'none',
    border: '1px solid #ddd',
    padding: '3px 8px',
    cursor: 'pointer',
  },
  returnBtn: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    color: '#888',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
  },
  inputBar: {
    borderTop: '1px solid #111',
    padding: '1rem',
    background: '#fff',
  },
  micBtn: {
    flexShrink: 0,
    width: '2.75rem',
    height: '2.75rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  textarea: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    lineHeight: 1.5,
    resize: 'none',
    fontFamily: 'inherit',
    padding: '0.5rem 0',
    background: 'transparent',
  },
  sendBtn: {
    flexShrink: 0,
    width: '2.75rem',
    height: '2.75rem',
    background: '#111',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  exampleBtn: {
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    color: '#888',
    background: 'none',
    border: '1px solid #e5e5e5',
    padding: '0.4rem 0.8rem',
    cursor: 'pointer',
  },
  primaryBtn: {
    width: '100%',
    background: '#111',
    color: '#fff',
    border: 'none',
    padding: '0.9rem',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'background 0.2s',
  },
  secondaryBtn: {
    width: '100%',
    background: 'transparent',
    color: '#111',
    border: '1px solid #111',
    padding: '0.9rem',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghostBtn: {
    width: '100%',
    background: 'transparent',
    color: '#888',
    border: '1px solid #ddd',
    padding: '0.9rem',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.15em',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  eligibilityBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.4rem',
    marginBottom: '0.75rem',
    padding: '0.6rem 0.75rem',
    background: '#fff',
    border: '1px solid #e5e5e5',
  },
  badgeYes: {
    fontSize: '10px',
    padding: '2px 8px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
  },
  badgeMaybe: {
    fontSize: '10px',
    padding: '2px 8px',
    background: '#fefce8',
    border: '1px solid #fde68a',
    color: '#854d0e',
  },
  docCard: {
    background: '#fff',
    border: '1px solid #111',
    marginBottom: '1rem',
  },
  warningNote: {
    fontSize: '12px',
    color: '#92400e',
    background: '#fef3c7',
    border: '1px solid #fde68a',
    padding: '0.6rem 0.9rem',
  },
  nextSteps: {
    borderTop: '1px solid #e5e5e5',
    paddingTop: '1rem',
    marginBottom: '2rem',
  },
};
