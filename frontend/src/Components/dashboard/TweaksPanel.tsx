import {
  useDashboardShell,
  type DsAccent,
  type DsDensity,
  type DsSidebar,
  type DsTheme,
} from "./DashboardShell";

const THEMES: { value: DsTheme; label: string }[] = [
  { value: "dark", label: "dark" },
  { value: "light", label: "light" },
];

const ACCENTS: { value: DsAccent; hex: string }[] = [
  { value: "violet", hex: "#a78bfa" },
  { value: "amber", hex: "#f59e0b" },
  { value: "green", hex: "#4ade80" },
  { value: "blue", hex: "#60a5fa" },
  { value: "pink", hex: "#f472b6" },
];

const DENSITIES: { value: DsDensity; label: string }[] = [
  { value: "compact", label: "compact" },
  { value: "normal", label: "normal" },
  { value: "relaxed", label: "relaxed" },
];

const SIDEBARS: { value: DsSidebar; label: string }[] = [
  { value: "wide", label: "wide" },
  { value: "narrow", label: "narrow" },
];

export default function TweaksPanel() {
  const { tweaks, setTweak, tweaksOpen, setTweaksOpen } = useDashboardShell();

  if (!tweaksOpen) return null;

  return (
    <div className="ds-tweaks" role="dialog" aria-label="Dashboard tweaks">
      <div className="ds-tweaks-head">
        <span>Tweaks</span>
        <button
          type="button"
          className="ds-mini-btn"
          onClick={() => setTweaksOpen(false)}
          aria-label="Close tweaks"
        >
          esc
        </button>
      </div>
      <div className="ds-tweaks-body">
        <div className="ds-tw-row">
          <label>Theme</label>
          <div className="ds-tw-seg">
            {THEMES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={tweaks.theme === t.value ? "on" : ""}
                onClick={() => setTweak("theme", t.value)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ds-tw-row">
          <label>Accent</label>
          <div className="ds-tw-swatches">
            {ACCENTS.map((a) => (
              <button
                key={a.value}
                type="button"
                className={`ds-tw-sw${tweaks.accent === a.value ? " on" : ""}`}
                style={{ background: a.hex }}
                onClick={() => setTweak("accent", a.value)}
                aria-label={`Accent ${a.value}`}
              />
            ))}
          </div>
        </div>

        <div className="ds-tw-row">
          <label>Density</label>
          <div className="ds-tw-seg">
            {DENSITIES.map((d) => (
              <button
                key={d.value}
                type="button"
                className={tweaks.density === d.value ? "on" : ""}
                onClick={() => setTweak("density", d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="ds-tw-row">
          <label>Sidebar</label>
          <div className="ds-tw-seg">
            {SIDEBARS.map((s) => (
              <button
                key={s.value}
                type="button"
                className={tweaks.sidebar === s.value ? "on" : ""}
                onClick={() => setTweak("sidebar", s.value)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
