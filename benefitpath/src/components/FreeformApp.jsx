import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square, Send, ArrowLeft, FileText, RotateCcw } from 'lucide-react';
import { sendToGemini, mergeExtractedData } from '../utils/geminiClient.js';
import { calculateEligibility } from '../utils/eligibility.js';
import { generateMedicaidPDF, generateSnapPDF, downloadPDF } from '../utils/pdfGenerator.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { useSession } from '../hooks/useSession.js';

const WELCOME = {
  id: 'welcome',
  role: 'system',
  content: "Hi — I'm Freeform. Tell me what's going on in your life right now. I'll figure out what benefits you qualify for and fill out the forms for you.",
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

  const messages = (savedMessages.length === 0 && isLoaded)
    ? [WELCOME]
    : (savedMessages.length > 0 ? savedMessages : [WELCOME]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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
      const apiMessages = nextMessages.map(m => ({
        role: m.role === 'system' ? 'assistant' : 'user',
        content: m.content,
      }));
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
        setTimeout(() => setScreen('form-preview'), 500);
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(inputText); }
  }

  async function handleDownloadMedicaid() {
    setGeneratingMedicaid(true);
    setPdfError(null);
    try {
      const bytes = await generateMedicaidPDF(extractedData);
      downloadPDF(bytes, 'PA-Medicaid-Application.pdf');
      setMedicaidDone(true);
    } catch (err) {
      setPdfError('Could not generate Medicaid PDF. Please try again.');
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
    <div style={s.root}>
      <AnimatePresence mode="wait">

        {/* ── CONVERSATION ──────────────────────────────────────────────────── */}
        {screen === 'conversation' && (
          <motion.div key="conversation"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <header style={s.header}>
              <div style={s.headerBrand}>
                <span style={s.brandDot} />
                <span style={s.brandName}>Freeform</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={s.statusPill}>● Live</span>
                <button onClick={onSwitchDesign} style={s.switchBtn}>Classic</button>
              </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1.25rem 0' }}>
              {messages.map((msg, i) => (
                <motion.div key={msg.id || i}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.35) }}
                  style={{ marginBottom: '1.25rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}
                >
                  <div style={{ ...s.roleChip, ...(msg.role === 'user' ? s.roleChipUser : {}) }}>
                    {msg.role === 'system' ? 'AI' : 'You'}
                  </div>
                  <div style={{ ...s.bubble, ...(msg.role === 'user' ? s.bubbleUser : s.bubbleAI) }}>
                    {msg.content}
                  </div>
                </motion.div>
              ))}

              {isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', marginBottom: '1.25rem' }}
                >
                  <div style={s.roleChip}>AI</div>
                  <div style={{ ...s.bubble, ...s.bubbleAI, padding: '0.6rem 0.9rem' }}>
                    <span style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <motion.span key={i}
                          animate={{ opacity: [0.25, 1, 0.25] }}
                          transition={{ duration: 1.1, repeat: Infinity, delay: i * 0.18 }}
                          style={{ display: 'block', width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }}
                        />
                      ))}
                    </span>
                  </div>
                </motion.div>
              )}

              {interimText && (
                <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <div style={{ ...s.roleChip, background: '#fee2e2', color: '#dc2626' }}>Mic</div>
                  <div style={{ fontSize: '14px', color: '#94a3b8', fontStyle: 'italic', paddingTop: '2px' }}>{interimText}…</div>
                </div>
              )}

              {messages.length <= 1 && !isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                  style={{ marginLeft: '2.75rem', marginBottom: '1.25rem' }}
                >
                  <button onClick={() => sendMessage(EXAMPLE_TEXT)} style={s.exampleBtn}>
                    Try an example →
                  </button>
                </motion.div>
              )}

              {canReview && !isTyping && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid #e2e8f0', marginBottom: '1.5rem' }}
                >
                  <button onClick={() => setScreen('form-preview')} style={s.reviewBtn}>
                    <FileText size={15} />
                    Review my application
                  </button>
                </motion.div>
              )}

              <div ref={bottomRef} style={{ height: '1rem' }} />
            </div>

            <div style={s.inputArea}>
              <div style={s.inputRow}>
                {isSupported && (
                  <button onClick={toggleListening}
                    style={{ ...s.iconBtn, background: isListening ? '#ef4444' : '#1e293b' }}
                    title={isListening ? 'Stop recording' : 'Speak'}
                  >
                    {isListening ? <Square size={13} color="#fff" /> : <Mic size={13} color="#fff" />}
                  </button>
                )}
                <textarea ref={inputRef} value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={isListening ? 'Listening…' : 'Describe your situation, or answer the question above…'}
                  rows={2} disabled={isTyping || isListening}
                  style={s.textarea}
                />
                <button onClick={() => sendMessage(inputText)}
                  disabled={!inputText.trim() || isTyping}
                  style={{ ...s.iconBtn, background: '#1e293b', opacity: (!inputText.trim() || isTyping) ? 0.35 : 1 }}
                >
                  <Send size={13} color="#fff" />
                </button>
              </div>
              <p style={s.inputHint}>Enter to send · Shift+Enter for new line{isListening ? ' · Recording…' : ''}</p>
            </div>
          </motion.div>
        )}

        {/* ── FORM PREVIEW ──────────────────────────────────────────────────── */}
        {screen === 'form-preview' && (
          <motion.div key="form-preview"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
          >
            <header style={s.header}>
              <button onClick={() => setScreen('conversation')} style={s.returnBtn}>
                <ArrowLeft size={13} /> Back
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ ...s.statusPill, background: '#fef9c3', color: '#854d0e', borderColor: '#fde68a' }}>Draft</span>
                <button onClick={onSwitchDesign} style={s.switchBtn}>Classic</button>
              </div>
            </header>

            <div style={{ flex: 1, overflowY: 'auto', background: '#f8fafc', padding: '1.25rem' }}>

              {/* Eligibility strip */}
              {results.length > 0 && (
                <div style={s.eligStrip}>
                  <span style={s.eligLabel}>Eligibility</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {eligible.map(r => <span key={r.program} style={s.badgeGreen}>{r.icon} {r.programName}</span>)}
                    {maybe.map(r => <span key={r.program} style={s.badgeYellow}>{r.icon} {r.programName}</span>)}
                  </div>
                </div>
              )}

              {/* Document */}
              <div style={s.doc}>
                <div style={s.docHeader}>
                  <div style={s.docFormId}>Pennsylvania Benefit Application · {new Date().toLocaleDateString('en-US')}</div>
                  <h2 style={s.docTitle}>Medicaid Financial Eligibility &amp; SNAP</h2>
                  <p style={s.docSub}>Pre-filled from your conversation · Review before submitting</p>
                </div>

                <div style={{ padding: '1.25rem' }}>
                  <Section title="I. Applicant Information">
                    <Row label="Full Name" value={fullName} />
                    <Row label="Date of Birth" value={d.dateOfBirth || 'Not provided'} />
                    <Row label="Marital Status" value={d.maritalStatus || 'Single'} />
                    <Row label="Phone Number" value={d.phone || 'Not provided'} />
                  </Section>

                  <Section title="II. Residence">
                    <Row label="Current Address" value={d.address || 'Not provided'} />
                    <Row label="County" value={d.county || 'Not provided'} />
                    <Row label="Housing Status" value={(d.expenses || {}).rent ? 'Renting' : 'Not specified'} />
                  </Section>

                  <Section title="III. Household Composition">
                    <Row label="Total Members (incl. applicant)" value={String(householdSize)} />
                    {(d.householdMembers || []).length > 0
                      ? (d.householdMembers || []).map((m, i) => (
                          <Row key={i} label={`Member ${i + 2}`} value={[m.name, m.relationship, m.dob ? `DOB ${m.dob}` : ''].filter(Boolean).join(' · ')} />
                        ))
                      : <Row label="Additional Members" value="None listed" />
                    }
                  </Section>

                  <Section title="IV. Income &amp; Employment">
                    <Row label="Employment Status" value={totalIncome === 0 ? 'Unemployed / No current income' : 'Employed'} />
                    <Row label="Monthly Gross Income" value={totalIncome > 0 ? `$${totalIncome.toLocaleString()}` : '$0.00'} />
                    {(d.monthlyIncome || []).length > 0
                      ? (d.monthlyIncome || []).map((inc, i) => (
                          <Row key={i} label={`Source ${i + 1}`} value={[inc.source, inc.amount ? `$${inc.amount}` : '', inc.frequency].filter(Boolean).join(' · ')} />
                        ))
                      : <Row label="Income Sources" value="None — recently unemployed" />
                    }
                  </Section>

                  <Section title="V. Monthly Expenses">
                    <Row label="Rent / Mortgage" value={(d.expenses || {}).rent ? `$${d.expenses.rent}/mo` : '$0'} />
                    <Row label="Utilities" value={(d.expenses || {}).utilities ? `$${d.expenses.utilities}/mo` : '$0'} />
                    <Row label="Heating" value={(d.expenses || {}).heating ? `$${d.expenses.heating}/mo` : '$0'} />
                    <Row label="Childcare" value={(d.expenses || {}).childcare ? `$${d.expenses.childcare}/mo` : '$0'} />
                  </Section>

                  <Section title="VI. Medical Coverage">
                    <Row label="Current Insurance" value="None — Uninsured" />
                    <Row label="Applying For" value="Pennsylvania Medicaid / CHIP" />
                  </Section>

                  <Section title="VII. Certification" last>
                    <p style={{ fontSize: '12px', lineHeight: 1.7, color: '#64748b', margin: '0 0 1rem' }}>
                      I certify under penalty of perjury that the information provided is true and complete to the best
                      of my knowledge. I understand that providing false information may result in disqualification and legal penalties.
                    </p>
                    <Row label="Signature" value={fullName !== '—' ? fullName : '[To be signed]'} />
                    <Row label="Date" value={new Date().toLocaleDateString('en-US')} />
                  </Section>
                </div>
              </div>

              {/* Downloads */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.25rem' }}>
                <button onClick={handleDownloadMedicaid} disabled={generatingMedicaid} style={s.dlPrimary}>
                  {generatingMedicaid ? 'Generating…' : medicaidDone ? '✓ Medicaid Application Downloaded' : '↓ Download Medicaid Application (PDF)'}
                </button>
                <button onClick={handleDownloadSnap} disabled={generatingSnap} style={s.dlSecondary}>
                  {generatingSnap ? 'Generating…' : snapDone ? '✓ SNAP Application Downloaded' : '↓ Download SNAP Application (PDF)'}
                </button>
                {snapWarned && !snapDone && (
                  <p style={s.snapNote}>We focused on Medicaid for this demo — SNAP form filling is still in progress. Click again to try anyway.</p>
                )}
                {pdfError && <p style={{ fontSize: '12px', color: '#dc2626', margin: 0 }}>{pdfError}</p>}
                <button onClick={() => { resetSession(); setScreen('conversation'); }} style={s.dlGhost}>
                  <RotateCcw size={12} /> Start New Application
                </button>
              </div>

              {/* Next steps */}
              <div style={s.nextSteps}>
                <p style={s.nextStepsTitle}>Next Steps</p>
                <ol style={{ margin: '0.5rem 0 0', padding: '0 0 0 1.3rem', color: '#475569', fontSize: '13px', lineHeight: 1.8 }}>
                  <li>Download and review your pre-filled applications above</li>
                  <li>Sign and date the last page of each form</li>
                  <li>Submit at <strong>compass.state.pa.us</strong> or your county DHS office</li>
                  <li>LIHEAP heating help — call <strong>1-800-692-7462</strong> before May 8, 2026</li>
                  <li>WIC — call <strong>1-800-WIC-WINS</strong> to find your nearest clinic</li>
                </ol>
              </div>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Section({ title, children, last = false }) {
  return (
    <div style={{ marginBottom: last ? 0 : '1.5rem', paddingBottom: last ? 0 : '1.5rem', borderBottom: last ? 'none' : '1px solid #e2e8f0' }}>
      <p style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#94a3b8', margin: '0 0 0.9rem' }}>{title}</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem 1.5rem' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#94a3b8', margin: '0 0 2px' }}>{label}</p>
      <p style={{ fontSize: '13px', color: '#1e293b', margin: 0, fontWeight: 500, wordBreak: 'break-word' }}>{value}</p>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  root: {
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#fff',
    fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
    color: '#1e293b',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1.25rem',
    borderBottom: '1px solid #e2e8f0',
    background: '#fff',
    flexShrink: 0,
  },
  headerBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
  },
  brandDot: {
    display: 'block',
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#3b82f6',
  },
  brandName: {
    fontSize: '14px',
    fontWeight: 600,
    letterSpacing: '-0.01em',
    color: '#0f172a',
  },
  statusPill: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '2px 8px',
    borderRadius: '99px',
    background: '#dcfce7',
    color: '#166534',
    border: '1px solid #bbf7d0',
  },
  switchBtn: {
    fontSize: '11px',
    padding: '3px 10px',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    background: '#f8fafc',
    color: '#64748b',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  returnBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    fontSize: '13px',
    color: '#64748b',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'inherit',
  },
  roleChip: {
    flexShrink: 0,
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 7px',
    borderRadius: '4px',
    background: '#f1f5f9',
    color: '#64748b',
    marginTop: '3px',
    letterSpacing: '0.05em',
  },
  roleChipUser: {
    background: '#eff6ff',
    color: '#2563eb',
  },
  bubble: {
    fontSize: '14px',
    lineHeight: 1.65,
    borderRadius: '10px',
    padding: '0.65rem 0.9rem',
    maxWidth: 'calc(100% - 3rem)',
  },
  bubbleAI: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    color: '#1e293b',
  },
  bubbleUser: {
    background: '#eff6ff',
    border: '1px solid #dbeafe',
    color: '#1e293b',
  },
  exampleBtn: {
    fontSize: '12px',
    color: '#3b82f6',
    background: '#eff6ff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    padding: '5px 12px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  reviewBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    width: '100%',
    padding: '0.75rem',
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  inputArea: {
    borderTop: '1px solid #e2e8f0',
    padding: '0.9rem 1.25rem',
    background: '#fff',
    flexShrink: 0,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '0.6rem',
  },
  iconBtn: {
    flexShrink: 0,
    width: '2.4rem',
    height: '2.4rem',
    borderRadius: '8px',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'opacity 0.15s, background 0.15s',
  },
  textarea: {
    flex: 1,
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    padding: '0.55rem 0.75rem',
    fontSize: '14px',
    lineHeight: 1.5,
    resize: 'none',
    fontFamily: 'inherit',
    background: '#f8fafc',
    color: '#1e293b',
    outline: 'none',
  },
  inputHint: {
    fontSize: '10px',
    color: '#cbd5e1',
    margin: '0.4rem 0 0',
    letterSpacing: '0.03em',
  },

  // Form preview
  eligStrip: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '0.6rem',
    marginBottom: '1rem',
    padding: '0.7rem 1rem',
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
  },
  eligLabel: {
    fontSize: '11px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
    marginRight: '0.25rem',
  },
  badgeGreen: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '99px',
    background: '#f0fdf4',
    border: '1px solid #bbf7d0',
    color: '#166534',
  },
  badgeYellow: {
    fontSize: '11px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '99px',
    background: '#fefce8',
    border: '1px solid #fde68a',
    color: '#854d0e',
  },
  doc: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    marginBottom: '1rem',
    overflow: 'hidden',
  },
  docHeader: {
    borderBottom: '1px solid #e2e8f0',
    padding: '1rem 1.25rem',
    background: '#f8fafc',
  },
  docFormId: {
    fontSize: '10px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#94a3b8',
    marginBottom: '0.3rem',
    fontWeight: 500,
  },
  docTitle: {
    fontSize: '16px',
    fontWeight: 600,
    margin: '0 0 0.2rem',
    color: '#0f172a',
  },
  docSub: {
    fontSize: '12px',
    color: '#64748b',
    margin: 0,
  },
  dlPrimary: {
    width: '100%',
    padding: '0.8rem',
    background: '#0f172a',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dlSecondary: {
    width: '100%',
    padding: '0.8rem',
    background: '#fff',
    color: '#0f172a',
    border: '1px solid #0f172a',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dlGhost: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    width: '100%',
    padding: '0.8rem',
    background: 'transparent',
    color: '#64748b',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  snapNote: {
    fontSize: '12px',
    color: '#92400e',
    background: '#fef3c7',
    border: '1px solid #fde68a',
    borderRadius: '6px',
    padding: '0.6rem 0.9rem',
    margin: 0,
  },
  nextSteps: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: '10px',
    padding: '1rem 1.25rem',
    marginBottom: '1.5rem',
  },
  nextStepsTitle: {
    fontSize: '12px',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#94a3b8',
    margin: 0,
  },
};
