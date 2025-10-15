const DEFAULT_HEIGHT = 56;
const DEFAULT_WIDTH = 240;

function Sparkline({
  data = [],
  height = DEFAULT_HEIGHT,
  width = DEFAULT_WIDTH,
  className,
  strokeClassName = "text-primary",
  fillClassName = "text-primary",
  ariaLabel,
}) {
  if (!Array.isArray(data) || data.length === 0) {
    return (
      <div
        className="flex h-full min-h-[56px] w-full items-center justify-center rounded-xl border border-dashed border-base-300 text-xs text-base-content/60"
        aria-live="polite"
      >
        Not enough data yet
      </div>
    );
  }

  const safeHeight = Math.max(height, 32);
  const safeWidth = Math.max(width, 120);
  const inset = 4;
  const usableHeight = safeHeight - inset * 2;
  const usableWidth = safeWidth - inset * 2;
  const denominator = Math.max(data.length - 1, 1);
  const maxValue = Math.max(...data, 1);

  const points = data
    .map((value, index) => {
      const x = inset + (index / denominator) * usableWidth;
      const ratio = value / maxValue;
      const y = inset + (1 - ratio) * usableHeight;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `${points} ${inset + usableWidth},${inset + usableHeight} ${inset},${inset + usableHeight}`;
  const lastValue = data[data.length - 1];
  const lastX = inset + ((data.length - 1) / denominator) * usableWidth;
  const lastRatio = lastValue / maxValue;
  const lastY = inset + (1 - lastRatio) * usableHeight;

  return (
    <svg
      className={["h-full w-full", className].filter(Boolean).join(" ")}
      viewBox={`0 0 ${safeWidth} ${safeHeight}`}
      role={ariaLabel ? "img" : undefined}
      aria-label={ariaLabel}
      preserveAspectRatio="none"
    >
      <polygon
        points={areaPoints}
        className={fillClassName}
        fill="currentColor"
        opacity={0.18}
      />
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={strokeClassName}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3}
        fill="currentColor"
        className={strokeClassName}
      />
    </svg>
  );
}

export default Sparkline;
