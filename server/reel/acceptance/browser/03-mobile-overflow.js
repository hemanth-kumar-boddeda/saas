// Playwright check of the AI editor against a THROWAWAY stack (API :8010, client :3010, DB reelflow_stage3_verify, user verify@example.test). See docs/reelflow/STAGE3_REPORT.md. Not run by vitest.
const { chromium } = require("playwright"); const fs = require("fs");
(async () => {
  const pid = fs.readFileSync("/tmp/s3/pid", "utf8");
  const b = await chromium.launch(); const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await p.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
  await p.fill("#email", "verify@example.test"); await p.fill("#password", "Verify#12345"); await p.click("button[type=submit]"); await p.waitForURL(/projects/);
  await p.goto(`http://localhost:3010/projects/${pid}/editor`, { waitUntil: "networkidle" }); await p.waitForSelector("[aria-label=Timeline]");
  console.log("overflow:", await p.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]));
  console.log("wide elements:", JSON.stringify(await p.evaluate(() => [...document.querySelectorAll("main *")].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1).slice(0, 5).map((e) => e.tagName + "." + String(e.className).slice(0, 60)))));
  await p.screenshot({ path: "/tmp/s3/09-mobile2.png" }); await b.close();
})();
