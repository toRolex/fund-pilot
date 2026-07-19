/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        root: "#0D0D11",
        surface: "#16161E",
        accent: {
          DEFAULT: "#60A5FA", // blue-400
          hover: "#93C5FD",   // blue-300
        },
        signal: {
          buy: "#34D399",     // emerald-400
          sell: "#FB923C",    // orange-400
          hold: "#FBBF24",    // yellow-400
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [],
};
