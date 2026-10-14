/** Brand tokens, matching the web app's Tailwind theme. */
export const colors = {
  navy950: "#061224",
  navy900: "#0b1f3a",
  navy700: "#1b3a66",
  navy100: "#e3e9f3",
  navy50: "#f1f4f9",
  emerald700: "#0f766e",
  emerald600: "#128a80",
  emerald50: "#ecf8f6",
  gold600: "#a97a1f",
  gold500: "#c8962e",
  gold100: "#f7ecd2",
  ink: "#111827",
  muted: "#5b6474",
  line: "#e3e6ec",
  surface: "#ffffff",
  canvas: "#f6f7f9",
  danger: "#b42318",
  danger50: "#fef1f0",
  warning: "#b45309",
  warning50: "#fff7e8",
} as const;

export const radius = { sm: 8, md: 12, lg: 16 } as const;
export const space = (n: number) => n * 4;
