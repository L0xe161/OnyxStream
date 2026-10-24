/** Small WCAG colour helpers used to validate user-chosen accents. */

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function toHex([r, g, b]: [number, number, number]): string {
  return `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;
}

export function luminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on `bg`. */
export function readableInk(bg: [number, number, number]): "#000000" | "#ffffff" {
  return contrastRatio(bg, [0, 0, 0]) >= contrastRatio(bg, [255, 255, 255]) ? "#000000" : "#ffffff";
}

/**
 * Nudges `hex` toward white or black until it reaches `min` contrast against
 * `ground`, so a chosen accent is always legible as text on that surface.
 */
export function ensureContrast(hex: string, ground: [number, number, number], min = 4.5): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const towards = luminance(ground) < 0.4 ? 255 : 0;
  let current: [number, number, number] = rgb;
  for (let i = 0; i < 24 && contrastRatio(current, ground) < min; i++) {
    current = current.map((v) => v + (towards - v) * 0.1) as [number, number, number];
  }
  return toHex(current);
}

/**
 * Picks the most characterful colour in an RGBA pixel buffer: saturated and
 * mid-bright pixels count most; near-black, near-white and grey are ignored.
 * Returns null for artwork with no usable colour (e.g. monochrome stills).
 */
export function dominantColor(data: ArrayLike<number>): [number, number, number] | null {
  let r = 0, g = 0, b = 0, weight = 0, used = 0;
  const total = Math.floor(data.length / 4);
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 200) continue;
    const pr = data[i], pg = data[i + 1], pb = data[i + 2];
    const max = Math.max(pr, pg, pb);
    const min = Math.min(pr, pg, pb);
    const value = max / 255;
    const saturation = max === 0 ? 0 : (max - min) / max;
    if (value < 0.2 || value > 0.97 || saturation < 0.25) continue;
    const w = saturation * saturation * (1 - Math.abs(value - 0.6));
    r += pr * w;
    g += pg * w;
    b += pb * w;
    weight += w;
    used += 1;
  }
  // Require colour in at least 3% of the frame so stray pixels never set the accent.
  return weight > 0 && used >= total * 0.03 ? [r / weight, g / weight, b / weight] : null;
}
