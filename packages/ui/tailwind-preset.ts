import type { Config } from "tailwindcss"
import tailwindcssAnimate from "tailwindcss-animate"

/**
 * Shared Tailwind preset for the Memberry "Friendly Clarity" design system.
 * Maps the CSS variables in `@monobase/ui/tokens.css` to semantic utilities.
 *
 * Every lean app (org, member, console) extends this — one design language,
 * no per-app forks (DESIGN.md). Usage in an app's tailwind.config.ts:
 *
 *   import preset from "@monobase/ui/tailwind-preset"
 *   export default {
 *     presets: [preset],
 *     content: ["./src/**\/*.{ts,tsx}", "../../packages/ui/src/**\/*.{ts,tsx}"],
 *   }
 */
const preset: Omit<Config, "content"> = {
  darkMode: ["class"], // dark mode deferred (DESIGN.md) — flag wired, tokens light-only for now
  theme: {
    extend: {
      fontFamily: {
        // One family for display + body + UI (DESIGN.md typography).
        sans: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        display: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
        body: ['"Hanken Grotesk"', "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Type scale (DESIGN.md): amount 44 · title 30 · section 26 · large 21 · body 18 · caption 15.
      // rem relative to the 18px root in tokens.css, so it scales with user zoom.
      fontSize: {
        amount: ["2.444rem", { lineHeight: "1.1", letterSpacing: "-0.01em" }],
        title: ["1.667rem", { lineHeight: "1.2" }],
        section: ["1.444rem", { lineHeight: "1.25" }],
        large: ["1.167rem", { lineHeight: "1.4" }],
        body: ["1rem", { lineHeight: "1.55" }],
        caption: ["0.833rem", { lineHeight: "1.4" }],
      },
      colors: {
        border: "var(--color-border)",
        "border-light": "var(--color-border-light)",
        input: "var(--color-border)",
        ring: "var(--color-primary)",
        background: "var(--color-bg)",
        foreground: "var(--color-text)",
        primary: {
          DEFAULT: "var(--color-primary)",
          press: "var(--color-primary-press)",
          mid: "var(--color-primary-mid)",
          light: "var(--color-primary-light)",
          lighter: "var(--color-primary-lighter)",
          subtle: "var(--color-primary-subtle)",
          foreground: "#FFFFFF",
        },
        cream: {
          DEFAULT: "var(--color-cream)",
          light: "var(--color-cream-light)",
          dark: "var(--color-cream-dark)",
        },
        surface: {
          DEFAULT: "var(--color-surface)",
          warm: "var(--color-surface-warm)",
        },
        "text-secondary": "var(--color-text-secondary)",
        muted: {
          DEFAULT: "var(--color-border-light)",
          foreground: "var(--color-muted)",
        },
        secondary: {
          DEFAULT: "var(--color-primary-subtle)",
          foreground: "var(--color-primary)",
        },
        accent: {
          DEFAULT: "var(--color-cream-light)",
          foreground: "var(--color-primary)",
        },
        success: { DEFAULT: "var(--color-success)", bg: "var(--color-success-bg)" },
        warning: { DEFAULT: "var(--color-warning)", bg: "var(--color-warning-bg)" },
        error: { DEFAULT: "var(--color-error)", bg: "var(--color-error-bg)" },
        info: { DEFAULT: "var(--color-info)", bg: "var(--color-info-bg)" },
        destructive: { DEFAULT: "var(--color-error)", foreground: "#FFFFFF" },
        card: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text)" },
        popover: { DEFAULT: "var(--color-surface)", foreground: "var(--color-text)" },
      },
      borderRadius: {
        sm: "var(--radius-sm)", // 8
        md: "var(--radius-md)", // 12
        lg: "var(--radius-lg)", // 18
        full: "9999px",
      },
      // 8px base, spacious (DESIGN.md). Keeps Tailwind's default scale + these anchors.
      spacing: {
        "1": "4px", "2": "8px", "3": "12px", "4": "16px", "5": "20px",
        "6": "24px", "8": "32px", "10": "40px", "12": "48px", "16": "64px", "20": "80px",
      },
      minHeight: { tap: "48px" }, // tap targets ≥ 48px (DESIGN.md accessibility)
      minWidth: { tap: "48px" },
      boxShadow: {
        soft: "var(--shadow-soft)",
        medium: "var(--shadow-medium)",
        deep: "var(--shadow-deep)",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up": { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        shimmer: { "0%": { backgroundPosition: "-200% 0" }, "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 1.5s infinite",
      },
      maxWidth: { content: "1200px" },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default preset
