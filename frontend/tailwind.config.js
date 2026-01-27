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
  primary: "#4B6BFB", // Brand blue-500
  "primary-content": "#FFFFFF",
  secondary: "#6366F1", // Indigo for secondary actions
  "secondary-content": "#FFFFFF",
  accent: "#0BB89C", // Teal accent
  "accent-content": "#FFFFFF",
  neutral: "#334155", // Neutral slate-700
  "neutral-content": "#F8FAFC",
  "base-100": "#F8FAFC", // surface-1
  "base-200": "#FFFFFF", // surface-2
  "base-300": "#E2E8F0", // neutral-200
  "base-content": "#0F172A", // text-primary
  info: "#3B82F6",
  success: "#10B981",
  warning: "#F59E0B",
  error: "#EF4444",
};

const notesDark = {
  primary: "#93B4FF", // Lighter brand for dark mode
  "primary-content": "#080C18",
  secondary: "#A5B4FC", // Lighter indigo
  "secondary-content": "#080C18",
  accent: "#34D399", // Brighter teal
  "accent-content": "#052F2B",
  neutral: "#334155", // Neutral slate-700
  "neutral-content": "#F1F5F9",
  "base-100": "#080C18", // surface-1 dark
  "base-200": "#0B1220", // surface-2 dark
  "base-300": "#111A29", // surface-3 dark
  "base-content": "#F1F5F9", // text-primary dark
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
        1: "var(--space-1)", // 4px
        2: "var(--space-2)", // 8px
        3: "var(--space-3)", // 12px
        4: "var(--space-4)", // 16px
        5: "var(--space-5)", // 20px
        6: "var(--space-6)", // 24px
        8: "var(--space-8)", // 32px
        10: "var(--space-10)", // 40px
        12: "var(--space-12)", // 48px
        16: "var(--space-16)", // 64px
        20: "var(--space-20)", // 80px
        24: "var(--space-24)", // 96px
        32: "var(--space-32)", // 128px
      },
      borderRadius: {
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        xl: "var(--radius-xl)",
        "2xl": "var(--radius-2xl)",
        "3xl": "var(--radius-3xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        xs: "var(--shadow-xs)",
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        "2xl": "var(--shadow-2xl)",
        inner: "var(--shadow-inner)",
        glow: "var(--shadow-glow)",
        "glow-lg": "var(--shadow-glow-lg)",
        // Legacy aliases
        hairline: "var(--shadow-xs)",
        soft: "var(--shadow-md)",
        medium: "var(--shadow-lg)",
        large: "var(--shadow-2xl)",
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
