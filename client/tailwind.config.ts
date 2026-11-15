import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: ["class"],
  theme: {
    extend: {
      fontFamily: {
        Poppins: ["var(--font-Poppins)"],
        Josefin: ["var(--font-Josefin)"],
        // CreatorFlow landing typography. Geist is the only typeface used on
        // the marketing routes; the existing app keeps its own fonts.
        cf: ["var(--font-geist-sans, system-ui)", "system-ui", "sans-serif"],
      },
      // CreatorFlow landing palette (flat dark surfaces, violet and cyan accents).
      colors: {
        cf: {
          bg: "#000000",
          surface: "#181818",
          raised: "#1F1F1F",
          overlay: "#272727",
          line: "#313131",
          warm: "#131209",
          text: "#F2F2F2",
          muted: "#A3A3A3",
          violet: "#7C5CFF",
          cyan: "#22D3EE",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic":
          "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
      },
      screens:{
        "1000px":"1000px",
        "1100px":"1100px",
        "1200px":"1200px",
        "1300px":"1300px",
        "1500px":"1500px",
        "800px" :"800px",
        "400px":"400px",
      }
    },
  },
  plugins: [],
};
export default config;
