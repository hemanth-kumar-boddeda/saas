import React from "react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import GlowCard from "./GlowCard";

// One video, told as a week. Every beat is something the product does today.
const DAYS = [
  { day: "Monday", Icon: UploadSimple, title: "The cut arrives", text: "Your editor uploads version 1, or pastes an unlisted link. It plays in a streaming preview. No download button, though a screen recording can still copy it." },
  { day: "Tuesday", Icon: ChatCircleDots, title: "You say it where it happens", text: "At 0:12 you type a note. At 0:38 you talk it through. At 1:05 you draw a circle on the frame. Your notes stay drafts until you press Send feedback." },
  { day: "Wednesday", Icon: Check, title: "Version 2, checked off", text: "Your editor opens a link, no account, and ticks each change done. You put v1 and v2 side by side and see it with your own eyes." },
  { day: "Thursday", Icon: Sparkle, title: "Approved. The kit is waiting", text: "You approve version 2. Thumbnails, titles, a description, chapters, tags and captions are drafted for you. You rewrite what you like." },
  { day: "Friday", Icon: PaperPlaneTilt, title: "Scheduled, and still cancellable", text: "Pick a time for YouTube or Instagram. Changed your mind on Thursday night? Cancel it before it goes out." },
];

const StoryTimeline: React.FC = () => (
  <section id="how-it-works" className="cf-scroll-offset py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">One video, one week</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          What a review looks like when nothing gets lost
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Five beats, every one of them something CreatorFlow does today.
        </p>
      </div>

      <ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {DAYS.map(({ day, Icon, title, text }, i) => (
          <li key={day} className={i === DAYS.length - 1 ? "md:col-span-2 lg:col-span-1" : undefined}>
            <GlowCard className="h-full" accent={i === 3}>
              <div className="flex items-center justify-between">
                <span className="caption-2 text-cf-violet">{day}</span>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cf-line bg-cf-raised text-cf-cyan">
                  <Icon size={18} />
                </span>
              </div>
              <h3 className="title-2 mt-4 text-cf-text">{title}</h3>
              <p className="body-3 mt-2 text-cf-muted">{text}</p>
            </GlowCard>
          </li>
        ))}
      </ol>
    </div>
  </section>
);

export default StoryTimeline;
