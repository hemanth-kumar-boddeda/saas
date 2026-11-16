import React from "react";
import MarketingNavbar from "../landing/MarketingNavbar";
import MarketingFooter from "../landing/MarketingFooter";

/** Shared dark layout for About / Terms pages. */
export default function LegalPage({ chip, title, intro, children }: { chip: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <div className="dark cf-root relative min-h-screen bg-cf-bg font-cf text-cf-text">
      <div className="cf-aurora" aria-hidden="true" />
      <div className="relative z-10">
        <MarketingNavbar />
        <main className="mx-auto max-w-3xl px-4 pb-24 pt-36 md:px-8">
          <span className="cf-chip cf-rise">{chip}</span>
          <h1 className="cf-hero-gradient cf-rise mt-5 text-4xl font-semibold tracking-tight sm:text-5xl" style={{ "--i": 1 } as React.CSSProperties}>{title}</h1>
          <p className="cf-rise mt-4 text-lg text-cf-muted" style={{ "--i": 2 } as React.CSSProperties}>{intro}</p>
          <div className="cf-glass cf-rise mt-10 space-y-8 p-6 sm:p-8" style={{ "--i": 3 } as React.CSSProperties}>{children}</div>
        </main>
        <MarketingFooter />
      </div>
    </div>
  );
}

export const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section>
    <h2 className="text-lg font-semibold">{title}</h2>
    <div className="mt-2 space-y-3 text-cf-muted leading-relaxed">{children}</div>
  </section>
);
