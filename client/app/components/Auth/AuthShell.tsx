import Link from "next/link";
import React from "react";

/** Shared dark layout for sign-in, sign-up and verification. */
export default function AuthShell({ heading, sub, children, footer }: { heading: string; sub: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <div className="dark cf-root relative min-h-screen bg-cf-bg font-cf text-cf-text">
      <div className="cf-aurora" aria-hidden="true" />
      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-12">
        <Link href="/" className="cf-rise mb-8 flex items-center gap-2 self-center" aria-label="CreatorFlow home">
          <span aria-hidden="true" className="block h-7 w-7 rounded-lg bg-cf-violet" />
          <span className="text-lg font-semibold">CreatorFlow</span>
        </Link>
        <div className="cf-glass cf-rise p-7" style={{ "--i": 1 } as React.CSSProperties}>
          <h1 className="cf-hero-gradient text-2xl font-semibold tracking-tight">{heading}</h1>
          <p className="mt-1 mb-6 text-sm text-cf-muted">{sub}</p>
          {children}
        </div>
        <p className="cf-rise mt-6 text-center text-sm text-cf-muted" style={{ "--i": 2 } as React.CSSProperties}>{footer}</p>
      </main>
    </div>
  );
}
