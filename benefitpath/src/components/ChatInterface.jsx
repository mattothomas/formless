import { useState, useRef, useEffect, useCallback } from 'react';
import { sendToGemini, mergeExtractedData } from '../utils/geminiClient.js';
import { calculateEligibility } from '../utils/eligibility.js';
import { useSpeech } from '../hooks/useSpeech.js';
import MicButton from './MicButton.jsx';
import TypingIndicator from './TypingIndicator.jsx';

const HAPPY_PATH_TEXT = "I'm Maria, a single mom with 2 kids ages 4 and 7. I work part time at a grocery store making about $1,400 a month. I rent an apartment in Philadelphia for $900/month and I'm really struggling to afford groceries and my heating bill.";

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm BenefitPath 👋\n\nI help families in Pennsylvania find government benefits they may qualify for — like food assistance, healthcare, heating help, and more.\n\nJust tell me a little about your situation in your own words. For example: your family size, where you live, and roughly what you earn. There's no wrong way to share — just talk to me like you would a friend.\n\nWhat's going on for you right now?",
  timestamp: Date.now(),
};

export default function ChatInterface({
  messages,
  setMessages,
  extractedData,
  setExtractedData,
  persist,
  onResultsReady,
}) {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState(null);
  const [showExampleHint, setShowExampleHint] = useState(true);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Initialize with welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([WELCOME_MESSAGE]);
    }
  }, []); // eslint-disable-line

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleTranscript = useCallback((text) => {
    setInputText(prev => prev ? prev + ' ' + text : text);
  }, []);

  const { isListening, isSupported, interimText, toggleListening } = useSpeech({
    onTranscript: handleTranscript,
  });

  async function sendMessage(text) {
    if (!text.trim()) return;
    setError(null);
    setShowExampleHint(false);

    const userMsg = { role: 'user', content: text.trim(), timestamp: Date.now() };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputText('');
    setIsTyping(true);

    try {
      // Build conversation history for Gemini (exclude welcome message from API call)
      const apiMessages = nextMessages
        .filter(m => !(m.role === 'assistant' && m.content.startsWith("Hi! I'm BenefitPath")))
        .map(m => ({ role: m.role, content: m.content }));

      const response = await sendToGemini(apiMessages, apiKey);

      const assistantMsg = {
        role: 'assistant',
        content: response.message,
        timestamp: Date.now(),
      };

      const updatedMessages = [...nextMessages, assistantMsg];
      setMessages(updatedMessages);

      // Merge extracted data
      const mergedData = mergeExtractedData(extractedData, response.extractedData);
      setExtractedData(mergedData);

      // Persist to Firebase
      await persist(updatedMessages, mergedData, null);

      // Check if ready for results
      if (response.readyForResults || response.isComplete) {
        const results = calculateEligibility(mergedData);
        await persist(updatedMessages, mergedData, results);
        setTimeout(() => onResultsReady(results, mergedData), 600);
      }
    } catch (err) {
      console.error('Gemini error:', err);
      const friendlyMsg = err.message.includes('API key')
        ? "I'm having trouble connecting right now. Please make sure your Gemini API key is set up correctly."
        : "I ran into a small hiccup — please try sending your message again. I'm still here!";
      setError(friendlyMsg);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: friendlyMsg,
        timestamp: Date.now(),
        isError: true,
      }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(inputText);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputText);
    }
  }

  function handleTryExample() {
    setInputText(HAPPY_PATH_TEXT);
    setShowExampleHint(false);
    inputRef.current?.focus();
  }

  return (
    <div className="chat-container">
      <div className="messages-area">
        {messages.map((msg, i) => (
          <div key={i} className={`message-row ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="avatar assistant-avatar">BP</div>
            )}
            <div className={`bubble ${msg.role === 'assistant' ? 'assistant-bubble' : 'user-bubble'} ${msg.isError ? 'error-bubble' : ''}`}>
              {msg.content.split('\n').map((line, j) => (
                <span key={j}>
                  {line}
                  {j < msg.content.split('\n').length - 1 && <br />}
                </span>
              ))}
            </div>
            {msg.role === 'user' && (
              <div className="avatar user-avatar">You</div>
            )}
          </div>
        ))}

        {isTyping && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {showExampleHint && messages.length <= 1 && (
        <div className="example-hint">
          <span>Not sure what to say?</span>
          <button className="btn-example" onClick={handleTryExample}>
            ✨ Try the example story
          </button>
        </div>
      )}

      {interimText && (
        <div className="interim-text">
          🎙 {interimText}
        </div>
      )}

      <form className="input-area" onSubmit={handleSubmit}>
        <div className="input-row">
          <textarea
            ref={inputRef}
            className="message-input"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isListening ? 'Listening…' : 'Type or speak your answer…'}
            rows={1}
            disabled={isTyping || isListening}
          />
          <MicButton
            isListening={isListening}
            isSupported={isSupported}
            onClick={toggleListening}
          />
          <button
            type="submit"
            className="btn-send"
            disabled={!inputText.trim() || isTyping}
            aria-label="Send message"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
              <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
          </button>
        </div>
        <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
      </form>
    </div>
  );
}
