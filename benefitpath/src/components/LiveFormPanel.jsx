import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

// Fields shown in the live panel, grouped into sections
const SECTIONS = [
  {
    id: 'applicant',
    title: 'Applicant',
    fields: [
      { key: 'firstName', label: 'First Name' },
      { key: 'lastName', label: 'Last Name' },
      { key: 'dateOfBirth', label: 'Date of Birth' },
      { key: 'maritalStatus', label: 'Marital Status' },
      { key: 'phone', label: 'Phone' },
    ],
  },
  {
    id: 'residence',
    title: 'Residence',
    fields: [
      { key: 'address', label: 'Address', wide: true },
      { key: 'county', label: 'County' },
    ],
  },
  {
    id: 'household',
    title: 'Household',
    fields: [
      { key: 'householdMembers', label: 'Members', derived: true },
    ],
  },
  {
    id: 'income',
    title: 'Income',
    fields: [
      { key: 'monthlyIncome', label: 'Monthly Income', derived: true },
    ],
  },
  {
    id: 'expenses',
    title: 'Expenses',
    fields: [
      { key: 'rent', label: 'Rent', expenseKey: 'rent' },
      { key: 'utilities', label: 'Utilities', expenseKey: 'utilities' },
      { key: 'heating', label: 'Heating', expenseKey: 'heating' },
    ],
  },
];

function getFieldValue(data, field) {
  if (!data) return null;

  if (field.expenseKey) {
    const val = data.expenses?.[field.expenseKey];
    return val ? `$${val}/mo` : null;
  }

  if (field.key === 'householdMembers') {
    const members = data.householdMembers;
    if (!members || members.length === 0) return null;
    return members.map(m => m.name || m.relationship).filter(Boolean).join(', ');
  }

  if (field.key === 'monthlyIncome') {
    const income = data.monthlyIncome;
    if (!income || income.length === 0) return null;
    const total = income.reduce((s, i) => s + (parseFloat(i.amount) || 0), 0);
    if (total === 0) return 'None / Unemployed';
    return `$${total.toLocaleString()}/mo`;
  }

  return data[field.key] || null;
}

function getDiffedKeys(prev, curr, data) {
  const changed = new Set();
  if (!prev || !curr) return changed;

  for (const section of SECTIONS) {
    for (const field of section.fields) {
      const prevVal = getFieldValue(prev, field);
      const currVal = getFieldValue(curr, field);
      if (currVal && currVal !== prevVal) {
        changed.add(field.key);
      }
    }
  }
  return changed;
}

export default function LiveFormPanel({ extractedData, isListening }) {
  const prevDataRef = useRef(null);
  const [recentlyFilled, setRecentlyFilled] = useState(new Set());
  const [filledKeys, setFilledKeys] = useState(new Set());

  useEffect(() => {
    const changed = getDiffedKeys(prevDataRef.current, extractedData, extractedData);
    if (changed.size > 0) {
      setRecentlyFilled(changed);
      setFilledKeys(prev => new Set([...prev, ...changed]));
      const t = setTimeout(() => setRecentlyFilled(new Set()), 1200);
      prevDataRef.current = extractedData;
      return () => clearTimeout(t);
    }
    prevDataRef.current = extractedData;
  }, [extractedData]);

  // Calculate fill percentage
  const totalFields = SECTIONS.flatMap(s => s.fields).length;
  const filledCount = SECTIONS.flatMap(s => s.fields).filter(f => getFieldValue(extractedData, f)).length;
  const fillPct = Math.round((filledCount / totalFields) * 100);

  return (
    <div style={s.panel}>
      {/* Panel header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerTitle}>LIVE FORM</span>
          <span style={s.headerSub}>{fillPct}% complete</span>
        </div>
        {isListening && (
          <motion.div
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={s.listeningDot}
          />
        )}
      </div>

      {/* Progress bar */}
      <div style={s.progressTrack}>
        <motion.div
          style={s.progressFill}
          animate={{ width: `${fillPct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>

      {/* Form sections */}
      <div style={s.sections}>
        {SECTIONS.map(section => (
          <div key={section.id} style={s.section}>
            <div style={s.sectionTitle}>{section.title.toUpperCase()}</div>
            <div style={s.fieldGrid}>
              {section.fields.map(field => {
                const value = getFieldValue(extractedData, field);
                const isNew = recentlyFilled.has(field.key);
                const isFilled = !!value;

                return (
                  <div
                    key={field.key}
                    style={{
                      ...s.fieldRow,
                      ...(field.wide ? { gridColumn: '1 / -1' } : {}),
                    }}
                  >
                    <span style={s.fieldLabel}>{field.label}</span>
                    <AnimatePresence mode="wait">
                      {isFilled ? (
                        <motion.span
                          key={value}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{
                            ...s.fieldValue,
                            ...(isNew ? s.fieldValueNew : {}),
                          }}
                        >
                          {value}
                        </motion.span>
                      ) : (
                        <motion.span
                          key="empty"
                          style={s.fieldEmpty}
                        />
                      )}
                    </AnimatePresence>
                    {isNew && (
                      <motion.div
                        style={s.flashOverlay}
                        initial={{ opacity: 0.4 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1.0 }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filledCount === 0 && (
        <div style={s.emptyState}>
          <p style={s.emptyText}>Fields will fill in as you share your story.</p>
        </div>
      )}
    </div>
  );
}

const s = {
  panel: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#F7F6F3',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.85rem 1.25rem 0.6rem',
    borderBottom: '1px solid #E8E6DF',
    flexShrink: 0,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '0.75rem',
  },
  headerTitle: {
    fontSize: '10px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#111110',
  },
  headerSub: {
    fontSize: '11px',
    color: '#888682',
  },
  listeningDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#c0392b',
    flexShrink: 0,
  },
  progressTrack: {
    height: 2,
    background: '#E8E6DF',
    flexShrink: 0,
  },
  progressFill: {
    height: '100%',
    background: '#1C3A2A',
    minWidth: 0,
  },
  sections: {
    flex: 1,
    overflowY: 'auto',
    padding: '0.5rem 0',
  },
  section: {
    borderBottom: '1px solid #F0EDE6',
    paddingBottom: '0.25rem',
    marginBottom: '0',
  },
  sectionTitle: {
    fontSize: '9px',
    fontWeight: 700,
    letterSpacing: '0.15em',
    color: '#C0BAB0',
    padding: '0.6rem 1.25rem 0.3rem',
  },
  fieldGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0',
    padding: '0 1.25rem 0.5rem',
    rowGap: '0.5rem',
    columnGap: '1rem',
  },
  fieldRow: {
    position: 'relative',
    paddingBottom: '0.35rem',
    borderBottom: '1px solid #E8E6DF',
    minHeight: '2.2rem',
  },
  fieldLabel: {
    display: 'block',
    fontSize: '9px',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#B0ADA6',
    marginBottom: '2px',
    fontWeight: 500,
  },
  fieldValue: {
    display: 'block',
    fontSize: '12px',
    color: '#111110',
    lineHeight: 1.3,
    fontWeight: 400,
  },
  fieldValueNew: {
    color: '#1C5C3A',
    fontWeight: 500,
  },
  fieldEmpty: {
    display: 'block',
    height: '14px',
    background: '#ECEAE3',
    borderRadius: 1,
    width: '60%',
    opacity: 0.5,
  },
  flashOverlay: {
    position: 'absolute',
    inset: 0,
    background: '#D1FAE5',
    pointerEvents: 'none',
    borderRadius: 1,
  },
  emptyState: {
    padding: '1.5rem 1.25rem',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: '12px',
    color: '#C0BAB0',
    margin: 0,
    lineHeight: 1.6,
  },
};
