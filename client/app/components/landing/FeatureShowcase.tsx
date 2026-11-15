import React, { ReactNode } from "react";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ImageSquare } from "@phosphor-icons/react/dist/ssr/ImageSquare";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { YoutubeLogo } from "@phosphor-icons/react/dist/ssr/YoutubeLogo";

type Feature = {
  index: string;
  Icon: React.ElementType;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
};

const REVIEW_NOTES = [
  { time: "00:12", text: "Tighten the cold open, the hook lands late.", state: "Open" },
  { time: "00:38", text: "Keep this framing for the product shot.", state: "Resolved" },
  { time: "01:05", text: "Lower the music under the voice over.", state: "Open" },
];

const AI_OUTPUT = [
  { label: "Transcript", value: "Generated from the uploaded cut" },
  { label: "Captions", value: "English, timestamps included" },
  { label: "Translation", value: "Spanish, German, French" },
  { label: "Chapters", value: "Three markers placed on the timeline" },
];

const THUMBNAILS = [
  { label: "Concept A", headline: "The fix nobody talks about", tone: "bg-cf-violet" },
  { label: "Concept B", headline: "Three mistakes, one workflow", tone: "bg-cf-cyan" },
  { label: "Concept C", headline: "Ship the cut, not the file", tone: "bg-cf-overlay" },
];

const PUBLISH_ROWS = [
  { label: "Upload", value: "Version 4, approved by the owner" },
  { label: "Title", value: "Product launch trailer" },
  { label: "Description", value: "Drafted, waiting for the final edit" },
  { label: "Chapters", value: "Three markers" },
];

const FEATURES: Feature[] = [
  {
    index: "Feature 01",
    Icon: ChatCircleDots,
    title: "Review Studio",
    body:
      "Feedback lands on the frame it talks about. The editor sees the note, the timestamp and the request together, and answers it without leaving the video.",
    points: [
      "Notes carry their own timestamp",
      "Every note has an open or resolved state",
      "The version a note refers to never changes",
    ],
    visual: (
      <div className="cf-card p-6">
        <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
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
      </div>
    ),
  },
  {
    index: "Feature 02",
    Icon: Sparkle,
    title: "AI Creator Studio",
    body:
      "The AI tools read the cut you uploaded. They hand back a transcript, captions, a translation, chapter markers and title and description drafts that you edit before anything is applied.",
    points: [
      "Outputs come from your video, not a blank prompt",
      "Every result is a draft you can change",
      "Nothing is applied to the project without you",
    ],
    visual: (
      <div className="cf-card p-6">
        <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-cyan">
          <Sparkle size={16} />
          <span>Generated from trailer cut v1</span>
        </div>
        <ul className="mt-4 flex flex-col gap-3">
          {AI_OUTPUT.map((row) => (
            <li key={row.label} className="flex items-start justify-between gap-4">
              <span className="caption-2 text-cf-text">{row.label}</span>
              <span className="caption-3 text-right text-cf-muted">{row.value}</span>
            </li>
          ))}
        </ul>
      </div>
    ),
  },
  {
    index: "Feature 03",
    Icon: ImageSquare,
    title: "Thumbnail Studio",
    body:
      "Thumbnail concepts are generated from the video itself, so the frame and the headline come from the same material. Pick a concept, refine the text, export the frame.",
    points: [
      "Concepts are built from frames in your video",
      "Three directions side by side",
      "Export at the resolution YouTube expects",
    ],
    visual: (
      <div className="cf-card p-6">
        <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
          <ImageSquare size={16} />
          <span>Thumbnail concepts</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {THUMBNAILS.map((thumb) => (
            <div key={thumb.label} className="flex flex-col gap-2">
              <div
                className={`flex aspect-video items-end rounded p-2 ${thumb.tone}`}
                aria-hidden="true"
              >
                <span className="caption-4 text-white">{thumb.headline}</span>
              </div>
              <span className="caption-4 text-cf-muted">{thumb.label}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    index: "Feature 04",
    Icon: PaperPlaneTilt,
    title: "YouTube Publishing",
    body:
      "Publishing sends the approved version with the metadata that was confirmed next to it. The version that was approved is the version that goes out.",
    points: [
      "Only an approved version can be published",
      "Metadata is confirmed before the upload",
      "The channel connection stays in your account",
    ],
    visual: (
      <div className="cf-card p-6">
        <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
          <YoutubeLogo size={16} />
          <span>Publishing package</span>
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
      </div>
    ),
  },
];

const FeatureShowcase: React.FC = () => (
  <section id="features" className="cf-scroll-offset bg-cf-surface py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">In detail</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          Four studios that share one project
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Each studio works on the same video, the same versions and the same notes.
          Nothing has to be exported and re-imported to move to the next step.
        </p>
      </div>

      <div className="mt-16 flex flex-col gap-20">
        {FEATURES.map((feature, index) => (
          <article key={feature.title} className="grid items-center gap-10 md:grid-cols-2">
            <div className={index % 2 === 1 ? "md:order-2" : undefined}>
              <span className="caption-2 text-cf-violet">{feature.index}</span>
              <h3 className="title-1 mt-2 flex items-center gap-2 text-cf-text">
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
              <span className="cf-chip mt-6 inline-flex">Planned</span>
            </div>
            <div className={index % 2 === 1 ? "md:order-1" : undefined}>{feature.visual}</div>
          </article>
        ))}
      </div>
    </div>
  </section>
);

export default FeatureShowcase;
