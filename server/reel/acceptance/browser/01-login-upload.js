// Playwright check of the AI editor against a THROWAWAY stack (API :8010, client :3010, DB reelflow_stage3_verify, user verify@example.test). See docs/reelflow/STAGE3_REPORT.md. Not run by vitest.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1360, height: 900 } }); const p = await ctx.newPage();
  const errs = []; p.on("console", (m) => { if (m.type() === "error") errs.push(m.text().slice(0, 200)); }); p.on("pageerror", (e) => errs.push("PAGEERR " + e.message.slice(0, 200)));
  await p.goto("http://localhost:3010/login", { waitUntil: "networkidle" });
  await p.fill("#email", "verify@example.test"); await p.fill("#password", "Verify#12345"); await p.click("button[type=submit]");
  await p.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  console.log("after login:", p.url());
  await p.goto("http://localhost:3010/projects", { waitUntil: "networkidle" });
  await p.fill("#new-project", "Stage3 UI check"); await p.click("text=Create project");
  await p.waitForSelector("text=Stage3 UI check"); await p.click("text=Stage3 UI check");
  await p.waitForURL(/projects\/[a-f0-9]{24}/); const pid = p.url().split("/projects/")[1].split(/[/?#]/)[0]; console.log("project", pid);
  await p.screenshot({ path: "/tmp/s3/01-review.png" });
  console.log("editor link:", await p.locator("text=Open AI editor").count());
  await p.goto(`http://localhost:3010/projects/${pid}/editor`, { waitUntil: "networkidle" });
  await p.screenshot({ path: "/tmp/s3/02-empty.png" });
  await p.setInputFiles("input[type=file]", "/tmp/s3/rgb.mp4");
  await p.waitForSelector("[aria-label=Timeline]", { timeout: 60000 });
  await p.screenshot({ path: "/tmp/s3/03-uploaded.png" });
  console.log("errors:", JSON.stringify(errs.slice(0, 8)));
  require("fs").writeFileSync("/tmp/s3/pid", pid);
  await b.close();
})().catch((e) => { console.error("FAIL", e.message.split("\n")[0]); process.exit(1); });
