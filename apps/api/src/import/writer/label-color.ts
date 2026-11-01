// The web app renders label colors from a fixed set of names, so a source's
// hex color is mapped to the closest one.
const PALETTE: ReadonlyArray<readonly [string, number, number, number]> = [
  ["gray", 0x78, 0x71, 0x6c],
  ["dark-gray", 0x64, 0x74, 0x8b],
  ["purple", 0x8b, 0x5c, 0xf6],
  ["teal", 0x05, 0x96, 0x69],
  ["green", 0x16, 0xa3, 0x4a],
  ["yellow", 0xd9, 0x77, 0x06],
  ["orange", 0xea, 0x58, 0x0c],
  ["pink", 0xe1, 0x1d, 0x48],
  ["red", 0xdc, 0x26, 0x26],
];

export const DEFAULT_LABEL_COLOR = "gray";

const NAMES = new Set(PALETTE.map(([name]) => name));

export function toLabelColor(color: string | undefined): string {
  const value = color?.trim().toLowerCase() ?? "";
  if (NAMES.has(value)) return value;

  const hex = /^#?([0-9a-f]{6})$/.exec(value)?.[1];
  if (!hex) return DEFAULT_LABEL_COLOR;
  const rgb = Number.parseInt(hex, 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = rgb & 0xff;

  let best = DEFAULT_LABEL_COLOR;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [name, pr, pg, pb] of PALETTE) {
    const distance = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
    if (distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}
