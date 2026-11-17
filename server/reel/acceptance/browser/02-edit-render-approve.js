// Playwright check of the AI editor against a THROWAWAY stack (API :8010, client :3010, DB reelflow_stage3_verify, user verify@example.test). See docs/reelflow/STAGE3_REPORT.md. Not run by vitest.
const { chromium } = require("playwright"); const fs = require("fs");
(async () => {
  const pid = fs.readFileSync("/tmp/s3/pid", "utf8");
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
  await p.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
  await p.fill("#email", "verify@example.test"); await p.fill("#password", "Verify#12345"); await p.click("button[type=submit]"); await p.waitForURL(/projects/);
  await p.goto(`http://localhost:3010/projects/${pid}/editor`, { waitUntil: "networkidle" });
  await p.waitForSelector("[aria-label=Timeline]");
  const log = (...a) => console.log(...a);
  // 1 transcribe with no key
  await p.click("button:has-text('Transcribe')");
  await p.waitForSelector("text=/not_configured|SARVAM_API_KEY/", { timeout: 20000 }).catch(() => log("TRANSCRIBE: no not-configured message appeared"));
  log("transcribe status text:", (await p.locator("[aria-live=polite]").allInnerTexts()).join(" | ").slice(0, 200));
  // 2 plan with no key
  await p.fill("#instr", "Make a 6 second reel"); await p.click("button:has-text('Plan edit')");
  await p.waitForTimeout(2500);
  log("plan toast:", (await p.locator(".Toastify__toast").allInnerTexts()).join(" | ").slice(0, 200));
  await p.screenshot({ path: "/tmp/s3/04-notconfigured.png" });
  // 3 manual: click timeline at 50% (6s), select clip, split
  const track = p.locator("[aria-label=Timeline] .relative").first(); const bb = await track.boundingBox();
  await p.mouse.click(bb.x + bb.width * 0.5, bb.y + 4);
  await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height - 2); // click the clip at 6 s: selects it and places the cursor
  log("cursor text:", await p.locator("text=/Cursor/").first().innerText());
  const splitBtn = p.locator("button:has-text('Split at cursor')"); log("split enabled:", await splitBtn.isEnabled());
  await splitBtn.click(); await p.waitForTimeout(1500);
  log("clips on v1 after split:", await p.locator("[aria-label=Timeline] >> div.mb-1 >> nth=0 >> button[title]").count());
  // mark in at 2s, delete to 4s
  await p.mouse.click(bb.x + bb.width * (2 / 12), bb.y + bb.height - 2); await p.click("button:has-text('Mark in')");
  await p.mouse.click(bb.x + bb.width * (4 / 12), bb.y + bb.height - 2);
  await p.click("button:has-text('Delete in')"); await p.waitForTimeout(1500);
  log("versions:", (await p.locator("[aria-label='Version history'] li").allInnerTexts()).map((s) => s.replace(/\n/g, " ")).join(" || "));
  await p.screenshot({ path: "/tmp/s3/05-edited.png" });
  // 4 vertical + render
  await p.click("button:has-text('Vertical 9:16')"); await p.waitForTimeout(1500);
  await p.click("button:has-text('Render preview')");
  await p.waitForSelector("video", { timeout: 90000 }).catch(() => log("NO VIDEO after render"));
  await p.waitForTimeout(3000);
  log("job text:", (await p.locator("[aria-live=polite]").first().innerText().catch(() => "")));
  const v = await p.evaluate(() => { const e = document.querySelector("video"); return e ? { w: e.videoWidth, h: e.videoHeight, d: e.duration, rs: e.readyState } : null; });
  log("video element:", JSON.stringify(v));
  await p.screenshot({ path: "/tmp/s3/06-rendered.png" });
  await p.click("button:has-text('Approve this version')"); await p.waitForTimeout(1500);
  log("approved label:", await p.locator("button:has-text('Approved')").count());
  // 5 mobile
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(500);
  await p.screenshot({ path: "/tmp/s3/07-mobile.png", fullPage: true });
  log("mobile horizontal overflow:", await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await b.close();
})().catch((e) => { console.error("FAIL", e.message.split("\n").slice(0, 3).join(" ")); process.exit(1); });
