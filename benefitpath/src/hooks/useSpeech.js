import { useState, useRef, useCallback, useEffect } from 'react';

export function useSpeech({ onTranscript, lang = 'en' }) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const [interimText, setInterimText] = useState('');
  const [micError, setMicError] = useState(null);
  const recognitionRef = useRef(null);
  const finalTextRef = useRef('');
  const silenceTimerRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recognitionRef.current) recognitionRef.current.stop();
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    setMicError(null);

    finalTextRef.current = '';
    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'es' ? 'es-US' : 'en-US';
    recognition.interimResults = true;
    recognition.continuous = true;      // keep listening through pauses
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onend = () => {
      setIsListening(false);
      setInterimText('');
      if (finalTextRef.current.trim()) {
        onTranscript(finalTextRef.current.trim());
        finalTextRef.current = '';
      }
    };

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTextRef.current += (finalTextRef.current ? ' ' : '') + transcript;
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);

      // Auto-stop after 2.5s of silence (no new results)
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        if (recognitionRef.current) recognitionRef.current.stop();
      }, 2500);
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech') return; // ignore — continuous mode fires this often
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setMicError('Microphone access was blocked. Click the lock icon in your browser address bar to allow it.');
      } else {
        setMicError(`Microphone error: ${event.error}`);
      }
      setIsListening(false);
      setInterimText('');
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  return { isListening, isSupported, interimText, micError, toggleListening };
}
