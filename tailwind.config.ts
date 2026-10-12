import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        void: "#050805",
        panel: "#0b120c",
        grid: "#102214",
        acid: "#39ff14",
        mint: "#7dff6a",
        cyan: "#00f0ff",
        mag: "#ff2bd6",
        warn: "#ffb000",
      },
      fontFamily: {
        display: ["var(--font-orbitron)", "ui-sans-serif", "system-ui"],
        mono: ["var(--font-ibm)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        glow: "0 0 24px rgba(57, 255, 20, 0.18)",
        cyan: "0 0 18px rgba(0, 240, 255, 0.22)",
      },
    },
  },
  plugins: [],
};

export default config;
