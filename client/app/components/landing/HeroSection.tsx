import Link from "next/link";
import React from "react";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";
import ProductPreview from "./ProductPreview";

const HeroSection: React.FC = () => (
  <section className="relative overflow-hidden pb-16 pt-32 md:pb-24 md:pt-40">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">For YouTube creators and production teams</span>

        <h1 className="cf-hero-gradient cf-hero-heading mt-6">
          Your entire YouTube workflow.
          <br />
          One workspace.
        </h1>

        <p className="body-3 mt-6 text-cf-muted md:body-1">
          Create, review, refine and publish videos with your team. CreatorFlow brings
          video feedback, AI powered content creation, approvals and YouTube publishing
          together.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/signup" className="cf-btn cf-btn-primary button-lg">
            Start creating
            <ArrowRight size={18} />
          </Link>
          <a href="#product" className="cf-btn cf-btn-secondary button-lg">
            See how it works
          </a>
        </div>

        <p className="body-4 mt-6 text-cf-muted">
          From the first upload to the final publish approval, keep every step connected.
        </p>
      </div>

      <div className="mt-12 md:mt-16">
        <ProductPreview compact />
      </div>
    </div>
  </section>
);

export default HeroSection;
