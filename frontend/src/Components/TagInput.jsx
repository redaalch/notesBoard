import { useMemo, useState } from "react";
import { TagIcon, XIcon } from "lucide-react";
import { formatTagLabel, normalizeTag } from "../lib/Utils.js";

const MAX_TAGS = 8;

function TagInput({ value = [], onChange, placeholder = "Add tag" }) {
  const [inputValue, setInputValue] = useState("");

  const normalizedValue = useMemo(
    () => value.map((tag) => normalizeTag(tag)),
    [value]
  );

  const handleAddTag = (rawTag) => {
    const trimmed = normalizeTag(rawTag);
    if (!trimmed) return;

    if (normalizedValue.includes(trimmed)) {
      setInputValue("");
      return;
    }

    if (value.length >= MAX_TAGS) {
      return;
    }

    onChange?.([...normalizedValue, trimmed]);
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange?.(
      normalizedValue.filter((tag) => tag !== normalizeTag(tagToRemove))
    );
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      handleAddTag(inputValue);
    } else if (
      event.key === "Backspace" &&
      !inputValue.length &&
      value.length > 0
    ) {
      handleRemoveTag(normalizedValue[normalizedValue.length - 1]);
    }
  };

  const handleBlur = () => {
    handleAddTag(inputValue);
  };

  return (
    <div className="space-y-2">
      <div className="input input-bordered flex items-center gap-2">
        <TagIcon className="size-4 text-base-content/60" />
        <input
          type="text"
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder={placeholder}
          className="flex-1 bg-transparent outline-none"
          aria-label="Add a note tag"
        />
        <span className="text-xs text-base-content/50">
          {value.length}/{MAX_TAGS}
        </span>
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {normalizedValue.map((tag) => (
            <span key={tag} className="badge badge-outline gap-1">
              {formatTagLabel(tag)}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="btn btn-xs btn-ghost btn-circle"
                aria-label={`Remove tag ${formatTagLabel(tag)}`}
              >
                <XIcon className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default TagInput;
