import React from "react";
import GlowCard from "./GlowCard";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { CrownSimple } from "@phosphor-icons/react/dist/ssr/CrownSimple";
import { PencilSimple } from "@phosphor-icons/react/dist/ssr/PencilSimple";

const ROLES = [
  {
    Icon: CrownSimple,
    title: "Owner",
    summary: "Decides what goes out and keeps the workspace organised.",
    points: [
      "Approve one exact version of a cut",
      "Publish the approved version",
      "Send feedback in one digest",
      "Get notified when every change is done",
    ],
    accent: "text-cf-violet",
  },
  {
    Icon: PencilSimple,
    title: "Editor",
    summary: "Makes the cut and answers the notes that come back.",
    points: [
      "Open a magic link, no account needed",
      "See notes and a change checklist",
      "Mark each change done",
      "Upload the next version",
    ],
    accent: "text-cf-cyan",
  },
];

const STATUS = [
  { label: "Upload", value: "Version 3 received" },
  { label: "Review", value: "Two notes open" },
  { label: "Approval", value: "Waiting on the owner" },
  { label: "Publish", value: "Not started" },
];

const TeamWorkflow: React.FC = () => (
  <section id="teams" className="cf-scroll-offset py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">For teams</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          One project, three clear roles
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Everyone on a project works from the same video and the same status. Owners
          decide. Editors do the work from a link. Guests can comment.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {ROLES.map(({ Icon, title, summary, points, accent }) => (
          <GlowCard key={title}>
            <span className={`flex h-10 w-10 items-center justify-center rounded-lg border border-cf-line bg-cf-raised ${accent}`}>
              <Icon size={18} />
            </span>
            <h3 className="title-2 mt-4 text-cf-text">{title}</h3>
            <p className="body-3 mt-2 text-cf-muted">{summary}</p>
            <ul className="mt-5 flex flex-col gap-3">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-cf-line ${accent}`}>
                    <Check size={12} />
                  </span>
                  <span className="caption-2 text-cf-muted">{point}</span>
                </li>
              ))}
            </ul>
          </GlowCard>
        ))}
      </div>

      <div className="cf-card mt-6 p-6">
        <div className="caption-2 text-cf-muted">Project status</div>
        <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATUS.map((row) => (
            <li key={row.label} className="rounded border border-cf-line bg-cf-raised px-4 py-3">
              <div className="caption-4 text-cf-muted">{row.label}</div>
              <div className="caption-2 mt-1 text-cf-text">{row.value}</div>
            </li>
          ))}
        </ul>
        <p className="mt-4 caption-3 text-cf-muted">
          Sample status for illustration. Guests with a share link can comment but cannot approve.
        </p>
      </div>
    </div>
  </section>
);

export default TeamWorkflow;
