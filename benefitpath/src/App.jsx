import { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface.jsx';
import BenefitsDashboard from './components/BenefitsDashboard.jsx';
import { useSession } from './hooks/useSession.js';
import { mergeExtractedData } from './utils/geminiClient.js';

export default function App() {
  const {
    messages,
    setMessages,
    extractedData,
    setExtractedData,
    eligibilityResults,
    setEligibilityResults,
    isLoaded,
    persist,
    resetSession,
  } = useSession();

  const [view, setView] = useState('chat'); // 'chat' | 'results'

  // If session already has results, go straight to results view
  useEffect(() => {
    if (isLoaded && eligibilityResults && eligibilityResults.length > 0) {
      setView('results');
    }
  }, [isLoaded, eligibilityResults]);

  function handleResultsReady(results, data) {
    setEligibilityResults(results);
    setExtractedData(prev => mergeExtractedData(prev, data));
    setView('results');
  }

  function handleReset() {
    resetSession();
  }

  if (!isLoaded) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Loading your session…</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-inner">
          <div className="logo">
            <svg viewBox="0 0 32 32" width="26" height="26">
              <rect width="32" height="32" rx="7" fill="#1a4fce"/>
              <path d="M8 10h16M8 16h10M8 22h12" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="24" cy="22" r="5" fill="#22c55e"/>
              <path d="M21.5 22l1.5 1.5 3-3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="logo-text">BenefitPath</span>
          </div>
          <div className="header-tagline">
            Pennsylvania Benefits Navigator
          </div>
        </div>
      </header>

      <main className="app-main">
        {view === 'chat' ? (
          <div className="chat-layout">
            <div className="chat-intro">
              <h1>Find benefits you deserve</h1>
              <p>Tell us about your situation and we'll find PA programs you qualify for — in minutes, not hours.</p>
              <div className="trust-badges">
                <span>🔒 Private</span>
                <span>🆓 Free</span>
                <span>📄 Instant PDF</span>
              </div>
            </div>
            <ChatInterface
              messages={messages}
              setMessages={setMessages}
              extractedData={extractedData}
              setExtractedData={setExtractedData}
              persist={persist}
              onResultsReady={handleResultsReady}
            />
          </div>
        ) : (
          <BenefitsDashboard
            results={eligibilityResults || []}
            extractedData={extractedData}
            onReset={handleReset}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>
          BenefitPath is a free tool to help you understand your options.
          This is not an official government service.
          <a href="https://www.compass.state.pa.us" target="_blank" rel="noopener noreferrer"> Apply officially at compass.state.pa.us</a>
        </p>
      </footer>
    </div>
  );
}
