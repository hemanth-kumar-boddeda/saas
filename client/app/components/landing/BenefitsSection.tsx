import React from "react";
import GlowCard from "./GlowCard";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Users } from "@phosphor-icons/react/dist/ssr/Users";

const BENEFITS = [
  {
    Icon: ChatCircleDots,
    title: "Review with context",
    body: "Pin a note to the exact second as text, as a voice note (with a written transcript), or as a drawing on the frame.",
  },
  {
    Icon: ClockCounterClockwise,
    title: "Keep revisions organized",
    body: "Every upload is a numbered version. Compare two versions side by side and tick off each requested change.",
  },
  {
    Icon: Sparkle,
    title: "Draft the publish kit",
    body: "After approval, AI drafts thumbnails, title options, a description, chapters, tags, hashtags and an SRT file from your video. You edit all of it.",
  },
  {
    Icon: Users,
    title: "Collaborate clearly",
    body: "Owners decide. Editors open a link, no account needed, and see a checklist of what to change.",
  },
  {
    Icon: PaperPlaneTilt,
    title: "Publish or schedule",
    body: "Send the approved cut to YouTube or Instagram now or later, and cancel a scheduled post before it goes out.",
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
          Everything below is in the product today. Publishing needs you to connect
          your own YouTube or Instagram account first.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {BENEFITS.map(({ Icon, title, body }) => (
          <GlowCard key={title} className="flex flex-col">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-cf-line bg-cf-raised text-cf-violet">
              <Icon size={18} />
            </span>
            <h3 className="title-2 mt-4 text-cf-text">{title}</h3>
            <p className="body-3 mt-2 text-cf-muted">{body}</p>
          </GlowCard>
        ))}
      </div>
    </div>
  </section>
);

export default BenefitsSection;
