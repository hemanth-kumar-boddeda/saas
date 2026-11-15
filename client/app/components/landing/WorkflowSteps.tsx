import React from "react";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { Play } from "@phosphor-icons/react/dist/ssr/Play";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";

const STEP_UPLOAD = [
  { name: "Trailer cut v1.mp4", meta: "2.1 GB, uploaded" },
  { name: "Brand kit.pdf", meta: "Reference" },
  { name: "Music bed.wav", meta: "Audio" },
];

const STEP_REVIEW = [
  { time: "00:12", text: "Tighten the cold open.", selected: true },
  { time: "00:38", text: "Keep this framing.", selected: false },
  { time: "01:05", text: "Music sits too high.", selected: false },
];

const STEP_PUBLISH = [
  { label: "Approved version", value: "Version 4" },
  { label: "Visibility", value: "Public" },
  { label: "Chapters", value: "3 markers" },
];

const WorkflowSteps: React.FC = () => (
  <section id="how-it-works" className="cf-scroll-offset py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">How it works</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          Three steps from raw footage to a published video
        </h2>
      </div>

      <ol className="mt-12 flex flex-col gap-16">
        <li className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="caption-2 text-cf-violet">Step 1</span>
            <h3 className="title-1 mt-2 text-cf-text">Upload and organize</h3>
            <p className="body-3 mt-3 text-cf-muted">
              Files land in the project they belong to. Every upload becomes a numbered
              version, so the team always knows which cut is current.
            </p>
          </div>
          <div className="cf-card p-6">
            <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
              <UploadSimple size={16} />
              <span>Project files</span>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {STEP_UPLOAD.map((file) => (
                <li key={file.name} className="flex items-center justify-between gap-4">
                  <span className="truncate caption-2 text-cf-text">{file.name}</span>
                  <span className="shrink-0 caption-4 text-cf-muted">{file.meta}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 rounded border border-dashed border-cf-line px-4 py-3 text-center caption-3 text-cf-muted">
              Drop files here to add them to the project
            </div>
          </div>
        </li>

        <li className="grid items-center gap-8 md:grid-cols-2">
          <div className="md:order-2">
            <span className="caption-2 text-cf-violet">Step 2</span>
            <h3 className="title-1 mt-2 text-cf-text">Review and refine</h3>
            <p className="body-3 mt-3 text-cf-muted">
              Feedback is attached to the moment it refers to. The editor answers each
              note and uploads the next version without anyone chasing a thread.
            </p>
          </div>
          <div className="cf-card p-6 md:order-1">
            <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
              <Play size={16} />
              <span>Review session</span>
            </div>
            <div className="mt-4 flex flex-col gap-3">
              {STEP_REVIEW.map((comment) => (
                <div
                  key={comment.time}
                  className={`flex gap-3 rounded border px-3 py-2 ${
                    comment.selected
                      ? "border-cf-violet bg-cf-raised"
                      : "border-cf-line bg-cf-surface"
                  }`}
                >
                  <span
                    className={`caption-3 ${
                      comment.selected ? "text-cf-violet" : "text-cf-muted"
                    }`}
                  >
                    {comment.time}
                  </span>
                  <span className="caption-2 text-cf-text">{comment.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 h-1 w-full rounded-full bg-cf-line">
              <div className="h-1 w-1/3 rounded-full bg-cf-violet" />
            </div>
          </div>
        </li>

        <li className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <span className="caption-2 text-cf-violet">Step 3</span>
            <h3 className="title-1 mt-2 text-cf-text">Approve and publish</h3>
            <p className="body-3 mt-3 text-cf-muted">
              The owner approves one exact version. Only that version can be published,
              with the metadata confirmed alongside it.
            </p>
          </div>
          <div className="cf-card p-6">
            <div className="flex items-center gap-2 border-b border-cf-line pb-4 caption-2 text-cf-muted">
              <Check size={16} />
              <span>Publish confirmation</span>
            </div>
            <ul className="mt-4 flex flex-col gap-3">
              {STEP_PUBLISH.map((row) => (
                <li key={row.label} className="flex items-center justify-between gap-4">
                  <span className="caption-2 text-cf-muted">{row.label}</span>
                  <span className="caption-2 text-cf-text">{row.value}</span>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex items-center gap-2 rounded border border-cf-violet/40 bg-cf-raised px-4 py-3">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-cf-violet text-white">
                <Check size={14} />
              </span>
              <span className="caption-2 text-cf-text">Ready to publish version 4</span>
            </div>
          </div>
        </li>
      </ol>
    </div>
  </section>
);

export default WorkflowSteps;
