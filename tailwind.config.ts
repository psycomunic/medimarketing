import type { Config } from "tailwindcss";

/**
 * Design tokens da identidade visual "Medi Marketing" (ver seção 3 do briefing).
 * Estética médica premium: azul-médico + teal dominam, coral apenas em CTAs.
 */
const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1200px",
      },
    },
    extend: {
      colors: {
        // Paleta médica (tokens da seção 3)
        "azul-medico": "#0B4F6C",
        "azul-profundo": "#073B52",
        teal: {
          DEFAULT: "#1A9E8F",
          claro: "#5FC9B8",
        },
        "verde-menta": "#E8F6F3",
        "branco-clinico": "#F8FBFC",
        "cinza-texto": "#2E3A40",
        "cinza-suave": "#6B7A82",
        coral: "#FF6B6B",
        sucesso: "#22C55E",
        alerta: "#F59E0B",
        // Aliases semânticos para componentes shadcn
        border: "#E2ECEF",
        input: "#E2ECEF",
        ring: "#1A9E8F",
        background: "#F8FBFC",
        foreground: "#2E3A40",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-poppins)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        lg: "1rem",
        md: "0.75rem",
        sm: "0.5rem",
      },
      boxShadow: {
        soft: "0 4px 24px -8px rgba(11, 79, 108, 0.12)",
        card: "0 8px 40px -12px rgba(11, 79, 108, 0.14)",
        cta: "0 10px 30px -8px rgba(255, 107, 107, 0.45)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
