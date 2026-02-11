import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        editor: {
          bg: "#0d1117",
          surface: "#161b22",
          border: "#30363d",
          text: "#e6edf3",
          accent: "#388bfd",
          success: "#3fb950",
          warning: "#d29922",
          error: "#f85149",
        },
      },
      fontFamily: {
        mono: ["var(--font-geist-mono)", "Fira Code", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
