import type { Metadata } from "next";
import MarketingNavbar from "./components/landing/MarketingNavbar";
import HeroSection from "./components/landing/HeroSection";
import ProductShowcase from "./components/landing/ProductShowcase";
import OrbitSection from "./components/landing/OrbitSection";
import TaglineReveal from "./components/landing/TaglineReveal";
import ProblemSolutionSection from "./components/landing/ProblemSolutionSection";
import BenefitsSection from "./components/landing/BenefitsSection";
import StoryTimeline from "./components/landing/StoryTimeline";
import FeatureShowcase from "./components/landing/FeatureShowcase";
import TeamWorkflow from "./components/landing/TeamWorkflow";
import FAQSection from "./components/landing/FAQSection";
import FinalCTA from "./components/landing/FinalCTA";
import MarketingFooter from "./components/landing/MarketingFooter";
import { FAQS } from "./components/landing/faqs";

export const metadata: Metadata = {
  title: "CreatorFlow, review, approve and publish videos together",
  description:
    "Review videos with timestamped text, voice and drawn notes, compare versions, approve, and publish or schedule to YouTube and Instagram from one workspace.",
};

const FAQ_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

const APP_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CreatorFlow",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "A workspace where creators and editors review videos with timestamped notes, compare versions, approve, and publish or schedule to YouTube and Instagram.",
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_JSON_LD) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(APP_JSON_LD) }}
      />

      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded focus:bg-cf-surface focus:px-4 focus:py-2 focus:caption-2 focus:text-cf-text"
      >
        Skip to content
      </a>

      <div className="cf-root min-h-screen bg-cf-bg font-cf text-cf-text">
        <MarketingNavbar />

        <main id="main">
          <HeroSection />
          <ProductShowcase />
          <OrbitSection />
          <TaglineReveal />
          <ProblemSolutionSection />
          <BenefitsSection />
          <StoryTimeline />
          <FeatureShowcase />
          <TeamWorkflow />
          <FAQSection />
          <FinalCTA />
        </main>

        <MarketingFooter />
        <div className="h-20" aria-hidden="true" />
      </div>
    </>
  );
}
