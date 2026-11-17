import React, { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";
import GlowCard from "./GlowCard";

type Feature = {
  Icon: React.ElementType;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
};

const REVIEW_NOTES = [
  { time: "00:12", text: "Tighten the cold open, the hook lands late.", state: "Open" },
  { time: "00:38", text: "Voice note, 0:09: “Keep this framing for the product shot.”", state: "Done" },
  { time: "01:05", text: "Drawing on frame: move the logo out of the corner.", state: "Open" },
];

const CHECKLIST = [
  { label: "Cut the intro to five seconds", done: true },
  { label: "Add captions at the bottom", done: true },
  { label: "Lower the music under the voice", done: false },
];

const KIT_OUTPUT = [
  { label: "Thumbnails", value: "Best frames, text on top" },
  { label: "Titles", value: "Several options, you choose" },
  { label: "Description", value: "With chapters from the transcript" },
  { label: "Tags and hashtags", value: "Editable" },
  { label: "Captions", value: "SRT file" },
];

const PUBLISH_ROWS = [
  { label: "Upload", value: "Version 4, approved by the owner" },
  { label: "Where", value: "YouTube or Instagram" },
  { label: "When", value: "Now, or scheduled" },
  { label: "Changed your mind", value: "Cancel before it goes out" },
];

const head = "flex items-center gap-2 border-b border-cf-line pb-4 caption-2";

const FEATURES: Feature[] = [
  {
    Icon: ChatCircleDots,
    title: "Review on the timeline",
    body:
      "Notes land on the second they talk about, in whichever way is quickest: type it, say it, or draw on the frame. Voice notes get a written transcript so nothing is lost on mute.",
    points: [
      "Text, voice and drawn notes on exact timestamps",
      "Owner notes stay private drafts until you press Send feedback",
      "One digest email to the editor, not forty pings",
    ],
    visual: (
      <GlowCard>
        <div className={`${head} text-cf-muted`}>
          <ChatCircleDots size={16} />
          <span>Review notes on version 4</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {REVIEW_NOTES.map((note) => (
            <li key={note.time} className="rounded border border-cf-line bg-cf-raised px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="caption-3 text-cf-violet">{note.time}</span>
                <span className="caption-4 text-cf-muted">{note.state}</span>
              </div>
              <p className="mt-1 caption-2 text-cf-text">{note.text}</p>
            </li>
          ))}
        </ul>
      </GlowCard>
    ),
  },
  {
    Icon: Check,
    title: "Versions, compare, checklist",
    body:
      "Each new cut is a numbered version. Put two versions next to each other with shared play and one scrubber, and watch the editor tick the requested changes off as they go.",
    points: [
      "Side-by-side compare of any two processed uploads",
      "Editors mark each change done from their link",
      "You are told when every change is done",
    ],
    visual: (
      <GlowCard>
        <div className={`${head} text-cf-muted`}>
          <Check size={16} />
          <span>Change checklist, 2 of 3 done</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {CHECKLIST.map((row) => (
            <li key={row.label} className="flex items-center gap-3">
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                  row.done ? "border-green-400/60 bg-green-400/20 text-green-300" : "border-cf-line text-transparent"
                }`}
              >
                <Check size={12} />
              </span>
              <span className={`caption-2 ${row.done ? "text-cf-muted line-through" : "text-cf-text"}`}>{row.label}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-cf-line">
          <div className="h-full w-2/3 rounded-full bg-green-400" />
        </div>
      </GlowCard>
    ),
  },
  {
    Icon: Sparkle,
    title: "AI publish kit",
    body:
      "Approve a version and CreatorFlow starts drafting from the transcript and the video frames. Everything is a draft you edit. It is a starting point and promises nothing about views.",
    points: [
      "Thumbnails built from the best frames",
      "Titles, description, chapters, tags, hashtags and SRT captions",
      "Every field stays editable before anything is published",
    ],
    visual: (
      <GlowCard>
        <div className={`${head} text-cf-cyan`}>
          <Sparkle size={16} />
          <span>Drafted after approval</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {KIT_OUTPUT.map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-4">
              <span className="caption-2 text-cf-text">{row.label}</span>
              <span className="caption-3 text-right text-cf-muted">{row.value}</span>
            </li>
          ))}
        </ul>
      </GlowCard>
    ),
  },
  {
    Icon: PaperPlaneTilt,
    title: "Publish or schedule",
    body:
      "Connect your YouTube channel or Instagram account, pick a time, and the approved version goes out with the kit you edited. Cancel a scheduled post any time before release.",
    points: [
      "Only an approved version can be published",
      "YouTube and Instagram, now or scheduled",
      "Your channel connection stays in your account",
    ],
    visual: (
      <GlowCard>
        <div className={`${head} text-cf-muted`}>
          <YoutubeLogo size={16} />
          <span>Publishing</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {PUBLISH_ROWS.map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-4">
              <span className="caption-2 text-cf-muted">{row.label}</span>
              <span className="caption-3 text-right text-cf-text">{row.value}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex items-center gap-2 rounded border border-dashed border-cf-line px-4 py-3 caption-3 text-cf-muted">
          <YoutubeLogo size={14} />
          <span>Connect a channel to publish</span>
        </div>
      </GlowCard>
    ),
  },
];

const FeatureShowcase: React.FC = () => (
  <section id="features" className="cf-scroll-offset bg-cf-surface py-16 md:py-24">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <h2 className="cf-section-heading text-cf-text">
          Four steps that share one project
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Review, versions, AI kit and publishing work on the same video, the same
          versions and the same notes. Nothing is exported and re-imported.
        </p>
      </div>

      <div className="mt-16 flex flex-col gap-20">
        {FEATURES.map((feature, index) => (
          <article key={feature.title} className="grid items-center gap-10 md:grid-cols-2">
            <div className={index % 2 === 1 ? "md:order-2" : undefined}>
              <h3 className="title-1 flex items-center gap-2 text-cf-text">
                <feature.Icon size={20} />
                {feature.title}
              </h3>
              <p className="body-3 mt-3 text-cf-muted">{feature.body}</p>
              <ul className="mt-6 flex flex-col gap-3">
                {feature.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cf-line text-cf-cyan">
                      <Check size={12} />
                    </span>
                    <span className="body-3 text-cf-muted">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className={index % 2 === 1 ? "md:order-1" : undefined}>{feature.visual}</div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureShowcase;
