/**
 * useVoiceInput – Record audio in the browser and transcribe via Groq Whisper.
 *
 * State machine: idle → recording → transcribing → idle
 */
import { useCallback, useEffect, useRef, useState } from "react";
import api from "../lib/axios";
import { extractApiError } from "../lib/extractApiError";

export interface UseVoiceInputOptions {
  /** Called with the transcribed text on success */
  onTranscription: (text: string) => void;
  /** Max recording duration in seconds (default 300 = 5 min) */
  maxDuration?: number;
}

export interface UseVoiceInputReturn {
  isRecording: boolean;
  isTranscribing: boolean;
  /** Elapsed recording time in seconds */
  recordingDuration: number;
  error: string | null;
  /** Whether the browser supports MediaRecorder */
  isSupported: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
}

/** Pick the best audio MIME type the browser supports */
function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return "audio/webm";
}

export function useVoiceInput({
  onTranscription,
  maxDuration = 300,
}: UseVoiceInputOptions): UseVoiceInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mimeTypeRef = useRef<string>("");
  const cancelledRef = useRef(false);

  const isSupported =
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof MediaRecorder !== "undefined";

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setRecordingDuration(0);
  }, []);

  const sendForTranscription = useCallback(
    async (blob: Blob) => {
      setIsTranscribing(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        const res = await api.post("/ai/transcribe", formData, {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 60_000,
        });

        if (res.data?.empty) {
          setError("No speech detected. Please try again.");
          return;
        }

        if (res.data?.text) {
          onTranscription(res.data.text);
        }
      } catch (err: unknown) {
        setError(extractApiError(err, "Transcription failed. Please try again."));
      } finally {
        setIsTranscribing(false);
      }
    },
    [onTranscription],
  );

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice input is not supported in this browser.");
      return;
    }

    setError(null);
    cancelledRef.current = false;
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const wasCancel = cancelledRef.current;
        const chunks = [...chunksRef.current];
        cleanup();

        if (wasCancel || chunks.length === 0) {
          setIsRecording(false);
          return;
        }

        setIsRecording(false);
        const blob = new Blob(chunks, { type: mimeType });
        sendForTranscription(blob);
      };

      recorder.start(1000); // collect data every second
      setIsRecording(true);

      // Duration timer
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev + 1 >= maxDuration) {
            // Auto-stop at max duration
            recorder.stop();
            return prev + 1;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: unknown) {
      cleanup();
      const errName = (err as { name?: string })?.name;
      if (errName === "NotAllowedError" || errName === "PermissionDeniedError") {
        setError("Microphone access denied. Please allow it in your browser settings.");
      } else {
        setError("Could not access microphone.");
      }
    }
  }, [isSupported, maxDuration, cleanup, sendForTranscription]);

  const stopRecording = useCallback(() => {
    cancelledRef.current = false;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    cancelledRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    cleanup();
    setIsRecording(false);
  }, [cleanup]);

  return {
    isRecording,
    isTranscribing,
    recordingDuration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  };
}

export default useVoiceInput;
