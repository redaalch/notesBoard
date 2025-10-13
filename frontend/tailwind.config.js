/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 2px 16px rgba(0, 0, 0, 0.04)",
        medium: "0 4px 24px rgba(0, 0, 0, 0.08)",
        large: "0 8px 48px rgba(0, 0, 0, 0.12)",
        glow: "0 0 20px rgba(99, 102, 241, 0.4)",
        "inner-soft": "inset 0 2px 4px rgba(0, 0, 0, 0.06)",
      },
      dropShadow: {
        glow: "0 0 10px rgba(99, 102, 241, 0.5)",
      },
      screens: {
        xs: "475px",
        tablet: "768px",
        laptop: "1024px",
        desktop: "1280px",
      },
    },
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      "forest",
      "dark",
      "coffee",
      "retro",
      "light",
      "cupcake",
      "valentine",
      "cyberpunk",
      "luxury",
      "business",
    ],
  },
};
