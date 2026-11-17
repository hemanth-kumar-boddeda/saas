import Link from "next/link";
import React from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import HeroBackground from "./HeroBackground";
import HeroStage from "./HeroStage";

const HeroSection: React.FC = () => (
  <section className="relative isolate overflow-hidden pb-10 pt-24 md:pb-14 md:pt-32">
    <HeroBackground />
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <h1 className="max-w-4xl font-[family-name:var(--font-newsreader)] text-[44px] font-light leading-[1.05] tracking-[-0.02em] sm:text-6xl md:text-7xl">
        Stop chasing feedback.
        <br />
        <span className="italic">Ship the video.</span>
      </h1>

      <p className="mt-6 max-w-xl text-base leading-relaxed text-cf-muted md:text-lg">
        Pin notes to the exact second of a cut, by text, voice or a drawing on the frame.
        Your editor ticks them off from a link, you approve a version, and the publish kit is
        already drafted.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link href="/signup" className="cf-btn cf-btn-primary button-lg">
          Start your first review
          <ArrowRight size={18} />
        </Link>
        <a href="#how-it-works" className="cf-btn cf-btn-secondary button-lg">See one video&apos;s week</a>
      </div>
      <p className="mt-4 text-sm text-cf-muted">Editors need no account. Nothing posts without your approval.</p>

      <div className="mt-12 md:mt-16">
        <HeroStage />
        <p className="mt-3 text-xs text-cf-muted">Sample clip and notes, made up for illustration.</p>
      </div>
    </div>
  </section>
);

export default HeroSection;
