import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

export function useSpeechToText() {
  const [supported, setSupported] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const baseRef = useRef("");

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => recognitionRef.current?.stop();
  }, []);

  const start = useCallback((initial = "") => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) {
      setError("Voice recognition is not supported in this browser.");
      return;
    }
    setError(null);
    baseRef.current = initial ? initial.trimEnd() + " " : "";
    const recognition = new Ctor();
    recognition.lang = "en-IN";
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0].transcript;
      setTranscript(baseRef.current + text);
    };
    recognition.onerror = (event) => {
      setError(event.error === "not-allowed" ? "Microphone permission denied." : event.error);
      setRecording(false);
    };
    recognition.onend = () => setRecording(false);
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return { supported, recording, transcript, setTranscript, error, start, stop };
}
