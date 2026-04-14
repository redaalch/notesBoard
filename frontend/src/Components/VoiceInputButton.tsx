import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  MicIcon,
  MicOffIcon,
  XIcon,
  CornerDownLeftIcon,
} from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import type { Editor } from "@tiptap/react";
import { useVoiceInput } from "../hooks/useVoiceInput";
import { useAiStatus } from "../hooks/useAiFeatures";

interface VoiceInputButtonProps {
  editor: Editor | null;
}

function formatDuration(secs: number): string {
  const mins = Math.floor(secs / 60)
    .toString()
    .padStart(2, "0");
  const s = (secs % 60).toString().padStart(2, "0");
  return `${mins}:${s}`;
}

/* ── Waveform bars (7, staggered) ── */

const BARS = [
  { delay: 0, frames: ["3px", "14px", "5px", "10px", "3px"] },
  { delay: 0.08, frames: ["3px", "18px", "6px", "12px", "3px"] },
  { delay: 0.16, frames: ["3px", "10px", "20px", "8px", "3px"] },
  { delay: 0.24, frames: ["3px", "22px", "8px", "16px", "3px"] },
  { delay: 0.12, frames: ["3px", "8px", "14px", "22px", "3px"] },
  { delay: 0.2, frames: ["3px", "16px", "4px", "18px", "3px"] },
  { delay: 0.04, frames: ["3px", "12px", "18px", "6px", "3px"] },
];

const WaveformBars = () => (
  <div className="flex items-center gap-[3px] h-5">
    {BARS.map((bar, i) => (
      <m.div
        key={i}
        className="w-[3px] rounded-full bg-error/70"
        animate={{ height: bar.frames }}
        transition={{
          duration: 0.8,
          repeat: Infinity,
          delay: bar.delay,
          ease: "easeInOut",
        }}
        style={{ height: "3px" }}
      />
    ))}
  </div>
);

/* ── Animation presets ── */

const SLIDE_UP = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 6 },
  transition: { duration: 0.18 },
};

/* ── Component ── */

const VoiceInputButton = ({ editor }: VoiceInputButtonProps) => {
  const { data: aiStatus } = useAiStatus();
  const voiceEnabled = aiStatus?.features?.voiceInput ?? false;
  const [previewText, setPreviewText] = useState<string | null>(null);
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    isRecording,
    isTranscribing,
    recordingDuration,
    error,
    isSupported,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useVoiceInput({
    onTranscription: (text) => setPreviewText(text),
  });

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current) clearTimeout(highlightTimer.current);
    };
  }, []);

  const handleInsert = () => {
    if (editor && previewText) {
      const from = editor.state.selection.from;
      editor.chain().focus().insertContent(previewText + " ").run();
      const to = editor.state.selection.from;

      // Flash-highlight the inserted text using the editor's own selection
      editor.commands.setTextSelection({ from, to: to - 1 });
      highlightTimer.current = setTimeout(() => {
        editor.commands.setTextSelection(to);
      }, 1500);
    }
    setPreviewText(null);
  };

  if (!isSupported || !voiceEnabled) return null;

  const isExpanded = isRecording || isTranscribing || previewText !== null;

  return (
    <AnimatePresence mode="wait">
      {/* ── Preview: transcript ready ── */}
      {previewText ? (
        <m.div
          key="preview"
          {...SLIDE_UP}
          className="pt-2 space-y-3 max-w-lg ml-auto"
        >
          <div className="flex items-center gap-2">
            <div className="size-2 rounded-full bg-success" />
            <span className="text-xs font-semibold text-base-content/60 uppercase tracking-wider">
              Transcript
            </span>
          </div>

          <div className="rounded-xl bg-base-200/60 border border-base-300/40 px-4 py-3 max-h-36 overflow-y-auto">
            <p className="text-sm text-base-content leading-relaxed whitespace-pre-wrap">
              {previewText}
            </p>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[11px] text-base-content/45 select-none">
              Inserts at cursor position
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="btn btn-xs btn-ghost text-base-content/50"
                onClick={() => setPreviewText(null)}
              >
                <XIcon className="size-3" />
                Discard
              </button>
              <button
                type="button"
                className="btn btn-sm btn-primary gap-1.5"
                onClick={handleInsert}
              >
                Insert into note
                <CornerDownLeftIcon className="size-3.5" />
              </button>
            </div>
          </div>
        </m.div>

        /* ── Transcribing ── */
      ) : isTranscribing ? (
        <m.div
          key="transcribing"
          {...SLIDE_UP}
          className="pt-2"
        >
          <div className="flex items-center gap-3 py-1">
            <span className="loading loading-spinner loading-sm text-primary" />
            <span className="text-sm text-base-content/60">
              Transcribing…
            </span>
          </div>
        </m.div>

        /* ── Recording ── */
      ) : isRecording ? (
        <m.div
          key="recording"
          {...SLIDE_UP}
          className="pt-2 space-y-3 max-w-sm ml-auto"
        >
          <div className="flex items-center gap-3">
            <div className="size-2.5 rounded-full bg-error animate-pulse flex-shrink-0" />
            <span className="text-sm font-semibold">Recording</span>
            <WaveformBars />
            <span className="text-base font-mono font-semibold text-base-content/60 ml-auto tabular-nums">
              {formatDuration(recordingDuration)}
            </span>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              className="btn btn-xs btn-ghost text-base-content/55"
              onClick={cancelRecording}
            >
              <XIcon className="size-3" />
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-sm btn-error"
              onClick={stopRecording}
            >
              <MicOffIcon className="size-3.5" />
              Stop
            </button>
          </div>
        </m.div>

        /* ── Idle ── */
      ) : (
        <m.div
          key="idle"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="flex justify-end"
        >
          <m.button
            type="button"
            className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-base-content/40 hover:text-base-content/70 hover:bg-base-200/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 transition-colors"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={startRecording}
          >
            <MicIcon className="size-3.5" />
            <span className="text-xs font-medium">Record note</span>
          </m.button>
        </m.div>
      )}
    </AnimatePresence>
  );
};

export default VoiceInputButton;
