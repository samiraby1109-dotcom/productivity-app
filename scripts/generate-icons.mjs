/**
 * Procedural PWA icon generator — zero dependencies.
 * Run: node scripts/generate-icons.mjs
 *
 * Emits (all derived from one neutral "sun over meadow" motif in the brand
 * palette — deliberately wellness-generic, consistent with the app's public
 * positioning):
 *   public/icons/icon-192.png            purpose "any"      (rounded corners)
 *   public/icons/icon-512.png            purpose "any"
 *   public/icons/icon-maskable-192.png   purpose "maskable" (full-bleed, motif in 78% safe zone)
 *   public/icons/icon-maskable-512.png   purpose "maskable"
 *   public/icons/apple-touch-icon.png    180x180 full-bleed (iOS applies its own mask)
 *   public/favicon.ico                   32x32 BMP-in-ICO
 */
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

// ─── PNG encoder ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function encodePng(width, height, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // filter byte 0 prepended to every scanline
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ─── ICO encoder (single 32px BGRA BMP entry — maximum compatibility) ────────
function encodeIco(size, rgba) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // count
  const andMaskRow = Math.ceil(size / 32) * 4;
  const imgSize = 40 + size * size * 4 + andMaskRow * size;
  header[6] = size; header[7] = size; // w, h
  header[8] = 0; header[9] = 0;       // palette, reserved
  header.writeUInt16LE(1, 10);        // planes
  header.writeUInt16LE(32, 12);       // bpp
  header.writeUInt32LE(imgSize, 14);
  header.writeUInt32LE(22, 18);       // data offset

  const bmp = Buffer.alloc(imgSize);
  bmp.writeUInt32LE(40, 0);           // BITMAPINFOHEADER
  bmp.writeInt32LE(size, 4);
  bmp.writeInt32LE(size * 2, 8);      // height doubled (XOR + AND masks)
  bmp.writeUInt16LE(1, 12);
  bmp.writeUInt16LE(32, 14);
  // BGRA rows, bottom-up
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4;
    const dst = 40 + y * size * 4;
    for (let x = 0; x < size; x++) {
      bmp[dst + x * 4 + 0] = rgba[src + x * 4 + 2];
      bmp[dst + x * 4 + 1] = rgba[src + x * 4 + 1];
      bmp[dst + x * 4 + 2] = rgba[src + x * 4 + 0];
      bmp[dst + x * 4 + 3] = rgba[src + x * 4 + 3];
    }
  }
  // AND mask left zeroed — alpha channel governs
  return Buffer.concat([header, bmp]);
}

// ─── Art ──────────────────────────────────────────────────────────────────────
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const smooth = (edge0, edge1, x) => {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

const SKY_TOP = hex("#38bdf8");   // sky-400
const SKY_BOTTOM = hex("#0369a1"); // sky-700
const SUN = hex("#fefce8");        // warm white
const HILL_BACK = hex("#bae6fd");  // sky-200
const HILL_FRONT = hex("#f0f9ff"); // sky-50

/** Motif color at art-space coords (u,v) ∈ [0,1]²; coords may exceed range. */
function art(u, v) {
  let r = lerp(SKY_TOP[0], SKY_BOTTOM[0], clamp01(v));
  let g = lerp(SKY_TOP[1], SKY_BOTTOM[1], clamp01(v));
  let b = lerp(SKY_TOP[2], SKY_BOTTOM[2], clamp01(v));
  const layer = (color, cov) => {
    r = lerp(r, color[0], cov);
    g = lerp(g, color[1], cov);
    b = lerp(b, color[2], cov);
  };
  // sun
  const ds = Math.hypot(u - 0.5, v - 0.40);
  layer(SUN, smooth(0.165, 0.150, ds));
  // back hill (large arc entering bottom-left)
  const db = Math.hypot(u - 0.16, v - 1.46);
  layer(HILL_BACK, smooth(0.93, 0.915, db));
  // front hill (large arc entering bottom-right)
  const df = Math.hypot(u - 0.86, v - 1.55);
  layer(HILL_FRONT, smooth(1.0, 0.985, df));
  return [r, g, b];
}

/** Signed-ish coverage for a rounded square centered in [0,1]² */
function roundedSquareCoverage(u, v, radius) {
  const qx = Math.abs(u - 0.5) - (0.5 - radius);
  const qy = Math.abs(v - 0.5) - (0.5 - radius);
  const d = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
  return smooth(0.004, -0.004, d);
}

/**
 * mode:
 *  - "any":      rounded square with transparent corners
 *  - "full":     opaque full-bleed (apple touch icon, favicon)
 *  - "maskable": opaque full-bleed, motif shrunk into the centre 78% safe zone
 */
function drawIcon(size, mode) {
  const SS = 3; // supersampling
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (x + (sx + 0.5) / SS) / size;
          const v = (y + (sy + 0.5) / SS) / size;
          const au = mode === "maskable" ? (u - 0.5) / 0.78 + 0.5 : u;
          const av = mode === "maskable" ? (v - 0.5) / 0.78 + 0.5 : v;
          const [cr, cg, cb] = art(au, av);
          const cov = mode === "any" ? roundedSquareCoverage(u, v, 0.21) : 1;
          r += cr * cov; g += cg * cov; b += cb * cov; a += cov;
        }
      }
      const n = SS * SS;
      const i = (y * size + x) * 4;
      const alpha = a / n;
      // premultiplied accumulation → unpremultiply for straight-alpha PNG
      px[i + 0] = alpha > 0 ? Math.round(r / n / alpha) : 0;
      px[i + 1] = alpha > 0 ? Math.round(g / n / alpha) : 0;
      px[i + 2] = alpha > 0 ? Math.round(b / n / alpha) : 0;
      px[i + 3] = Math.round(alpha * 255);
    }
  }
  return px;
}

const out = (p, buf) => { writeFileSync(p, buf); console.log(`  wrote ${p} (${buf.length} bytes)`); };

console.log("Generating PWA icons…");
out("public/icons/icon-192.png", encodePng(192, 192, Buffer.from(drawIcon(192, "any"))));
out("public/icons/icon-512.png", encodePng(512, 512, Buffer.from(drawIcon(512, "any"))));
out("public/icons/icon-maskable-192.png", encodePng(192, 192, Buffer.from(drawIcon(192, "maskable"))));
out("public/icons/icon-maskable-512.png", encodePng(512, 512, Buffer.from(drawIcon(512, "maskable"))));
out("public/icons/apple-touch-icon.png", encodePng(180, 180, Buffer.from(drawIcon(180, "full"))));
out("public/favicon.ico", encodeIco(32, drawIcon(32, "full")));
console.log("Done.");
