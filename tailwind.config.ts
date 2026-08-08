import type { Config } from "tailwindcss";

const config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#EEEDFE",
          100: "#DEDBFA",
          200: "#C9C4F5",
          300: "#AFA9EC",
          400: "#8B83E0",
          500: "#6B63D1",
          600: "#534AB7",
          700: "#463A9E",
          800: "#3C3489",
          900: "#2E2868"
        },
        accent: {
          50: "#E6F1FB",
          100: "#B5D4F4",
          200: "#85B7EB",
          300: "#5E9FE0",
          400: "#378ADD",
          500: "#2470B8",
          600: "#185FA5",
          700: "#0C447C",
          800: "#082F49"
        }
      }
    }
  },
  plugins: []
} satisfies Config;

export default config;
