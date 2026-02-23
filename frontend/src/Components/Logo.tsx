import logoUrl from "../assets/logo.svg";

interface LogoProps {
  size?: string;
  className?: string;
  showWordmark?: boolean;
}

function Logo({ size = "2.75rem", className, showWordmark = true }: LogoProps) {
  const containerClass = ["flex items-center gap-3", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <img
        src={logoUrl}
        alt="NotesBoard logo"
        style={{ width: size, height: size }}
        className="drop-shadow-lg"
      />
      {showWordmark ? (
        <span className="leading-tight">
          <span className="block text-xs uppercase tracking-[0.45em] text-base-content/60">
            Notes
          </span>
          <span className="block text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            Board
          </span>
        </span>
      ) : null}
    </div>
  );
}

export default Logo;
