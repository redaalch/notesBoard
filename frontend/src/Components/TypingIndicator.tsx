interface TypingUser {
  name: string;
}

interface TypingIndicatorProps {
  typingUsers?: TypingUser[];
}

const TypingIndicator = ({ typingUsers = [] }: TypingIndicatorProps) => {
  if (typingUsers.length === 0) {
    return null;
  }

  const getTypingText = (): string => {
    if (typingUsers.length === 1) {
      return `${typingUsers[0].name} is typing...`;
    }
    if (typingUsers.length === 2) {
      return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
    }
    if (typingUsers.length === 3) {
      return `${typingUsers[0].name}, ${typingUsers[1].name}, and ${typingUsers[2].name} are typing...`;
    }
    return `${typingUsers.length} people are typing...`;
  };

  return (
    <div className="flex items-center gap-2 text-sm text-base-content/60">
      <div className="flex gap-1">
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.3s]" />
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary [animation-delay:-0.15s]" />
        <span className="inline-block size-1.5 animate-bounce rounded-full bg-primary" />
      </div>
      <span>{getTypingText()}</span>
    </div>
  );
};

export default TypingIndicator;
