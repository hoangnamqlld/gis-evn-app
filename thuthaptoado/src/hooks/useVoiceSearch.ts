// useVoiceSearch.ts — Nhận diện giọng nói Việt qua Web Speech API (miễn phí, built-in Chrome/Safari mobile).

import { useCallback, useEffect, useRef, useState } from 'react';

// Web Speech API không có trong TypeScript lib mặc định
interface SRResult { transcript: string; confidence?: number }
interface SREvent { results: ArrayLike<ArrayLike<SRResult>> }
interface SR {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
}

function getSR(): (new () => SR) | null {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isVoiceSupported(): boolean {
  return getSR() !== null;
}

export interface VoiceState {
  listening: boolean;
  transcript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

export function useVoiceSearch(onFinal?: (text: string) => void, lang = 'vi-VN'): VoiceState {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<SR | null>(null);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) { setError('Trình duyệt không hỗ trợ giọng nói'); return; }
    if (recRef.current) { try { recRef.current.abort(); } catch {} }
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (e) => {
      let txt = '';
      for (let i = 0; i < e.results.length; i++) txt += (e.results[i] as any)[0].transcript;
      setTranscript(txt);
    };
    rec.onerror = (e) => {
      setError(e?.error || 'Lỗi nhận giọng nói');
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
      // Gọi final callback với transcript cuối cùng
      setTranscript(cur => {
        if (cur.trim() && onFinal) onFinal(cur.trim());
        return cur;
      });
    };
    setTranscript('');
    setError(null);
    setListening(true);
    try { rec.start(); } catch (e) { setError(String(e)); setListening(false); }
    recRef.current = rec;
  }, [lang, onFinal]);

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setError(null);
  }, []);

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  return { listening, transcript, error, start, stop, reset };
}
