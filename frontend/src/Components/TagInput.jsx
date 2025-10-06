import { TagIcon, XIcon } from "lucide-react";
import React from "react";

const MAX_TAGS = 8;

const prettifyTag = (tag) =>
  tag
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

function TagInput({ value = [], onChange, placeholder = "Add tag" }) {
  const [inputValue, setInputValue] = React.useState("");

  const normalizedValue = React.useMemo(
    () => value.map((tag) => tag.trim().toLowerCase()),
    [value]
  );

  const handleAddTag = (rawTag) => {
    const trimmed = rawTag.trim().toLowerCase();
    if (!trimmed) return;

    const cleaned = trimmed.replace(/\s+/g, " ");
    if (normalizedValue.includes(cleaned)) {
      setInputValue("");
      return;
    }

    if (value.length >= MAX_TAGS) {
      return;
    }

    onChange?.([...normalizedValue, cleaned]);
    setInputValue("");
  };

  const handleRemoveTag = (tagToRemove) => {
    onChange?.(normalizedValue.filter((tag) => tag !== tagToRemove));
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
              {prettifyTag(tag)}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="btn btn-xs btn-ghost btn-circle"
                aria-label={`Remove tag ${tag}`}
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
