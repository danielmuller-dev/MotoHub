import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        asphalt: "#20262d",
        graphite: "#2f3a45",
        signal: "#f5b700",
        petrol: "#087e8b",
        mint: "#46b29d",
        danger: "#c44536"
      },
      boxShadow: {
        soft: "0 18px 55px rgba(32, 38, 45, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
