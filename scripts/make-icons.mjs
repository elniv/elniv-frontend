// Generates PNG app icons from the canonical mark (src/assets/brand/elniv-mark.svg).
// Run with `npm run icons`; the output in public/icons is committed.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { root } from "./shared.mjs";

const svg = fs.readFileSync(path.join(root, "src/assets/brand/elniv-mark.svg"));
const out = path.join(root, "public/icons");
fs.mkdirSync(out, { recursive: true });

const BG = "#0d1317";

async function icon(name, size, markRatio, { transparent = false } = {}) {
  const markSize = Math.round(size * markRatio);
  const mark = await sharp(svg, { density: 384 }).resize(markSize, markSize).png().toBuffer();
  const offset = Math.round((size - markSize) / 2);
  await sharp({
    create: { width: size, height: size, channels: 4, background: transparent ? { r: 0, g: 0, b: 0, alpha: 0 } : BG },
  })
    .composite([{ input: mark, left: offset, top: offset }])
    .png()
    .toFile(path.join(out, name));
}

await icon("favicon-32.png", 32, 0.94, { transparent: true });
await icon("apple-touch-icon.png", 180, 0.7);
await icon("icon-192.png", 192, 0.7);
await icon("icon-512.png", 512, 0.7);
await icon("icon-maskable-512.png", 512, 0.52);
console.log("Icons written to public/icons");
