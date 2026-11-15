import React from "react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";

const BENEFITS = [
  {
    Icon: ChatCircleDots,
    title: "Review with context",
    body: "Leave feedback tied to the exact moment in the video, so every note points at the frame it refers to.",
  },
  {
    Icon: ClockCounterClockwise,
    title: "Keep revisions organized",
    body: "Track immutable versions and see exactly what changed between the cut you sent and the cut you approved.",
  },
  {
    Icon: Sparkle,
    title: "Create with AI",
    body: "Generate transcripts, captions, translations, titles, descriptions, chapters and thumbnail concepts from the video itself.",
  },
  {
    Icon: Users,
    title: "Collaborate clearly",
    body: "Give owners and editors one shared workflow, with clear responsibilities and a visible status for every project.",
  },
  {
    Icon: PaperPlaneTilt,
    title: "Publish with confidence",
    body: "Publish the exact approved version with confirmed metadata through the YouTube connection.",
  },
];

const BenefitsSection: React.FC = () => (
  <section className="bg-cf-surface py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">Benefits</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          A workflow that keeps context from upload to publish
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Accounts, the video marketplace and payments are live today. The workspace
          features below are the planned CreatorFlow product and are still in
          development.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map(({ Icon, title, body }) => (
          <article key={title} className="cf-card cf-card-hover flex flex-col p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cf-line bg-cf-raised text-cf-violet">
              <Icon size={18} />
            </span>
            <h3 className="title-2 mt-4 text-cf-text">{title}</h3>
            <p className="body-3 mt-2 text-cf-muted">{body}</p>
            <span className="cf-chip mt-6 self-start">Planned</span>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default BenefitsSection;
