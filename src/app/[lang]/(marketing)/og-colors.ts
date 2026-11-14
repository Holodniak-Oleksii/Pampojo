// Satori renders the OG image outside CSS, so tokens are unavailable; these mirror globals.css.
export const OG_COLORS = {
  // eslint-disable-next-line no-restricted-syntax -- mirrors --background
  background: '#ECE9E4',
  // eslint-disable-next-line no-restricted-syntax -- mirrors --foreground
  foreground: '#24221F',
  // eslint-disable-next-line no-restricted-syntax -- mirrors --accent
  accent: '#EC8447',
  // eslint-disable-next-line no-restricted-syntax -- mirrors --muted-foreground
  muted: '#5C5751',
} as const;
