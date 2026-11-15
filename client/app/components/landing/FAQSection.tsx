import React from "react";
import { CaretDown } from "@phosphor-icons/react/dist/ssr/CaretDown";
import { FAQS } from "./faqs";

const FAQSection: React.FC = () => (
  <section id="faq" className="cf-scroll-offset py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">FAQ</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          Questions people ask before they start
        </h2>
      </div>

      <div className="mt-12 flex flex-col gap-4">
        {FAQS.map(({ question, answer }) => (
          <details key={question} className="group cf-card px-6 py-5">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 title-3 text-cf-text marker:hidden">
              <span>{question}</span>
              <CaretDown
                size={18}
                className="shrink-0 text-cf-muted transition-transform duration-500 group-open:rotate-180"
                style={{ transitionTimingFunction: "var(--cf-ease)" }}
              />
            </summary>
            <p className="body-3 mt-3 max-w-3xl text-cf-muted">{answer}</p>
          </details>
        ))}
      </div>
    </div>
  </section>
);

export default FAQSection;
