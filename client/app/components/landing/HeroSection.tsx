import Link from "next/link";
import React from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import ProductPreview from "./ProductPreview";
import BlurText from "../reactbits/BlurText";

const HeroSection: React.FC = () => (
  <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">For YouTube and Instagram creators and their editors</span>

        <div role="heading" aria-level={1} className="cf-hero-heading mt-6 text-cf-text">
          <BlurText text="Stop chasing feedback." delay={90} animateBy="words" direction="top" trigger="load" />
          <span className="cf-hero-gradient block">Ship the video.</span>
        </div>

        <p className="body-3 mt-6 text-cf-muted md:body-1">
          Your editor sends a cut. You pin notes to the exact second, by text, voice or a
          drawing on the frame. They tick each one off and upload the next version. You
          compare the two side by side, approve, and the publish kit is already drafted.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/signup" className="cf-btn cf-btn-primary button-lg">
            Start your first review
            <ArrowRight size={18} />
          </Link>
          <a href="#how-it-works" className="cf-btn cf-btn-secondary button-lg">
            Follow one video&apos;s week
          </a>
        </div>

        <p className="body-4 mt-6 text-cf-muted">
          Editors need no account: they open a link. Nothing is posted without your approval.
        </p>
      </div>

      <div className="mt-12 md:mt-16">
        <ProductPreview compact />
      </div>
    </div>
  </section>
);

export default HeroSection;
