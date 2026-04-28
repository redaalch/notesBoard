import { useEffect, useRef, useState } from "react";

interface InlineTagAdderProps {
  onAdd: (tag: string) => void;
  existingTags: string[];
}

function InlineTagAdder({ onAdd, existingTags }: InlineTagAdderProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = value.trim().toLowerCase();
    if (trimmed && !existingTags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setValue("");
    setOpen(false);
  };

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        className="badge badge-sm badge-ghost gap-0.5 text-base-content/40 hover:text-base-content/70 transition-colors cursor-pointer"
        onClick={() => setOpen(true)}
      >
        + tag
      </button>
    );
  }

  return (
    <input
      ref={inputRef}
      type="text"
      className="h-5 w-20 rounded border border-base-300/60 bg-transparent px-1.5 text-xs text-base-content placeholder:text-base-content/30 focus:outline-none focus:border-primary/40"
      placeholder="tag name"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === ",") {
          e.preventDefault();
          commit();
        }
        if (e.key === "Escape") {
          setValue("");
          setOpen(false);
        }
      }}
      onBlur={commit}
    />
  );
}

export default InlineTagAdder;
