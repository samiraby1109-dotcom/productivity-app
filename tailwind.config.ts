import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Muted sage — calm, natural, reads as wellness. Replaces the old sky blue.
        brand: {
          50: "#f3f6f3",
          100: "#e6ece6",
          200: "#cdd9cd",
          300: "#abc0ad",
          400: "#84a088",
          500: "#648469",
          600: "#4f6b54",
          700: "#415645",
          800: "#36463a",
          900: "#2e3b31",
        },
        // Override the default gray with a warm sand/taupe, so every existing
        // bg-gray-50 / text-gray-900 / border-gray-100 across the app warms up
        // with no per-component edits.
        gray: {
          50: "#faf9f6",
          100: "#f3f1ec",
          200: "#e7e3da",
          300: "#d4cec1",
          400: "#a8a193",
          500: "#7c756a",
          600: "#5f594f",
          700: "#4a453d",
          800: "#322e29",
          900: "#211e1a",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
