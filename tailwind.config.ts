import type { Config } from "tailwindcss"

const config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
    "*.{js,ts,jsx,tsx,mdx}",
  ],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)"],
        serif: ["var(--font-serif)"],
        montserrat: ["var(--font-montserrat)"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Fire-inspired color palette
        fire: {
          deep: "hsl(var(--fire-deep))",
          core: "hsl(var(--fire-core))",
          bright: "hsl(var(--fire-bright))",
          golden: "hsl(var(--fire-golden))",
          tips: "hsl(var(--fire-tips))",
          hot: "hsl(var(--fire-hot))",
          ember: "hsl(var(--fire-ember))",
        },
        // Semantic fire colors
        flame: {
          50: "#FFF8E1", // Lightest flame
          100: "#FFECB3", // Very light flame
          200: "#FFE082", // Light flame
          300: "#FFD54F", // Medium light flame
          400: "#FFCA28", // Medium flame
          500: "#FFC107", // Base flame (amber)
          600: "#FFB300", // Medium dark flame
          700: "#FFA000", // Dark flame
          800: "#FF8F00", // Very dark flame
          900: "#FF6F00", // Darkest flame
        },
        ember: {
          50: "#FFF3E0", // Lightest ember
          100: "#FFE0B2", // Very light ember
          200: "#FFCC80", // Light ember
          300: "#FFB74D", // Medium light ember
          400: "#FFA726", // Medium ember
          500: "#FF9800", // Base ember (orange)
          600: "#FB8C00", // Medium dark ember
          700: "#F57C00", // Dark ember
          800: "#EF6C00", // Very dark ember
          900: "#E65100", // Darkest ember
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "fire-flicker": {
          "0%, 100%": {
            opacity: "1",
            transform: "scale(1)",
            filter: "brightness(1)",
          },
          "25%": {
            opacity: "0.8",
            transform: "scale(1.02)",
            filter: "brightness(1.1)",
          },
          "50%": {
            opacity: "0.9",
            transform: "scale(0.98)",
            filter: "brightness(0.9)",
          },
          "75%": {
            opacity: "1.1",
            transform: "scale(1.01)",
            filter: "brightness(1.05)",
          },
        },
        "fire-glow": {
          "0%, 100%": {
            boxShadow: "0 0 20px hsl(var(--fire-bright) / 0.3)",
          },
          "50%": {
            boxShadow: "0 0 30px hsl(var(--fire-bright) / 0.5), 0 0 50px hsl(var(--fire-golden) / 0.3)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fire-flicker": "fire-flicker 3s infinite ease-in-out",
        "fire-glow": "fire-glow 2s infinite ease-in-out",
      },
      backgroundImage: {
        "fire-gradient": "var(--fire-gradient)",
        "fire-gradient-subtle": "var(--fire-gradient-subtle)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
