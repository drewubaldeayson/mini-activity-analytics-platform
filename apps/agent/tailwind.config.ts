import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../shared-ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(132 19% 97%)",
        foreground: "hsl(149 36% 11%)",
        card: "hsl(0 0% 100%)",
        "card-foreground": "hsl(149 36% 11%)",
        primary: "hsl(148 50% 24%)",
        "primary-foreground": "hsl(0 0% 100%)",
        secondary: "hsl(144 28% 93%)",
        "secondary-foreground": "hsl(148 50% 24%)",
        muted: "hsl(145 20% 92%)",
        "muted-foreground": "hsl(148 14% 39%)",
        border: "hsl(148 18% 86%)",
        input: "hsl(148 18% 86%)",
        ring: "hsl(148 50% 24%)",
        accent: "hsl(145 24% 90%)",
        destructive: "hsl(12 76% 51%)",
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.5rem",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(18, 46, 30, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
