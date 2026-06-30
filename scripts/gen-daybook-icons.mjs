/**
 * Generates the "Daybook" cover icon set (a distinct slate-blue notes/lists
 * glyph) into public/icons/. Run once: `node scripts/gen-daybook-icons.mjs`.
 * The default "belle" (sage meadow) icons are untouched.
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");

// A simple, believable "notes & lists" mark: a white card with three checklist
// rows (check mark + line) on a slate-blue rounded background. `pad` controls the
// safe-zone inset — larger for maskable so nothing is clipped by the OS mask.
function svg(size, pad) {
  const r = size * 0.22; // background corner radius
  const inset = size * pad;
  const card = size - inset * 2;
  const cardR = card * 0.1;
  const cx = inset;
  const cy = inset;
  // three rows inside the card
  const rowGap = card / 4;
  const rows = [1, 2, 3]
    .map((i) => {
      const y = cy + rowGap * i;
      const checkX = cx + card * 0.16;
      const lineX = cx + card * 0.34;
      const lineW = card * 0.5;
      return `
        <path d="M ${checkX - card * 0.06} ${y} l ${card * 0.04} ${card * 0.05} l ${card * 0.09} -${card * 0.11}"
              fill="none" stroke="#566f92" stroke-width="${card * 0.035}"
              stroke-linecap="round" stroke-linejoin="round"/>
        <rect x="${lineX}" y="${y - card * 0.022}" width="${lineW}" height="${card * 0.045}"
              rx="${card * 0.022}" fill="#9fb0c9"/>`;
    })
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#566f92"/>
        <stop offset="1" stop-color="#3c4f6e"/>
      </linearGradient>
    </defs>
    <rect width="${size}" height="${size}" rx="${r}" fill="url(#bg)"/>
    <rect x="${cx}" y="${cy}" width="${card}" height="${card}" rx="${cardR}" fill="#f7f8fb"/>
    ${rows}
  </svg>`;
}

async function render(name, size, pad) {
  const out = join(ICONS_DIR, name);
  await sharp(Buffer.from(svg(size, pad))).png().toFile(out);
  console.log("wrote", out);
}

await mkdir(ICONS_DIR, { recursive: true });
// "any" icons: tighter padding. maskable: generous safe zone (~0.28 inset).
await render("icon-daybook-192.png", 192, 0.2);
await render("icon-daybook-512.png", 512, 0.2);
await render("icon-daybook-maskable-192.png", 192, 0.28);
await render("icon-daybook-maskable-512.png", 512, 0.28);
await render("apple-touch-icon-daybook.png", 180, 0.16);
console.log("done");
