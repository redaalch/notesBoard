/** @type {import('tailwindcss').Config} */
import daisyui from "daisyui";
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [daisyui],
  daisyui: {
    themes: [
      "forest",
      "dark",
      "coffee",
      "emerald",
      "synthwave",
      "pastel",
      {
        aurora: {
          primary: "#8B5CF6",
          "primary-content": "#0B1120",
          secondary: "#22D3EE",
          accent: "#F472B6",
          neutral: "#1E1B4B",
          "neutral-content": "#E2E8F0",
          "base-100": "#0F172A",
          info: "#67E8F9",
          success: "#4ADE80",
          warning: "#FBBF24",
          error: "#F87171",
        },
      },
    ],
  },
};
