export default function MicButton({ isListening, isSupported, onClick }) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`mic-btn ${isListening ? 'mic-active' : ''}`}
      title={isListening ? 'Stop listening' : 'Speak your answer'}
      aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
    >
      {isListening ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
          <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
          <line x1="12" y1="19" x2="12" y2="23"/>
          <line x1="8" y1="23" x2="16" y2="23"/>
        </svg>
      )}
    </button>
  );
}
