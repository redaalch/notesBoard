/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";

const withOpacityVariable =
  (variable) =>
  ({ opacityValue }) => {
    if (opacityValue === undefined) {
      return `rgb(var(${variable}))`;
    }
    return `rgb(var(${variable}) / ${opacityValue})`;
  };

const notesLight = {
  primary: "#4B6BFB",
  "primary-content": "#F8FAFF",
  secondary: "#7C5CFF",
  "secondary-content": "#F5F3FF",
  accent: "#0BB89C",
  "accent-content": "#052F2B",
  neutral: "#1F2937",
  "neutral-content": "#F8FAFC",
  "base-100": "#F8FAFC",
  "base-200": "#EDF2F8",
  "base-300": "#E2E8F0",
  "base-content": "#0F172A",
  info: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const notesDark = {
  primary: "#93B4FF",
  "primary-content": "#041023",
  secondary: "#B6A4FF",
  "secondary-content": "#10062B",
  accent: "#35D3BA",
  "accent-content": "#02201C",
  neutral: "#0F172A",
  "neutral-content": "#E2E8F0",
  "base-100": "#0B1220",
  "base-200": "#111A2B",
  "base-300": "#1F2A3C",
  "base-content": "#E2E8F0",
  info: "#60A5FA",
  success: "#34D399",
  warning: "#FBBF24",
  error: "#F87171",
};

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: withOpacityVariable("--color-brand-50"),
          100: withOpacityVariable("--color-brand-100"),
          200: withOpacityVariable("--color-brand-200"),
          300: withOpacityVariable("--color-brand-300"),
          400: withOpacityVariable("--color-brand-400"),
          500: withOpacityVariable("--color-brand-500"),
          600: withOpacityVariable("--color-brand-600"),
          700: withOpacityVariable("--color-brand-700"),
          800: withOpacityVariable("--color-brand-800"),
          900: withOpacityVariable("--color-brand-900"),
        },
        surface: {
          base: withOpacityVariable("--color-surface-1"),
          raised: withOpacityVariable("--color-surface-2"),
          overlay: withOpacityVariable("--color-surface-overlay"),
        },
        border: {
          subtle: withOpacityVariable("--color-border-subtle"),
          strong: withOpacityVariable("--color-border-strong"),
        },
        text: {
          primary: withOpacityVariable("--color-text-primary"),
          muted: withOpacityVariable("--color-text-muted"),
          subtle: withOpacityVariable("--color-text-subtle"),
          inverted: withOpacityVariable("--color-text-inverted"),
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
        ],
        display: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Helvetica Neue",
          "Arial",
          "Noto Sans",
          "sans-serif",
        ],
      },
      fontSize: {
        xs: ["var(--font-size-xs)", { lineHeight: "var(--line-height-tight)" }],
        sm: ["var(--font-size-sm)", { lineHeight: "var(--line-height-tight)" }],
        base: [
          "var(--font-size-base)",
          { lineHeight: "var(--line-height-normal)" },
        ],
        lg: [
          "var(--font-size-lg)",
          { lineHeight: "var(--line-height-normal)" },
        ],
        xl: ["var(--font-size-xl)", { lineHeight: "var(--line-height-tight)" }],
        "2xl": [
          "var(--font-size-2xl)",
          { lineHeight: "var(--line-height-tight)" },
        ],
        "3xl": [
          "var(--font-size-3xl)",
          { lineHeight: "var(--line-height-tight)" },
        ],
        "4xl": [
          "var(--font-size-4xl)",
          { lineHeight: "var(--line-height-tight)" },
        ],
        "5xl": [
          "var(--font-size-5xl)",
          { lineHeight: "var(--line-height-tight)" },
        ],
      },
      spacing: {
        13: "3.25rem",
        14: "3.5rem",
        15: "3.75rem",
        18: "4.5rem",
        22: "5.5rem",
        26: "6.5rem",
        30: "7.5rem",
        36: "9rem",
        44: "11rem",
        88: "22rem",
        128: "32rem",
      },
      borderRadius: {
        lg: "1rem",
        xl: "1.25rem",
        "2xl": "1.5rem",
        "3xl": "1.75rem",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        hairline: "var(--shadow-hairline)",
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        large: "var(--shadow-large)",
        glow: "var(--shadow-glow)",
        "inner-soft": "var(--shadow-inner)",
      },
      dropShadow: {
        glow: "0 0 14px rgba(75, 107, 251, 0.4)",
      },
      transitionTimingFunction: {
        "standard-ease": "cubic-bezier(0.2, 0, 0, 1)",
      },
      transitionDuration: {
        120: "120ms",
        180: "180ms",
        220: "220ms",
      },
      screens: {
        xs: "475px",
        tablet: "768px",
        laptop: "1024px",
        desktop: "1280px",
      },
      maxWidth: {
        "8xl": "88rem",
      },
      zIndex: {
        60: "60",
        70: "70",
        80: "80",
        90: "90",
        99: "99",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      {
        notesLight,
      },
      {
        notesDark,
      },
    ],
  },
};
