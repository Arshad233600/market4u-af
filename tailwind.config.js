/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],

  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}", "./index.css"],

  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Vazirmatn",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "Arial",
          "Noto Sans Arabic",
          "Noto Sans",
          "sans-serif",
        ],
      },

      colors: {
        // Brand (Emerald)
        brand: {
          50: "#ecfdf5",
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
          950: "#022c22",
        },
      },

      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "22px",
      },

      boxShadow: {
        soft: "0 10px 30px rgba(0,0,0,0.25)",
        card: "0 12px 40px rgba(0,0,0,0.35)",
        glow: "0 0 0 4px rgba(16,185,129,0.15)",
      },

      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(10px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(.98)", opacity: 0.6 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
      },

      animation: {
        fadeUp: "fadeUp .25s ease-out",
        pop: "pop .15s ease-out",
      },
    },
  },

  plugins: [],
};
