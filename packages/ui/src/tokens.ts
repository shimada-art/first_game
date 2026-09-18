// Transcribed from the Souk El Kdoub app guide's own :root palette, so the
// game engine's brand and this guide never drift apart. Do not invent new
// colors here — extend the guide first, then mirror it.

export const colors = {
  paper: "#EDE6D6",
  paper2: "#E3DAC4",
  card: "#F6F1E6",

  ink: "#2B2620",
  inkSoft: "#6B5F4F",
  line: "#C9BCA0",

  spice: "#B8721E",
  spiceText: "#7A4A0F",
  spiceBg: "#F3E3CC",

  textile: "#8A3244",
  textileText: "#5C1F29",
  textileBg: "#F0DCDF",

  gold: "#8A6D1F",
  goldText: "#5C4813",
  goldBg: "#EFE6C8",

  gem: "#1F6B63",
  gemText: "#154D47",
  gemBg: "#D9EBE8",

  secret: "#5B3358",
  secretBg: "#E9DEE7",
} as const;

export type ColorToken = keyof typeof colors;

/** Resource -> color token, per the canonical spec's 4 resource types. */
export const resourceColors = {
  spice: colors.spice,
  textile: colors.textile,
  gold: colors.gold,
  gem: colors.gem,
} as const;

export const fonts = {
  headingLatin: "'Fraunces', serif",
  bodyLatin: "'Source Serif 4', serif",
  headingArabic: "'Amiri', serif",
  bodyArabic: "'Markazi Text', serif",
} as const;

export const radii = {
  sm: "8px",
  md: "10px",
  lg: "20px",
  pill: "999px",
} as const;
