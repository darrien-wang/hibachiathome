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
        energy: ["Impact", "Arial Black", "Franklin Gothic Bold", "Helvetica Neue", "sans-serif"],
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
        // Fire-inspired color palette - 增强版
        fire: {
          deep: "hsl(var(--fire-deep))",
          core: "hsl(var(--fire-core))",
          bright: "hsl(var(--fire-bright))",
          golden: "hsl(var(--fire-golden))",
          tips: "hsl(var(--fire-tips))",
          hot: "hsl(var(--fire-hot))",
          ember: "hsl(var(--fire-ember))",
        },
        // 具体火焰色彩
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
        // 黑色背景主题专用颜色
        dark: {
          50: "#fafafa", // 最浅
          100: "#f4f4f5", // 很浅
          200: "#e4e4e7", // 浅
          300: "#d4d4d8", // 中浅
          400: "#a1a1aa", // 中等
          500: "#71717a", // 中深
          600: "#52525b", // 深
          700: "#3f3f46", // 很深
          800: "#27272a", // 极深
          900: "#18181b", // 最深
          950: "#09090b", // 接近黑色
        },
        // 新增烈焰橙和光感金黄
        blazing: {
          orange: "#FF6A00", // 烈焰橙
          yellow: "#FFF3B0", // 光感金黄
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
        typewriter: {
          from: { width: "0" },
          to: { width: "100%" },
        },
        "blink-cursor": {
          "from, to": { borderRightColor: "transparent" },
          "50%": { borderRightColor: "hsl(var(--fire-tips))" },
        },
        "flame-lick": {
          "0%, 100%": {
            transform: "scaleY(1) translateY(0)",
          },
          "50%": {
            transform: "scaleY(1.1) translateY(-5px)",
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fire-flicker": "fire-flicker 3s infinite ease-in-out",
        "fire-glow": "fire-glow 2s infinite ease-in-out",
        typewriter: "typewriter 2.5s steps(40, end) 1s forwards",
        "blink-cursor": "blink-cursor 0.75s step-end infinite",
        "flame-lick": "flame-lick 2s ease-in-out infinite",
      },
      backgroundImage: {
        "fire-gradient": "var(--fire-gradient)",
        "fire-gradient-text": "var(--fire-gradient-text)",
        "fire-gradient-subtle": "var(--fire-gradient-subtle)",
        "fire-texture": "var(--fire-texture)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config

export default config
