/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: v("paper"), card: v("card"), ink: v("ink"), muted: v("muted"), line: v("line"),
        brand: v("brand"), "brand-ink": v("brand-ink"), accent: v("accent"), "accent-ink": v("accent-ink"),
        sand: v("sand"), ok: v("ok"), bad: v("bad"), warn: v("warn"),
      },
      fontFamily: {
        sans: ["Geist", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      maxWidth: { page: "76rem" },
      boxShadow: {
        soft: "0 1px 2px rgb(22 24 23 / 0.04), 0 8px 24px -12px rgb(22 24 23 / 0.10)",
        lift: "0 2px 4px rgb(22 24 23 / 0.04), 0 24px 48px -20px rgb(22 24 23 / 0.22)",
      },
    },
  },
  plugins: [],
};
