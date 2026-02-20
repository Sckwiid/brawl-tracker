import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          900: "#070b14",
          800: "#0e1421",
          700: "#151f33"
        },
        neon: {
          cyan: "#39d8ff",
          lime: "#98ff3f",
          orange: "#ff8f3f"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(57,216,255,.25), 0 12px 30px rgba(57,216,255,.2)"
      }
    }
  },
  plugins: []
};

export default config;
