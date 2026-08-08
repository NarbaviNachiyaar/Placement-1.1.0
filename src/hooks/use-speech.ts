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
  const intentionalStopRef = useRef(false);

  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    setSupported(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    return () => {
      intentionalStopRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  const createRecognition = useCallback(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return null;
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
      // "no-speech" fires constantly during natural pauses while talking —
      // not a real error, so don't surface it or stop listening for it.
      if (event.error === "no-speech") return;
      intentionalStopRef.current = true;
      setError(event.error === "not-allowed" ? "Microphone permission denied." : `Voice recognition error: ${event.error}`);
      setRecording(false);
    };
    recognition.onend = () => {
      // Chrome silently ends recognition after a short pause even with
      // continuous:true. If the user didn't ask us to stop, keep going
      // instead of leaving them stuck on a dead "Listening…" state.
      if (intentionalStopRef.current) {
        setRecording(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        setRecording(false);
      }
    };
    return recognition;
  }, []);

  const start = useCallback(
    (initial = "") => {
      const recognition = createRecognition();
      if (!recognition) {
        setError("Voice recognition is not supported in this browser.");
        return;
      }
      setError(null);
      intentionalStopRef.current = false;
      baseRef.current = initial ? initial.trimEnd() + " " : "";
      recognitionRef.current = recognition;
      try {
        recognition.start();
        setRecording(true);
      } catch {
        setError("Could not start the microphone. Try again.");
        setRecording(false);
      }
    },
    [createRecognition],
  );

  const stop = useCallback(() => {
    intentionalStopRef.current = true;
    recognitionRef.current?.stop();
    setRecording(false);
  }, []);

  return { supported, recording, transcript, setTranscript, error, start, stop };
}
