/**
 * One-off generator: renders public/icons/icon-512.svg into the PNG set
 * required for reliable PWA installs (Android maskable + iOS touch).
 *
 *   icon-192.png / icon-512.png            — "any" purpose
 *   icon-maskable-192.png / -512.png       — "maskable" (logo inset into
 *                                            a full-bleed safe zone)
 *   apple-touch-icon.png                   — 180x180, opaque background
 *
 * Usage:  node scripts/generate-icons.mjs
 * Outputs are committed; re-run only when the source SVG changes.
 */

import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ICONS_DIR = path.join(ROOT, "public", "icons");
const SRC = path.join(ICONS_DIR, "icon-512.svg");

/** Maskable icons need ~20% padding so launchers can crop any shape. */
function maskableSvg(innerSize) {
  const pad = Math.round(innerSize * 0.1);
  const inner = innerSize - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${innerSize} ${innerSize}" width="${innerSize}" height="${innerSize}">
  <rect fill="#0E2A1E" width="100%" height="100%"/>
  <svg viewBox="0 0 512 512" x="${pad}" y="${pad}" width="${inner}" height="${inner}">
    <rect fill="#0E2A1E" rx="102" width="512" height="512"/>
    <text fill="#D4A24C" font-family="Georgia, 'EB Garamond', serif" font-weight="700" text-anchor="middle" dominant-baseline="central" x="256" y="266" font-size="280">H</text>
  </svg>
</svg>`;
}

async function main() {
  await mkdir(ICONS_DIR, { recursive: true });
  const svg = await readFile(SRC);

  const jobs = [
    { name: "icon-192.png", size: 192, input: svg },
    { name: "icon-512.png", size: 512, input: svg },
    { name: "icon-maskable-192.png", size: 192, input: Buffer.from(maskableSvg(192)) },
    { name: "icon-maskable-512.png", size: 512, input: Buffer.from(maskableSvg(512)) },
    {
      name: path.join("..", "apple-touch-icon.png"),
      size: 180,
      input: svg,
      background: "#0E2A1E",
    },
  ];

  for (const job of jobs) {
    const out = path.join(ICONS_DIR, job.name);
    await sharp(job.input, { density: 300 })
      .resize(job.size, job.size)
      .flatten({ background: job.background ?? "#0E2A1E" })
      .png()
      .toFile(out);
    console.log(`wrote ${path.relative(ROOT, out)}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
