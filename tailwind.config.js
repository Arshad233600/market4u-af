/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],

  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}", "./index.css"],

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
        // Brand (Afghan Green - inspired by Afghan flag green #009A44)
        brand: {
          50: "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          400: "#4ade80",
          500: "#00a84f",
          600: "#007a38",
          700: "#005c2a",
          800: "#003d1c",
          900: "#002712",
          950: "#00150a",
        },
        // Accent (Warm Gold - Afghan cultural color)
        accent: {
          400: "#fbbf24",
          500: "#f59e0b",
          600: "#d97706",
        },
      },

      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "26px",
        "4xl": "32px",
      },

      boxShadow: {
        soft: "0 4px 24px rgba(0,0,0,0.30)",
        card: "0 8px 32px rgba(0,0,0,0.40)",
        glow: "0 0 0 3px rgba(0,168,79,0.25)",
        "glow-lg": "0 0 20px rgba(0,168,79,0.20)",
        "inner-sm": "inset 0 1px 0 rgba(255,255,255,0.06)",
        float: "0 16px 48px rgba(0,0,0,0.50), 0 4px 16px rgba(0,0,0,0.30)",
      },

      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #00a84f 0%, #007a38 100%)",
        "brand-glow": "linear-gradient(135deg, #4ade80 0%, #00a84f 50%, #007a38 100%)",
        "surface-gradient": "linear-gradient(180deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)",
        "card-shine": "linear-gradient(135deg, rgba(255,255,255,0.06) 0%, transparent 50%)",
        "hero-gradient": "linear-gradient(135deg, #00150a 0%, #003d1c 40%, #002712 100%)",
      },

      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        fadeIn: {
          "0%": { opacity: 0 },
          "100%": { opacity: 1 },
        },
        slideInRight: {
          "0%": { opacity: 0, transform: "translateX(24px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        slideInLeft: {
          "0%": { opacity: 0, transform: "translateX(-24px)" },
          "100%": { opacity: 1, transform: "translateX(0)" },
        },
        pop: {
          "0%": { transform: "scale(0.94)", opacity: 0.5 },
          "60%": { transform: "scale(1.02)", opacity: 1 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        bounceIn: {
          "0%": { transform: "scale(0.8)", opacity: 0 },
          "50%": { transform: "scale(1.05)" },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)", opacity: 0 },
          "100%": { transform: "translateY(0)", opacity: 1 },
        },
        pulse2: {
          "0%, 100%": { opacity: 1 },
          "50%": { opacity: 0.5 },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-4px)" },
        },
      },

      animation: {
        fadeUp: "fadeUp 0.3s cubic-bezier(0.16,1,0.3,1)",
        fadeIn: "fadeIn 0.25s ease-out",
        slideInRight: "slideInRight 0.35s cubic-bezier(0.16,1,0.3,1)",
        slideInLeft: "slideInLeft 0.35s cubic-bezier(0.16,1,0.3,1)",
        pop: "pop 0.2s cubic-bezier(0.16,1,0.3,1)",
        shimmer: "shimmer 1.8s infinite linear",
        bounceIn: "bounceIn 0.4s cubic-bezier(0.16,1,0.3,1)",
        slideUp: "slideUp 0.4s cubic-bezier(0.16,1,0.3,1)",
        float: "float 3s ease-in-out infinite",
      },

      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },

  plugins: [],
};
