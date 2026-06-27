/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Georgia", "serif"],
        mono: ["'Courier New'", "monospace"],
      },
      colors: {
        golf: {
          green: "#1a6b3a",
          fairway: "#2d8a4e",
          rough: "#4a7c59",
          sand: "#e8d5a3",
          flag: "#ef4444",
        },
      },
      animation: {
        "ball-in": "ballIn 0.5s ease-out",
        "score-pop": "scorePop 0.4s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        ballIn: {
          "0%": { transform: "scale(0) translateY(-20px)", opacity: 0 },
          "70%": { transform: "scale(1.2)", opacity: 1 },
          "100%": { transform: "scale(1)", opacity: 1 },
        },
        scorePop: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.4)" },
          "100%": { transform: "scale(1)" },
        },
        slideIn: {
          "0%": { transform: "translateX(100%)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
      },
    },
  },
  plugins: [],
};
