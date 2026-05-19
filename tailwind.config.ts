import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1.5rem", screens: { "2xl": "1280px" } },
    extend: {
      fontFamily: {
        // Distinctive academic-feeling pairing
        // Display: a warm serif for headings (Fraunces) — variable, modern, feels editorial
        // Body: a calm humanist sans (Manrope) — readable for long study sessions
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Warm parchment-leaning palette. Deep teal accent (medical/clinical but not sterile)
        bone: {
          50: "#fbf9f5",
          100: "#f5f1e8",
          200: "#ebe3d1",
          300: "#d9ccae",
        },
        ink: {
          900: "#1a1a1a",
          800: "#2a2826",
          700: "#3d3a36",
          600: "#5a554d",
          500: "#7a7368",
          400: "#a39c8e",
        },
        teal: {
          50: "#eaf4f3",
          400: "#3a8a82",
          500: "#256f68",
          600: "#1d5852",
          700: "#16433f",
        },
        rust: { 500: "#b85c3a", 600: "#9a4a2e" }, // for warnings/red flags
        sage: { 500: "#6b8a5a" },                // for "mastered" / success
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
      },
      borderRadius: { lg: "0.75rem", md: "0.5rem", sm: "0.25rem" },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
