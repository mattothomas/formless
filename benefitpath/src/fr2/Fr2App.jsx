import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

const C = {
  // Dark (conversation / revelation)
  bg:          '#0E1713',
  surface:     '#162219',
  surfaceHigh: '#1E2E23',
  text:        '#F5F0E8',
  textSec:     '#8FA899',
  textMuted:   '#4A6355',
  gold:        '#D4A847',
  amber:       '#C4854A',
  green:       '#4AAF7C',
  border:      '#243D2E',
  borderLight: '#2D4A38',
  // Light (package / steps)
  lBg:         '#F7F4EE',
  lSurface:    '#FFFFFF',
  lText:       '#111210',
  lTextSec:    '#6B7A72',
  lForest:     '#1C3A2A',
  lGold:       '#C49B3A',
  lBorder:     '#E2DDD6',
  lAmber:      '#B8600A',
};

const F = {
  serif: "'Fraunces', Georgia, serif",
  sans:  "'DM Sans', system-ui, sans-serif",
  mono:  "'JetBrains Mono', monospace",
};

// ─────────────────────────────────────────────────────────────────────────────
// Demo data
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_TURNS = [
  {
    ai: `Thank you for reaching out. I want you to know — I'm entirely on your side, and I'm going to find every bit of support your family is entitled to.\n\nTo start, can you tell me a little about your household? Who lives with you?`,
  },
  {
    ai: `Got it — two kids. That already opens up several programs for you.\n\nAnd what's coming in each month right now? Work, benefits, anything at all? It's completely okay if the answer is nothing at the moment.`,
  },
  {
    ai: "I have everything I need. Let me show you what I found for your family.",
    final: true,
  },
];

const DEMO_ELIGIBILITY = [
  {
    id: 'snap',
    name: 'Food Assistance',
    acronym: 'SNAP',
    eligible: 'yes',
    icon: '🍎',
    monthly: 768,
    annual: 9216,
    desc: 'Monthly food assistance loaded to an EBT card',
    confident: true,
  },
  {
    id: 'medicaid',
    name: 'Healthcare',
    acronym: 'Medicaid',
    eligible: 'yes',
    icon: '🏥',
    monthly: null,
    annual: 6000,
    desc: 'Free health coverage for you and your 2 children',
    confident: true,
  },
  {
    id: 'liheap',
    name: 'Heating Help',
    acronym: 'LIHEAP',
    eligible: 'yes',
    icon: '🔥',
    monthly: null,
    annual: 600,
    desc: 'Up to $600 toward your heating bill this winter',
    urgent: true,
    deadline: 'June 30',
    confident: false,
  },
  {
    id: 'tanf',
    name: 'Cash Assistance',
    acronym: 'TANF',
    eligible: 'maybe',
    icon: '💵',
    monthly: 300,
    annual: 3600,
    desc: 'Monthly cash — interview required to confirm',
    confident: false,
  },
];

const DEMO_DATA = {
  firstName: 'Maria',
  lastName: 'Santos',
  county: 'Philadelphia',
  city: 'Philadelphia, PA',
  income: 0,
  incomeLabel: '$0 / month · Unemployed',
  rent: 900,
  household: [
    { name: 'Maria Santos', role: 'You', age: 33, initials: 'MS' },
    { name: 'Lily Santos',  role: 'Daughter', age: 4,  initials: 'LS' },
    { name: 'Marco Santos', role: 'Son',      age: 7,  initials: 'MS2' },
  ],
};

const TOTAL_ANNUAL = DEMO_ELIGIBILITY
  .filter(e => e.eligible === 'yes')
  .reduce((s, e) => s + e.annual, 0);

// ─────────────────────────────────────────────────────────────────────────────
// Waveform
// ─────────────────────────────────────────────────────────────────────────────

const BARS = Array.from({ length: 32 }, (_, i) => ({
  delay:    `${((i * 0.07) % 0.9).toFixed(2)}s`,
  dur:      `${(0.75 + (i % 6) * 0.13).toFixed(2)}s`,
  maxH:     10 + (i % 9) * 7,
  color:    i % 3 === 0 ? C.green : i % 5 === 0 ? C.gold : C.textSec,
}));

function Waveform({ active = true, size = 'md', user = false }) {
  const count = size === 'sm' ? 16 : size === 'lg' ? 32 : 24;
  const height = size === 'sm' ? 28 : size === 'lg' ? 72 : 48;
  const bars = BARS.slice(0, count);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: size === 'sm' ? 2 : 3, height,
    }}>
      {bars.map((b, i) => (
        <div
          key={i}
          className="fr2-waveform-bar"
          style={{
            height: b.maxH,
            background: user ? C.text : (active ? b.color : C.textMuted),
            opacity: active ? 1 : 0.2,
            '--dur': active ? b.dur : '2s',
            '--delay': active ? b.delay : `${i * 0.05}s`,
            animationPlayState: active ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dot loader (typing indicator)
// ─────────────────────────────────────────────────────────────────────────────

function DotLoader() {
  return (
    <div className="fr2-dot-loader" style={{ display: 'flex', gap: 5, padding: '12px 0' }}>
      <span /><span /><span />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Count-up number
// ─────────────────────────────────────────────────────────────────────────────

function CountUp({ target, duration = 1800, prefix = '$', suffix = '' }) {
  const [value, setValue] = useState(0);
  const start = useRef(null);
  const raf   = useRef(null);

  useEffect(() => {
    const tick = (ts) => {
      if (!start.current) start.current = ts;
      const progress = Math.min((ts - start.current) / duration, 1);
      // Decelerate: ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);

  return (
    <span style={{ fontFamily: F.mono }}>
      {prefix}{value.toLocaleString()}{suffix}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Eligibility Card
// ─────────────────────────────────────────────────────────────────────────────

function EligCard({ program, index }) {
  const isYes   = program.eligible === 'yes';
  const isMaybe = program.eligible === 'maybe';
  const accent  = isYes ? C.gold : isMaybe ? C.amber : C.textMuted;
  const bgTint  = isYes ? 'rgba(212,168,71,0.04)' : isMaybe ? 'rgba(196,133,74,0.04)' : 'transparent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: isMaybe ? 0.75 : 1, y: 0 }}
      transition={{ duration: 0.6, delay: index * 0.55, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 14,
        padding: '1.25rem 1.4rem',
        position: 'relative',
        overflow: 'hidden',
        background: bgTint ? `linear-gradient(135deg, ${bgTint}, ${C.surface})` : C.surface,
      }}
    >
      {program.urgent && (
        <div style={{
          position: 'absolute', top: 10, right: 10,
          background: C.amber, color: '#fff',
          fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
          padding: '2px 7px', borderRadius: 20, fontFamily: F.sans,
        }}>
          ⚡ URGENT
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>{program.icon}</span>
        <div>
          <div style={{ fontFamily: F.serif, fontSize: 18, color: C.text, fontWeight: 400 }}>
            {program.name}
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted, letterSpacing: '0.08em' }}>
            {program.acronym}
          </div>
        </div>
      </div>

      <div style={{
        fontFamily: F.sans, fontSize: 10, fontWeight: 700,
        letterSpacing: '0.15em', color: accent, marginBottom: 8,
        textTransform: 'uppercase',
      }}>
        {isYes ? 'ELIGIBLE' : isMaybe ? 'LIKELY ELIGIBLE' : 'VERIFY INCOME'}
      </div>

      <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
        {program.desc}
      </div>

      {program.monthly && (
        <div style={{
          fontFamily: F.mono, fontSize: 18, color: C.text, marginTop: 10,
        }}>
          ${program.monthly.toLocaleString()}
          <span style={{ fontSize: 12, color: C.textSec, fontFamily: F.sans }}> / month</span>
        </div>
      )}
      {!program.monthly && program.annual && (
        <div style={{
          fontFamily: F.mono, fontSize: 16, color: C.text, marginTop: 10,
        }}>
          up to ${program.annual.toLocaleString()}
          <span style={{ fontFamily: F.sans, fontSize: 12, color: C.textSec }}> / year</span>
        </div>
      )}
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constellation node
// ─────────────────────────────────────────────────────────────────────────────

function CNode({ label, sublabel, center = false, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: C.surfaceHigh,
        border: `1px solid ${center ? C.green : C.border}`,
        borderRadius: 12,
        padding: center ? '1rem 1.5rem' : '0.7rem 1rem',
        textAlign: 'center',
        minWidth: center ? 180 : 120,
      }}
    >
      <div style={{
        fontFamily: F.serif,
        fontSize: center ? 17 : 14,
        color: C.text,
        fontWeight: 400,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: F.sans,
        fontSize: 11,
        color: C.textSec,
        marginTop: 3,
      }}>
        {sublabel}
      </div>
    </motion.div>
  );
}

function ConnectorLine({ horizontal = false }) {
  return (
    <div style={horizontal
      ? { width: 40, height: 1, background: C.border, alignSelf: 'center' }
      : { width: 1, height: 20, background: C.border, margin: '0 auto' }
    } />
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 0 — THRESHOLD
// ─────────────────────────────────────────────────────────────────────────────

function ThresholdScreen({ onStart }) {
  const [inputText, setInputText] = useState('');
  const [phase, setPhase] = useState('loading'); // loading | greeting | ready
  const inputRef = useRef(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('greeting'), 800);
    const t2 = setTimeout(() => { setPhase('ready'); inputRef.current?.focus(); }, 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  function handleSubmit(e) {
    e?.preventDefault();
    if (inputText.trim() || true) onStart(inputText.trim() || null);
  }

  function handleDemo() {
    onStart('demo');
  }

  return (
    <div style={{
      height: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '0 24px', position: 'relative',
    }}>
      {/* Mark / waveform */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{ marginBottom: 40 }}
      >
        <Waveform active={phase !== 'loading'} size="lg" />
      </motion.div>

      {/* Wordmark */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'loading' ? 0 : 1 }}
        transition={{ duration: 0.8 }}
        style={{
          fontFamily: F.sans, fontSize: 11, letterSpacing: '0.25em',
          color: C.textMuted, textTransform: 'uppercase', marginBottom: 32,
        }}
      >
        formless
      </motion.div>

      {/* Greeting */}
      <AnimatePresence>
        {phase === 'greeting' && (
          <motion.div
            key="greeting"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              fontFamily: F.serif, fontSize: 'clamp(28px, 6vw, 42px)',
              color: C.text, textAlign: 'center', lineHeight: 1.2,
              marginBottom: 16, maxWidth: 480,
            }}
          >
            Tell me what's going on.
          </motion.div>
        )}
        {phase === 'ready' && (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}
          >
            <div style={{
              fontFamily: F.serif, fontSize: 'clamp(28px, 6vw, 42px)',
              color: C.text, lineHeight: 1.2, marginBottom: 32,
            }}>
              Tell me what's going on.
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} style={{ position: 'relative', marginBottom: 20 }}>
              <textarea
                ref={inputRef}
                className="fr2-input"
                value={inputText}
                onChange={e => setInputText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); }}}
                placeholder="Describe your situation — your own words, your own pace…"
                rows={3}
                style={{
                  width: '100%',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  borderRadius: 14,
                  padding: '16px 52px 16px 18px',
                  fontFamily: F.sans,
                  fontSize: 15,
                  color: C.text,
                  lineHeight: 1.6,
                  resize: 'none',
                }}
              />
              <button
                type="submit"
                className="fr2-tap"
                style={{
                  position: 'absolute', right: 12, bottom: 12,
                  width: 36, height: 36, borderRadius: '50%',
                  background: C.green, border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1L13 7L7 13M13 7H1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </form>

            {/* Demo link */}
            <button
              onClick={handleDemo}
              className="fr2-tap"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: F.sans, fontSize: 12, color: C.textMuted,
                padding: '6px 12px', borderRadius: 8,
                borderBottom: `1px dashed ${C.textMuted}`,
              }}
            >
              See a demo → Maria Santos
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom label */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'ready' ? 1 : 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        style={{
          position: 'absolute', bottom: 24,
          fontFamily: F.sans, fontSize: 11,
          color: C.textMuted, textAlign: 'center',
          letterSpacing: '0.05em',
        }}
      >
        Pennsylvania · English / Español · Private by design
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 1 — CONVERSATION
// ─────────────────────────────────────────────────────────────────────────────

const DEMO_USER_LINES = [
  `I'm a single mom — two kids, Lily who's 4 and Marco who's 7. I just got laid off from my job at the grocery store last month.`,
  `About $300 a month from savings. Mostly zero. Rent is $900 and I can't make it.`,
];

function ConversationScreen({ initialText, onComplete }) {
  const [messages, setMessages]         = useState([]);
  const [turnIndex, setTurnIndex]       = useState(0);
  const [inputText, setInputText]       = useState('');
  const [aiTyping, setAiTyping]         = useState(false);
  const [aiSpeaking, setAiSpeaking]     = useState(false);
  const [isDemo, setIsDemo]             = useState(initialText === 'demo' || !initialText);
  const [demoUserIdx, setDemoUserIdx]   = useState(0);
  const bottomRef                       = useRef(null);
  const inputRef                        = useRef(null);

  const addMsg = useCallback((role, text) => {
    setMessages(prev => [...prev, { id: Date.now() + Math.random(), role, text }]);
  }, []);

  const runAiTurn = useCallback((idx) => {
    setAiTyping(true);
    setAiSpeaking(false);
    setTimeout(() => {
      const turn = DEMO_TURNS[idx];
      setAiTyping(false);
      setAiSpeaking(true);
      addMsg('ai', turn.ai);
      setTimeout(() => setAiSpeaking(false), 1400);

      if (turn.final) {
        setTimeout(() => onComplete(), 2200);
      }
    }, 1500 + (idx === 0 ? 400 : 0));
  }, [addMsg, onComplete]);

  // Start: first message from user (real or demo), then AI turn 0
  useEffect(() => {
    const firstUserText = isDemo
      ? "I'm a single mom in Philadelphia — two kids, just lost my job. We live at 1234 Broad Street. Rent is $900 a month."
      : (initialText || '');

    setTimeout(() => {
      addMsg('user', firstUserText);
      runAiTurn(0);
      setTurnIndex(1);
    }, 300);
  }, []); // eslint-disable-line

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, aiTyping]);

  function handleSend() {
    const text = isDemo
      ? (DEMO_USER_LINES[demoUserIdx] || inputText.trim())
      : inputText.trim();
    if (!text) return;

    setInputText('');
    addMsg('user', text);
    if (isDemo) setDemoUserIdx(i => i + 1);

    if (turnIndex < DEMO_TURNS.length) {
      runAiTurn(turnIndex);
      setTurnIndex(i => i + 1);
    }
  }

  const canSend = !aiTyping && !aiSpeaking;

  return (
    <div style={{
      height: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        padding: '14px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: '0.2em', color: C.textMuted }}>
          FORMLESS
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: C.green,
            animation: 'fr2-pulse 2s ease-in-out infinite',
          }} />
          <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>
            {aiTyping ? 'thinking…' : aiSpeaking ? 'speaking' : 'listening'}
          </span>
        </div>
      </div>

      {/* Waveform zone */}
      <div style={{
        flex: '0 0 auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '28px 0 18px',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <Waveform active={aiSpeaking} size="lg" />
      </div>

      {/* Transcript */}
      <div className="fr2-scroll" style={{
        flex: 1,
        padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 16,
        maxWidth: 640, width: '100%', margin: '0 auto',
        alignSelf: 'stretch',
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 4,
                alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              <span style={{
                fontFamily: F.sans, fontSize: 9, letterSpacing: '0.18em',
                color: C.textMuted, textTransform: 'uppercase',
                paddingRight: msg.role === 'user' ? 2 : 0,
              }}>
                {msg.role === 'user' ? 'You' : 'Formless'}
              </span>
              <div style={{
                background: msg.role === 'user' ? C.surfaceHigh : 'transparent',
                border: msg.role === 'user' ? `1px solid ${C.border}` : 'none',
                borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : 0,
                padding: msg.role === 'user' ? '10px 14px' : '2px 0',
                maxWidth: '80%',
                fontFamily: F.sans, fontSize: 14, color: C.text,
                lineHeight: 1.7,
                whiteSpace: 'pre-line',
              }}>
                {msg.text}
                {i === messages.length - 1 && msg.role === 'ai' && !aiTyping && (
                  <span className="fr2-cursor" />
                )}
              </div>
            </motion.div>
          ))}

          {aiTyping && (
            <motion.div
              key="typing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
            >
              <span style={{
                fontFamily: F.sans, fontSize: 9, letterSpacing: '0.18em', color: C.textMuted,
              }}>Formless</span>
              <DotLoader />
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        borderTop: `1px solid ${C.border}`,
        padding: '14px 24px',
        maxWidth: 640, width: '100%', alignSelf: 'center',
        display: 'flex', gap: 10, alignItems: 'flex-end',
        boxSizing: 'border-box',
      }}>
        {isDemo && demoUserIdx < DEMO_USER_LINES.length && (
          <div style={{
            flex: 1, padding: '10px 14px',
            background: C.surface, border: `1px solid ${C.border}`,
            borderRadius: 12, fontFamily: F.sans, fontSize: 13,
            color: C.textSec, lineHeight: 1.6, fontStyle: 'italic',
          }}>
            {DEMO_USER_LINES[demoUserIdx]}
          </div>
        )}
        {(!isDemo || demoUserIdx >= DEMO_USER_LINES.length) && (
          <textarea
            ref={inputRef}
            className="fr2-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
            placeholder="Reply…"
            rows={2}
            disabled={!canSend}
            style={{
              flex: 1,
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 12,
              padding: '10px 14px',
              fontFamily: F.sans, fontSize: 14,
              color: C.text, lineHeight: 1.6,
              resize: 'none',
              opacity: canSend ? 1 : 0.4,
            }}
          />
        )}
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="fr2-tap"
          style={{
            width: 40, height: 40, borderRadius: '50%',
            background: canSend ? C.green : C.border,
            border: 'none', cursor: canSend ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.2s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M7 1L13 7L7 13M13 7H1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 2 — UNDERSTANDING (Constellation)
// ─────────────────────────────────────────────────────────────────────────────

function UnderstandingScreen({ data, onConfirm }) {
  const [editField, setEditField] = useState(null);
  const confirmed = useRef(false);

  function handleConfirm() {
    if (confirmed.current) return;
    confirmed.current = true;
    onConfirm();
  }

  return (
    <div style={{
      height: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        width: '100%', padding: '14px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: '0.2em', color: C.textMuted }}>
          FORMLESS
        </span>
        <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>
          Step 2 of 4
        </span>
      </div>

      <div className="fr2-scroll" style={{
        flex: 1, width: '100%', maxWidth: 560, padding: '32px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div style={{ fontFamily: F.serif, fontSize: 26, color: C.text, marginBottom: 6 }}>
            Here's what I understood.
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSec, marginBottom: 36, lineHeight: 1.6 }}>
            Make sure I got this right before I figure out what you qualify for.
            <span style={{ color: C.textMuted, fontSize: 12 }}> Tap anything to edit.</span>
          </div>
        </motion.div>

        {/* Constellation */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0, marginBottom: 28 }}>
          {/* Central node */}
          <CNode
            label={`${data.firstName} ${data.lastName}`}
            sublabel={`Applicant · ${data.household[0].age}`}
            center
            delay={0.2}
          />

          {/* Connector down */}
          <motion.div
            initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
            transition={{ duration: 0.3, delay: 0.55 }}
            style={{ width: 1, height: 24, background: C.border, transformOrigin: 'top' }}
          />

          {/* Horizontal bar to children */}
          <motion.div
            initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
            transition={{ duration: 0.35, delay: 0.7 }}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', width: '80%', maxWidth: 320,
            }}
          >
            {/* Horizontal line */}
            <div style={{
              position: 'absolute', top: 0, left: '10%', right: '10%',
              height: 1, background: C.border,
            }} />
            {/* Left connector down */}
            <div style={{ position: 'absolute', left: '10%', top: 0, width: 1, height: 18, background: C.border }} />
            {/* Right connector down */}
            <div style={{ position: 'absolute', right: '10%', top: 0, width: 1, height: 18, background: C.border }} />
          </motion.div>

          {/* Children row */}
          <div style={{ display: 'flex', gap: 16, marginTop: 18, justifyContent: 'center' }}>
            {data.household.slice(1).map((m, i) => (
              <CNode
                key={m.name}
                label={m.name.split(' ')[0]}
                sublabel={`${m.role} · Age ${m.age}`}
                delay={0.9 + i * 0.15}
              />
            ))}
          </div>
        </div>

        {/* Data pills */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
          {[
            { icon: '💰', label: 'Monthly Income', value: data.incomeLabel, field: 'income' },
            { icon: '📍', label: 'Location',       value: data.city,        field: 'location' },
            { icon: '🏠', label: 'Monthly Rent',   value: `$${data.rent.toLocaleString()}`, field: 'rent' },
          ].map(({ icon, label, value, field }, i) => (
            <motion.div
              key={field}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 1.1 + i * 0.1 }}
              onClick={() => setEditField(editField === field ? null : field)}
              className="fr2-tap"
              style={{
                background: editField === field ? C.surfaceHigh : C.surface,
                border: `1px solid ${editField === field ? C.green : C.border}`,
                borderRadius: 12,
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}
            >
              <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: F.sans, fontSize: 10, color: C.textMuted, letterSpacing: '0.08em', marginBottom: 2 }}>
                  {label.toUpperCase()}
                </div>
                {editField === field ? (
                  <input
                    className="fr2-input"
                    defaultValue={value}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                    style={{
                      background: 'transparent', border: 'none',
                      fontFamily: F.sans, fontSize: 14, color: C.text, width: '100%',
                      borderBottom: `1px solid ${C.green}`,
                    }}
                  />
                ) : (
                  <div style={{ fontFamily: F.sans, fontSize: 14, color: C.text }}>
                    {value}
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: C.textMuted }}>✏</span>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 1.5 }}
          onClick={handleConfirm}
          className="fr2-tap"
          style={{
            width: '100%',
            background: C.green,
            border: 'none',
            borderRadius: 14,
            padding: '16px 24px',
            fontFamily: F.serif,
            fontSize: 18,
            color: C.bg,
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          Looks right — show me what I qualify for →
        </motion.button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 3 — REVELATION
// ─────────────────────────────────────────────────────────────────────────────

function RevelationScreen({ eligibility, onContinue }) {
  const totalDelay = eligibility.length * 0.55 + 0.8;
  const [showImpact, setShowImpact] = useState(false);
  const [showCta, setShowCta]       = useState(false);
  const eligible = eligibility.filter(e => e.eligible === 'yes');
  const total    = eligible.reduce((s, e) => s + e.annual, 0);

  useEffect(() => {
    const t1 = setTimeout(() => setShowImpact(true), (totalDelay + 0.3) * 1000);
    const t2 = setTimeout(() => setShowCta(true),    (totalDelay + 2.4) * 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [totalDelay]);

  return (
    <div style={{
      height: '100vh', background: C.bg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        width: '100%', padding: '14px 24px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: '0.2em', color: C.textMuted }}>
          FORMLESS
        </span>
        <span style={{ fontFamily: F.sans, fontSize: 11, color: C.textMuted }}>
          Step 3 of 4
        </span>
      </div>

      <div className="fr2-scroll" style={{
        flex: 1, width: '100%', maxWidth: 560, padding: '32px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ marginBottom: 28 }}
        >
          <div style={{
            fontFamily: F.serif, fontSize: 26, color: C.text, lineHeight: 1.2, marginBottom: 8,
          }}>
            Here's what your family is entitled to.
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.textSec }}>
            Based on what you shared — Philadelphia County, household of 3.
          </div>
        </motion.div>

        {/* Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 32 }}>
          {eligibility.map((program, i) => (
            <EligCard key={program.id} program={program} index={i} />
          ))}
        </div>

        {/* Impact number */}
        <AnimatePresence>
          {showImpact && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              style={{
                background: `linear-gradient(135deg, ${C.surfaceHigh}, ${C.surface})`,
                border: `1px solid ${C.borderLight}`,
                borderTop: `2px solid ${C.gold}`,
                borderRadius: 16,
                padding: '28px 24px',
                textAlign: 'center',
                marginBottom: 24,
              }}
            >
              <div style={{
                fontFamily: F.sans, fontSize: 10, letterSpacing: '0.2em',
                color: C.textMuted, textTransform: 'uppercase', marginBottom: 12,
              }}>
                Estimated Annual Value
              </div>
              <div style={{
                fontFamily: F.serif,
                fontSize: 'clamp(44px, 10vw, 64px)',
                color: C.gold,
                lineHeight: 1,
                marginBottom: 10,
              }}>
                <CountUp target={total} duration={1600} prefix="$" />
              </div>
              <div style={{ fontFamily: F.sans, fontSize: 13, color: C.textSec, lineHeight: 1.5 }}>
                in benefits your family may be leaving on the table
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* CTA */}
        <AnimatePresence>
          {showCta && (
            <motion.button
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              onClick={onContinue}
              className="fr2-tap"
              style={{
                width: '100%',
                background: C.green,
                border: 'none',
                borderRadius: 14,
                padding: '16px 24px',
                fontFamily: F.serif,
                fontSize: 18,
                color: C.bg,
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              See your applications →
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 4 — PACKAGE
// ─────────────────────────────────────────────────────────────────────────────

function PackageScreen({ data, eligibility, onContinue }) {
  const eligible = eligibility.filter(e => e.eligible === 'yes');
  const total    = eligible.reduce((s, e) => s + e.annual, 0);
  const [sealed, setSealed] = useState(false);

  function handleDownload() {
    setSealed(true);
    setTimeout(() => onContinue(), 1400);
  }

  return (
    <div style={{
      height: '100vh', background: C.lBg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        width: '100%', padding: '14px 24px',
        borderBottom: `1px solid ${C.lBorder}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: C.lSurface,
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: '0.2em', color: C.lTextSec }}>
          FORMLESS
        </span>
        <span style={{ fontFamily: F.sans, fontSize: 11, color: C.lTextSec }}>
          Step 4 of 4
        </span>
      </div>

      <div className="fr2-scroll" style={{
        flex: 1, width: '100%', maxWidth: 560, padding: '28px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          style={{ marginBottom: 24 }}
        >
          <div style={{ fontFamily: F.serif, fontSize: 26, color: C.lText, marginBottom: 6 }}>
            Your benefits package.
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 13, color: C.lTextSec }}>
            Prepared for {data.firstName} {data.lastName} · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </motion.div>

        {/* The package card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: C.lSurface,
            border: `1px solid ${C.lBorder}`,
            borderRadius: 16,
            padding: '24px',
            marginBottom: 20,
            boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)',
          }}
        >
          {/* Card header */}
          <div style={{
            borderBottom: `1px solid ${C.lBorder}`,
            paddingBottom: 16, marginBottom: 20,
          }}>
            <div style={{
              fontFamily: F.sans, fontSize: 9, letterSpacing: '0.2em',
              color: C.lTextSec, textTransform: 'uppercase', marginBottom: 4,
            }}>
              YOUR BENEFITS PACKAGE
            </div>
            <div style={{ fontFamily: F.serif, fontSize: 15, color: C.lText }}>
              {data.firstName} {data.lastName} · {data.city}
            </div>
          </div>

          {/* Programs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, marginBottom: 24 }}>
            {eligible.map((prog, i) => (
              <motion.div
                key={prog.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.3 + i * 0.12 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}
              >
                <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{prog.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: F.serif, fontSize: 16, color: C.lText }}>
                      {prog.name}
                    </div>
                    {prog.urgent && (
                      <span style={{
                        fontFamily: F.sans, fontSize: 9, letterSpacing: '0.1em',
                        background: '#FEF3C7', color: C.lAmber,
                        padding: '2px 8px', borderRadius: 20,
                      }}>
                        ⚡ Apply by {prog.deadline}
                      </span>
                    )}
                  </div>
                  <div style={{ fontFamily: F.sans, fontSize: 12, color: C.lTextSec, marginTop: 2, marginBottom: 4 }}>
                    {prog.desc}
                  </div>
                  <div style={{ fontFamily: F.mono, fontSize: 15, color: C.lForest }}>
                    {prog.monthly
                      ? `$${prog.monthly.toLocaleString()} / month`
                      : `up to $${prog.annual.toLocaleString()} / year`}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Total */}
          <div style={{
            borderTop: `1px solid ${C.lBorder}`,
            paddingTop: 18,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div>
              <div style={{ fontFamily: F.sans, fontSize: 10, letterSpacing: '0.12em', color: C.lTextSec, marginBottom: 3 }}>
                ESTIMATED ANNUAL VALUE
              </div>
              <div style={{ fontFamily: F.mono, fontSize: 22, color: C.lGold }}>
                ${total.toLocaleString()}
              </div>
            </div>
            <div style={{
              fontFamily: F.sans, fontSize: 10, color: C.lTextSec,
              maxWidth: 140, textAlign: 'right', lineHeight: 1.5,
            }}>
              in benefits you and your family are entitled to
            </div>
          </div>
        </motion.div>

        {/* Consent */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          style={{
            background: '#EEF7F2', border: '1px solid #C8E8D8',
            borderRadius: 10, padding: '12px 16px',
            fontFamily: F.sans, fontSize: 12, color: '#1C5C3A',
            lineHeight: 1.6, marginBottom: 16,
          }}
        >
          🔒 By downloading, you confirm this information is accurate to the best of your knowledge.
          Your applications were assembled on this device — we never saw your personal data.
        </motion.div>

        {/* Download CTA */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.85 }}
          onClick={handleDownload}
          className="fr2-tap"
          style={{
            width: '100%',
            background: sealed ? '#4AAF7C' : C.lForest,
            border: 'none',
            borderRadius: 14,
            padding: '16px 24px',
            fontFamily: F.serif,
            fontSize: 18,
            color: '#F5F0E8',
            cursor: 'pointer',
            textAlign: 'center',
            transition: 'background 0.3s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          }}
        >
          {sealed ? (
            <>
              <span>✓</span>
              <span>Applications ready</span>
            </>
          ) : (
            <>
              <span>↓</span>
              <span>Get my applications</span>
            </>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SCREEN 5 — NEXT STEPS
// ─────────────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    when: 'Today',
    urgent: false,
    title: 'Sign your 3 applications',
    detail: `We've marked every signature line. Print, sign in blue or black ink.`,
    action: null,
    icon: '✍️',
  },
  {
    when: 'By June 14',
    urgent: false,
    title: 'Submit SNAP at Philadelphia DHS',
    detail: '4800 Wissahickon Ave · Mon–Fri, 8am–5pm · Bring ID, proof of income, and lease',
    action: { label: 'Open in Maps', href: '#' },
    icon: '🍎',
  },
  {
    when: 'By June 21',
    urgent: false,
    title: 'Submit Medicaid online or in person',
    detail: 'compass.pa.gov — fastest processing. Or bring to same DHS office above.',
    action: { label: 'Open Website', href: '#' },
    icon: '🏥',
  },
  {
    when: 'By June 30',
    urgent: true,
    title: 'Apply for LIHEAP heating help',
    detail: 'Call 1-800-692-7462. Funding is limited — apply before anyone else.',
    action: { label: 'Call Now', href: 'tel:18006927462' },
    icon: '🔥',
  },
  {
    when: 'July – August',
    urgent: false,
    title: 'Watch for approval letters',
    detail: `SNAP: ~30 days. Medicaid: ~45 days. We'll remind you to follow up.`,
    action: null,
    icon: '📬',
  },
];

function StepRow({ step, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.1 + index * 0.1 }}
      style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}
    >
      {/* Left: dot + line */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: 24 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: step.urgent ? C.lAmber : C.lForest,
          marginTop: 4, flexShrink: 0,
          boxShadow: step.urgent ? `0 0 0 3px rgba(184,96,10,0.15)` : 'none',
        }} />
        {index < STEPS.length - 1 && (
          <div style={{ width: 1, flex: 1, background: C.lBorder, marginTop: 6, minHeight: 24 }} />
        )}
      </div>

      {/* Right: content */}
      <div style={{ flex: 1, paddingBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontFamily: F.sans, fontSize: 10, letterSpacing: '0.1em',
            color: step.urgent ? C.lAmber : C.lTextSec,
            fontWeight: 600, textTransform: 'uppercase',
          }}>
            {step.urgent ? '⚡ ' : ''}{step.when}
          </span>
        </div>
        <div style={{ fontFamily: F.serif, fontSize: 16, color: C.lText, marginBottom: 6, lineHeight: 1.3 }}>
          {step.icon} {step.title}
        </div>
        <div style={{ fontFamily: F.sans, fontSize: 13, color: C.lTextSec, lineHeight: 1.6, marginBottom: step.action ? 10 : 0 }}>
          {step.detail}
        </div>
        {step.action && (
          <a
            href={step.action.href}
            style={{
              fontFamily: F.sans, fontSize: 12, color: C.lForest,
              textDecoration: 'underline', fontWeight: 500,
            }}
          >
            {step.action.label} →
          </a>
        )}
      </div>
    </motion.div>
  );
}

function NextStepsScreen({ data, onReset }) {
  const [reminderPhone, setReminderPhone] = useState('');
  const [reminderSet, setReminderSet]     = useState(false);

  return (
    <div style={{
      height: '100vh', background: C.lBg,
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top bar */}
      <div style={{
        width: '100%', padding: '14px 24px',
        borderBottom: `1px solid ${C.lBorder}`,
        background: C.lSurface,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: F.sans, fontSize: 11, letterSpacing: '0.2em', color: C.lTextSec }}>
          FORMLESS
        </span>
        <span style={{
          fontFamily: F.sans, fontSize: 11, color: '#4AAF7C',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          <span style={{ fontSize: 9 }}>●</span> Applications ready
        </span>
      </div>

      <div className="fr2-scroll" style={{
        flex: 1, width: '100%', maxWidth: 560, padding: '28px 24px',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          style={{ marginBottom: 32 }}
        >
          <div style={{ fontFamily: F.serif, fontSize: 26, color: C.lText, marginBottom: 6 }}>
            What to do next.
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 14, color: C.lTextSec }}>
            {data.firstName} — here are your next 5 steps, in order.
          </div>
        </motion.div>

        {/* Timeline */}
        <div style={{ marginBottom: 32 }}>
          {STEPS.map((step, i) => (
            <StepRow key={step.title} step={step} index={i} />
          ))}
        </div>

        {/* Reminder card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.7 }}
          style={{
            background: C.lSurface,
            border: `1px solid ${C.lBorder}`,
            borderRadius: 14,
            padding: '18px 20px',
            marginBottom: 24,
          }}
        >
          <div style={{ fontFamily: F.serif, fontSize: 16, color: C.lText, marginBottom: 6 }}>
            Want a text reminder before each step?
          </div>
          <div style={{ fontFamily: F.sans, fontSize: 12, color: C.lTextSec, marginBottom: 14 }}>
            No account needed. We'll message you before each deadline.
          </div>
          {reminderSet ? (
            <div style={{ fontFamily: F.sans, fontSize: 13, color: '#1C5C3A' }}>
              ✓ Reminders set. We'll text you before each deadline.
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                className="fr2-input"
                value={reminderPhone}
                onChange={e => setReminderPhone(e.target.value)}
                placeholder="Your phone number"
                type="tel"
                style={{
                  flex: 1,
                  background: C.lBg,
                  border: `1px solid ${C.lBorder}`,
                  borderRadius: 10,
                  padding: '10px 14px',
                  fontFamily: F.sans,
                  fontSize: 14,
                  color: C.lText,
                }}
              />
              <button
                onClick={() => setReminderSet(true)}
                className="fr2-tap"
                style={{
                  background: C.lForest,
                  border: 'none',
                  borderRadius: 10,
                  padding: '10px 16px',
                  fontFamily: F.sans,
                  fontSize: 13,
                  color: '#F5F0E8',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Set up
              </button>
            </div>
          )}
        </motion.div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={onReset}
            className="fr2-tap"
            style={{
              flex: 1, minWidth: 140,
              background: 'transparent',
              border: `1px solid ${C.lBorder}`,
              borderRadius: 12,
              padding: '12px 16px',
              fontFamily: F.sans,
              fontSize: 13,
              color: C.lTextSec,
              cursor: 'pointer',
            }}
          >
            Start new application
          </button>
          <a
            href="/testing/fr2.html"
            className="fr2-tap"
            style={{
              flex: 1, minWidth: 140,
              background: '#F0F9F4',
              border: `1px solid #C8E8D8`,
              borderRadius: 12,
              padding: '12px 16px',
              fontFamily: F.sans,
              fontSize: 13,
              color: C.lForest,
              cursor: 'pointer',
              textDecoration: 'none',
              textAlign: 'center',
              display: 'block',
            }}
          >
            Save to phone →
          </a>
        </div>

        {/* V1 link */}
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <a
            href="/"
            style={{
              fontFamily: F.sans, fontSize: 11, color: C.lTextSec,
              textDecoration: 'none', opacity: 0.6,
            }}
          >
            ← Back to Formless V1
          </a>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────

const SCREENS = ['threshold', 'conversation', 'understanding', 'revelation', 'package', 'nextsteps'];

export default function Fr2App() {
  const [screen, setScreen]   = useState('threshold');
  const [initText, setInitText] = useState(null);

  const go = (s) => setScreen(s);

  return (
    <div style={{ height: '100vh', overflow: 'hidden', background: C.bg }}>
      <AnimatePresence mode="wait">
        {screen === 'threshold' && (
          <motion.div key="threshold"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ height: '100vh' }}
          >
            <ThresholdScreen onStart={(text) => { setInitText(text); go('conversation'); }} />
          </motion.div>
        )}

        {screen === 'conversation' && (
          <motion.div key="conversation"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ height: '100vh' }}
          >
            <ConversationScreen
              initialText={initText}
              onComplete={() => go('understanding')}
            />
          </motion.div>
        )}

        {screen === 'understanding' && (
          <motion.div key="understanding"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{ height: '100vh' }}
          >
            <UnderstandingScreen
              data={DEMO_DATA}
              onConfirm={() => go('revelation')}
            />
          </motion.div>
        )}

        {screen === 'revelation' && (
          <motion.div key="revelation"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            style={{ height: '100vh' }}
          >
            <RevelationScreen
              eligibility={DEMO_ELIGIBILITY}
              onContinue={() => go('package')}
            />
          </motion.div>
        )}

        {screen === 'package' && (
          <motion.div key="package"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{ height: '100vh' }}
          >
            <PackageScreen
              data={DEMO_DATA}
              eligibility={DEMO_ELIGIBILITY}
              onContinue={() => go('nextsteps')}
            />
          </motion.div>
        )}

        {screen === 'nextsteps' && (
          <motion.div key="nextsteps"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            style={{ height: '100vh' }}
          >
            <NextStepsScreen
              data={DEMO_DATA}
              onReset={() => go('threshold')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
