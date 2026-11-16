// Builds 1280x720 thumbnail variants from a video frame: text overlay + brand colors,
// optional background removal (@imgly/background-removal-node, local ONNX model).
import sharp, { OverlayOptions } from "sharp";
import { execFile } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execFileP = promisify(execFile);

const W = 1280;
const H = 720;
export interface Brand { primary: string; secondary: string; accent: string }

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Greedy word wrap, max 3 lines. */
export const wrap = (text: string, perLine: number) => {
  const lines: string[] = [];
  for (const w of text.toUpperCase().split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last && (last + " " + w).length <= perLine) lines[lines.length - 1] = last + " " + w;
    else lines.push(w);
  }
  return lines.slice(0, 3);
};

const textSvg = (text: string, brand: Brand, pos: "bottom" | "left" | "top") => {
  const size = text.length > 18 ? 96 : 120;
  const lines = wrap(text, Math.floor(15 * (120 / size)));
  const lh = size * 1.05;
  const x = pos === "left" ? 60 : 60;
  const y0 = pos === "bottom" ? H - 60 - (lines.length - 1) * lh : pos === "top" ? 60 + size : H / 2 - ((lines.length - 1) * lh) / 2 + size / 3;
  const tspans = lines
    .map((l, i) => `<text x="${x}" y="${y0 + i * lh}" font-size="${size}" font-family="Arial Black, Impact, Helvetica, sans-serif" font-weight="900" fill="${brand.secondary}" stroke="${brand.primary}" stroke-width="10" paint-order="stroke" stroke-linejoin="round">${esc(l)}</text>`)
    .join("");
  const bar = `<rect x="0" y="0" width="${W}" height="14" fill="${brand.accent}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${bar}${tspans}</svg>`;
};

const gradient = (a: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0.45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="${a}" stop-opacity="0.85"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`;

const cover = (img: Buffer) => sharp(img).resize(W, H, { fit: "cover" });

/** Variant: frame + bottom gradient + bold text. */
export const textOnFrame = async (frame: Buffer, text: string, brand: Brand) =>
  cover(frame)
    .composite([{ input: Buffer.from(gradient(brand.primary)) }, { input: Buffer.from(textSvg(text, brand, "bottom")) }])
    .jpeg({ quality: 88 })
    .toBuffer();

/** Variant: frame as a cut-out on a brand gradient, text on the left. Falls back to a tinted frame. */
export const cutout = async (frame: Buffer, text: string, brand: Brand) => {
  const bg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${brand.primary}"/><stop offset="1" stop-color="${brand.accent}"/></linearGradient></defs><rect width="${W}" height="${H}" fill="url(#g)"/></svg>`
  );
  const layers: OverlayOptions[] = [];
  let usedCutout = false;
  try {
    const subject = await removeBg(frame);
    const fitted = await sharp(subject).resize({ height: H, width: 760, fit: "inside" }).png().toBuffer();
    const meta = await sharp(fitted).metadata();
    layers.push({ input: fitted, left: W - (meta.width ?? 760), top: H - (meta.height ?? H) });
    usedCutout = true;
  } catch {
    // ponytail: no cut-out model available -> show the frame on the right half instead.
    layers.push({ input: await sharp(frame).resize(760, H, { fit: "cover" }).toBuffer(), left: W - 760, top: 0 });
  }
  layers.push({ input: Buffer.from(textSvg(text, brand, "left")) });
  const out = await sharp(bg).composite(layers).jpeg({ quality: 88 }).toBuffer();
  return { image: out, usedCutout };
};

/** Variant: second-best frame, brand-colored tint, text on top. */
export const tintedTop = async (frame: Buffer, text: string, brand: Brand) =>
  cover(frame)
    .modulate({ saturation: 1.25 })
    .composite([
      { input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="${brand.primary}" opacity="0.28"/></svg>`) },
      { input: Buffer.from(textSvg(text, brand, "top")) },
    ])
    .jpeg({ quality: 88 })
    .toBuffer();

// Runs in a child process: the package is ESM-only (we compile to CommonJS) and a broken
// native install must fail one thumbnail variant, not crash the API process.
const REMOVE_BG = `import("@imgly/background-removal-node").then(async (m) => {
  const fs = require("fs");
  const blob = await m.removeBackground(new Blob([fs.readFileSync(process.argv[1])], { type: "image/png" }));
  fs.writeFileSync(process.argv[2], Buffer.from(await blob.arrayBuffer()));
}).catch((e) => { console.error(String(e && e.message).slice(0, 300)); process.exit(1); });`;

const removeBg = async (jpeg: Buffer): Promise<Buffer> => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "rmbg-"));
  try {
    const inp = path.join(dir, "in.png");
    const out = path.join(dir, "out.png");
    await fs.promises.writeFile(inp, await sharp(jpeg).png().toBuffer());
    await execFileP(process.execPath, ["-e", REMOVE_BG, inp, out], { timeout: 180_000, cwd: __dirname });
    return await fs.promises.readFile(out);
  } finally {
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
};
