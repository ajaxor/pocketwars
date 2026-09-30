// Small colour helpers shared by the renderers.

/** Lighten (amt > 0, towards white) or darken (amt < 0, towards black) a #rgb / #rrggbb colour. */
export function shade(hex, amt) {
  const [r, g, b] = rgb(hex);
  const ch = [r, g, b].map((c) => {
    const v = amt < 0 ? c * (1 + amt) : c + (255 - c) * amt;
    return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  });
  return '#' + ch.join('');
}

/** [r, g, b] (0-255) of a #rgb / #rrggbb colour. */
export function rgb(hex) {
  let h = hex.slice(1);
  if (h.length === 3) h = [...h].map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [n >> 16, (n >> 8) & 255, n & 255];
}

/** Perceived brightness, 0 (black) to 1 (white). */
export const luma = (hex) => { const [r, g, b] = rgb(hex); return (r * .299 + g * .587 + b * .114) / 255; };
