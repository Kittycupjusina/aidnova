import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#0F69FF",
        accent: "#FF8A3D",
      },
    },
  },
  plugins: [],
} satisfies Config;


