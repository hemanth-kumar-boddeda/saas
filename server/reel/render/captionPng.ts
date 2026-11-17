// ffmpeg here has no drawtext/subtitles, so captions are drawn as full-frame transparent PNGs.
// ponytail: no per-word highlight yet; add by rendering one PNG per word state.
import sharp from "sharp";
import { Clip } from "../schema";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
// Verified by eye on macOS: Arial Unicode MS in the stack breaks Telugu conjunct/vowel shaping, so it is
// excluded. Real Telugu fonts first; Noto Sans Telugu covers Linux render hosts.
export const FONT = "Kohinoor Telugu, Telugu Sangam MN, Noto Sans Telugu, Helvetica, sans-serif";

export const cueText = (c: Clip) =>
  c.text ? c.text.value : (c.words ?? []).map((w) => (c.captionStyle?.script === "roman" ? w.roman ?? w.w : w.w)).join(" ");

export const captionPng = async (c: Clip, W: number, H: number, out: string) => {
  const text = cueText(c);
  const st = c.captionStyle;
  let size = c.text?.size ?? st?.size ?? 64;
  const maxW = W * 0.9;
  const est = (s: number) => [...text].length * s * 0.58;
  while (est(size) > maxW && size > 24) size -= 2;
  const color = c.text?.color ?? st?.color ?? "#ffffff";
  const y = c.text ? H * 0.2 : st?.position === "top" ? H * 0.12 : st?.position === "middle" ? H * 0.5 : H * 0.8;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <text x="${W / 2}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="700" text-anchor="middle"
    fill="${esc(color)}" stroke="#000" stroke-width="${Math.max(3, size / 12)}" paint-order="stroke">${esc(text)}</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(out);
};
