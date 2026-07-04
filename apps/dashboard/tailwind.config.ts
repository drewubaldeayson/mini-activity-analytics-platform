import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../shared-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(138 33% 96%)",
        foreground: "hsl(151 37% 12%)",
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(151 37% 12%)",
        primary: "hsl(149 61% 29%)",
        "primary-foreground": "hsl(0 0% 100%)",
        secondary: "hsl(145 25% 92%)",
        "secondary-foreground": "hsl(151 37% 16%)",
        muted: "hsl(145 18% 91%)",
        "muted-foreground": "hsl(151 14% 41%)",
        accent: "hsl(151 24% 90%)",
        border: "hsl(151 18% 86%)",
        input: "hsl(151 18% 86%)",
        ring: "hsl(149 61% 29%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(19, 47, 31, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
