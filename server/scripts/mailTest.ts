// Usage: npm run mail:test -- you@example.com   (sends one real test email with the current .env)
import "dotenv/config";
import sendMail, { mailTransport } from "../utils/sendMail";

(async () => {
  const to = process.argv[2];
  if (!to) return console.error("Usage: npm run mail:test -- you@example.com");
  console.log(`Transport: ${mailTransport() ?? "none (dev mode prints the mail)"}`);
  await sendMail({ email: to, subject: "CreatorFlow test email", template: "review-event.ejs", data: { heading: "Email works", body: "This is a test from CreatorFlow.", project: "Test", link: process.env.CLIENT_ORIGIN?.split(",")[0] || "http://localhost:3000" } });
  console.log("Sent (or printed). Check the inbox and the spam folder.");
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
