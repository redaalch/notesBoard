import { ZapIcon, XIcon } from "lucide-react";

interface RateLimitedUIProps {
  onDismiss?: () => void;
}

const RateLimitedUI = ({ onDismiss = () => {} }: RateLimitedUIProps) => {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4">
      <div className="alert alert-warning shadow-lg">
        <ZapIcon className="size-6" />
        <div>
          <h3 className="font-bold">Rate limit reached</h3>
          <div className="text-sm">
            You made too many requests in a short burst. Take a short pause
            before trying again.
          </div>
        </div>
        <button
          type="button"
          className="btn btn-sm btn-ghost"
          onClick={onDismiss}
          aria-label="Dismiss rate limit alert"
        >
          <XIcon className="size-4" />
        </button>
      </div>
    </div>
  );
};

export default RateLimitedUI;
