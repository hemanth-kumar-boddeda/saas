import React from "react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder";
import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { Stack } from "@phosphor-icons/react/dist/ssr/Stack";

const SIDEBAR = [
  { label: "Workspace", Icon: Folder, accent: false },
  { label: "Projects", Icon: Stack, accent: false },
  { label: "Review", Icon: ChatCircleDots, accent: false },
  { label: "Versions", Icon: ClockCounterClockwise, accent: false },
  { label: "AI Studio", Icon: Sparkle, accent: true },
  { label: "Publishing", Icon: PaperPlaneTilt, accent: false },
];

const COMMENTS = [
  {
    time: "00:12",
    text: "Cold open needs a tighter hook before the title card.",
    active: true,
  },
  { time: "00:38", text: "Voice note 0:09 · “Keep this framing.”", active: false },
  { time: "01:05", text: "Drawing on frame · logo out of the corner.", active: false },
];

const VERSIONS = [
  { label: "Version 1", note: "First upload", current: false },
  { label: "Version 2", note: "Notes applied", current: false },
  { label: "Version 3", note: "Sound mix", current: false },
  { label: "Version 4", note: "Current cut", current: true },
];

type Props = {
  /** Compact drops the sidebar and the side panels so the mockup can sit in the hero. */
  compact?: boolean;
};

const ProductPreview: React.FC<Props> = ({ compact = false }) => {
  const comments = compact ? COMMENTS.slice(0, 2) : COMMENTS;
  const versions = compact ? VERSIONS.slice(1, 4) : VERSIONS;

  return (
    <figure className="cf-card overflow-hidden">
      <figcaption className="flex items-center justify-between gap-4 border-b border-cf-line px-4 py-3">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cf-line" />
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cf-line" />
          <span aria-hidden="true" className="h-2 w-2 rounded-full bg-cf-line" />
          <span className="caption-3 text-cf-muted">CreatorFlow demo workspace</span>
        </div>
        <span className="cf-chip">Sample project</span>
      </figcaption>

      <div className={`grid ${compact ? "" : "md:grid-cols-[180px_1fr]"}`}>
        {!compact && (
          <aside className="hidden flex-col gap-1 border-r border-cf-line bg-cf-raised p-4 md:flex">
            {SIDEBAR.map(({ label, Icon, accent }) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded px-2 py-2 caption-2 ${
                  accent ? "text-cf-cyan" : "text-cf-muted"
                }`}
              >
                <Icon size={16} />
                <span>{label}</span>
              </div>
            ))}
          </aside>
        )}

        <div className="p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="title-2 text-cf-text">Product launch trailer</h3>
              <p className="caption-3 text-cf-muted">Demo project for a sample channel</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="cf-chip">In review</span>
              <span className="cf-chip border-cf-violet text-cf-violet">Version 4 of 5</span>
            </div>
          </div>

          <div className={`mt-6 grid gap-6 ${compact ? "" : "lg:grid-cols-[1.35fr_1fr]"}`}>
            <div>
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-cf-overlay">
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-cf-violet text-white">
                    <Play size={20} weight="fill" />
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
                  <div className="h-1 w-full rounded-full bg-cf-line">
                    <div className="h-1 w-2/5 rounded-full bg-cf-violet" />
                  </div>
                  <div className="mt-2 flex items-center justify-between caption-4 text-cf-muted">
                    <span>00:52</span>
                    <span>02:14</span>
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-center gap-2 caption-2 text-cf-muted">
                  <ChatCircleDots size={16} />
                  <span>Timestamped feedback</span>
                </div>
                <ul className="mt-2 flex flex-col gap-2">
                  {comments.map((comment) => (
                    <li
                      key={comment.time}
                      className={`flex gap-3 rounded border px-3 py-2 ${
                        comment.active
                          ? "border-cf-violet bg-cf-raised"
                          : "border-cf-line bg-cf-surface"
                      }`}
                    >
                      <span
                        className={`caption-3 ${
                          comment.active ? "text-cf-violet" : "text-cf-muted"
                        }`}
                      >
                        {comment.time}
                      </span>
                      <span className="caption-2 text-cf-text">{comment.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {!compact && (
              <div className="flex flex-col gap-4">
                <div className="rounded border border-cf-line bg-cf-raised p-4">
                  <div className="flex items-center gap-2 caption-2 text-cf-muted">
                    <ClockCounterClockwise size={16} />
                    <span>Version history</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-2">
                    {versions.map((version) => (
                      <li key={version.label} className="flex items-center justify-between gap-2">
                        <span className="caption-2 text-cf-text">{version.label}</span>
                        <span
                          className={`caption-4 ${
                            version.current ? "text-cf-violet" : "text-cf-muted"
                          }`}
                        >
                          {version.note}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="rounded border border-cf-line bg-cf-raised p-4">
                  <div className="caption-2 text-cf-muted">Owner approval</div>
                  <p className="mt-1 caption-2 text-cf-text">
                    Pending for version 4. Approval locks the exact version that can be
                    published.
                  </p>
                </div>

                <div className="rounded border border-cf-cyan/40 bg-cf-raised p-4">
                  <div className="flex items-center gap-2 caption-2 text-cf-cyan">
                    <Sparkle size={16} />
                    <span>AI publishing package</span>
                  </div>
                  <ul className="mt-2 flex flex-col gap-1 caption-3 text-cf-muted">
                    <li>Thumbnails and title options</li>
                    <li>Description and chapters</li>
                    <li>Tags, hashtags, SRT captions</li>
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
};

export default ProductPreview;
