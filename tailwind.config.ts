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
        // Brand accent is driven by CSS variables so a "cover" skin can re-theme
        // the whole app by setting one [data-cover] attribute. The default ramp
        // (muted sage) is defined in globals.css :root — unchanged from before.
        // `<alpha-value>` keeps Tailwind's /opacity modifiers working.
        brand: {
          50: "rgb(var(--brand-50) / <alpha-value>)",
          100: "rgb(var(--brand-100) / <alpha-value>)",
          200: "rgb(var(--brand-200) / <alpha-value>)",
          300: "rgb(var(--brand-300) / <alpha-value>)",
          400: "rgb(var(--brand-400) / <alpha-value>)",
          500: "rgb(var(--brand-500) / <alpha-value>)",
          600: "rgb(var(--brand-600) / <alpha-value>)",
          700: "rgb(var(--brand-700) / <alpha-value>)",
          800: "rgb(var(--brand-800) / <alpha-value>)",
          900: "rgb(var(--brand-900) / <alpha-value>)",
        },
        // Override the default gray with a warm sand/taupe, so every existing
        // bg-gray-50 / text-gray-900 / border-gray-100 across the app warms up
        // with no per-component edits.
        gray: {
          50: "#faf9f6",
          100: "#f3f1ec",
          200: "#e7e3da",
          300: "#d4cec1",
          400: "#8c8678",
          500: "#6a6359",
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
