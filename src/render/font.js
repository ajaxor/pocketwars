// The game's typeface (Fredoka, self-hosted: src/fonts/, declared in style.css). Canvas text names it here so the board and
// the DOM windows match; the fallbacks cover the moment before the font file has loaded.
export const FONT_FAMILY = "Fredoka, ui-rounded, 'SF Pro Rounded', system-ui, sans-serif";
export const font = (weight, px) => `${weight} ${px}px ${FONT_FAMILY}`;
