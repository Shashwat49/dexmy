/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        void: "#0F1D17",
        panel: "#152922",
        "panel-2": "#1B3229",
        "panel-3": "#223B31",
        chalk: "#F2ECDD",
        "chalk-muted": "#9BAFA0",
        "chalk-faint": "rgba(242,236,221,0.08)",
        brand: {
          red: "#E4271C",
          "red-dark": "#A81D15",
          "red-soft": "rgba(228,39,28,0.16)",
          gold: "#F0B429",
          "gold-soft": "rgba(240,180,41,0.16)",
        },
        success: "#4ADE80",
        "success-soft": "rgba(74,222,128,0.14)",
      },
      fontFamily: {
        display: ["Anton", "sans-serif"],
        body: ["Work Sans", "sans-serif"],
      },
    },
  },
  plugins: [],
}

