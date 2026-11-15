import React from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react/dist/ssr/ArrowRight";

const FinalCTA: React.FC = () => (
  <section className="bg-cf-surface py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-card flex flex-col items-start gap-6 p-8 md:p-12">
        <h2 className="cf-section-heading text-cf-text">
          Make every video easier to move from draft to published.
        </h2>
        <p className="body-3 max-w-2xl text-cf-muted">
          Create an account with your email or Google, and start a project the moment
          you sign in.
        </p>
        <Link
          href="/signup"
          className="cf-btn cf-btn-primary button-lg"
        >
          Start creating
          <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  </section>
);

export default FinalCTA;
