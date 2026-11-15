import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy, CreatorFlow",
  description:
    "What CreatorFlow stores about an account, what it stores about a project, and how a session is kept.",
};

const SECTIONS = [
  {
    title: "Account data",
    body: "An account keeps your name, your email address and a hashed password. When you sign in with Google, the provider verified email address and the provider identifier for that account are stored so the next sign in can be recognised.",
  },
  {
    title: "Session data",
    body: "Signing in sets a session that the server stores with a session identifier, the account it belongs to and the expiry of that session. The browser holds the session token in a cookie that is not readable from scripts.",
  },
  {
    title: "Verification email",
    body: "Creating an account sends a four digit code to the address on that account. The code is used to confirm the address and it expires after a few minutes.",
  },
  {
    title: "Project data",
    body: "Files that you upload are stored in the media storage of the platform and are attached to the project they belong to. Private file links are not published anywhere and are only given to the people on the project.",
  },
  {
    title: "Payments",
    body: "Payments for marketplace purchases are handled by the payment provider. The platform receives the result of the payment and the order it belongs to. Card numbers are never stored here.",
  },
  {
    title: "What is not done with your data",
    body: "Your uploads and your account data are not sold. No third party advertising profile is built from a CreatorFlow account.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="cf-root min-h-screen bg-cf-bg font-cf text-cf-text">
      <main className="mx-auto max-w-3xl px-4 py-24 md:px-8 md:py-32">
        <Link href="/" className="caption-2 text-cf-muted transition-colors duration-300 hover:text-cf-text">
          Back to CreatorFlow
        </Link>

        <h1 className="heading-3 mt-6 text-cf-text">Privacy</h1>
        <p className="body-2 mt-4 text-cf-muted">
          This page describes what the current build of CreatorFlow stores and why.
          It covers the accounts, the marketplace and the parts of the workspace that
          are in development.
        </p>

        <div className="mt-12 flex flex-col gap-10">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="title-2 text-cf-text">{section.title}</h2>
              <p className="body-3 mt-2 text-cf-muted">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="caption-3 mt-12 text-cf-muted">
          This page covers the build that is running now. It is updated when the
          workspace features ship.
        </p>
      </main>
    </div>
  );
}
