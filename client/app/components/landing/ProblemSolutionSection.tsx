import React from "react";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { ClockCounterClockwise } from "@phosphor-icons/react/dist/ssr/ClockCounterClockwise";
import { FileText } from "@phosphor-icons/react/dist/ssr/FileText";
import { Folder } from "@phosphor-icons/react/dist/ssr/Folder";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";

const FRAGMENTS = [
  {
    Icon: Folder,
    problem: "Video files scattered across folders",
    solution: "Every file belongs to a project, next to the video it supports.",
  },
  {
    Icon: ChatCircleDots,
    problem: "Feedback spread across chats",
    solution: "Comments sit on the video, so nothing gets lost in a thread.",
  },
  {
    Icon: ClockCounterClockwise,
    problem: "Editors unsure which revision is current",
    solution: "Each upload is a numbered version and the current cut is marked.",
  },
  {
    Icon: Check,
    problem: "Approval buried in conversations",
    solution: "Approval is a recorded decision on one exact version.",
  },
  {
    Icon: FileText,
    problem: "Publishing details prepared separately",
    solution: "Titles, descriptions and chapters travel with the approved video.",
  },
];

const ProblemSolutionSection: React.FC = () => (
  <section className="py-24 md:py-32">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="cf-measure">
        <span className="cf-chip">The problem</span>
        <h2 className="cf-section-heading mt-6 text-cf-text">
          Video work breaks apart between the tools you use
        </h2>
        <p className="body-3 mt-4 text-cf-muted md:body-1">
          Every stage of a production moves somewhere else, so the team spends its time
          searching instead of making.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2">
        <div className="cf-card p-6">
          <h3 className="title-3 text-cf-text">Where the work fragments</h3>
          <ul className="mt-4 flex flex-col gap-4">
            {FRAGMENTS.map(({ Icon, problem }) => (
              <li key={problem} className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-cf-line bg-cf-raised text-cf-muted">
                  <Icon size={16} />
                </span>
                <span className="body-3 text-cf-muted">{problem}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="cf-card border-cf-violet/40 p-6">
          <h3 className="title-3 text-cf-text">One project workspace in CreatorFlow</h3>
          <ul className="mt-4 flex flex-col gap-4">
            {FRAGMENTS.map(({ Icon, solution }) => (
              <li key={solution} className="flex items-start gap-3">
                <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded border border-cf-violet/40 bg-cf-raised text-cf-violet">
                  <Icon size={16} />
                </span>
                <span className="body-3 text-cf-text">{solution}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex items-center gap-2 caption-3 text-cf-muted">
            <PaperPlaneTilt size={14} />
            <span>Planned workspace behaviour. The build is in progress.</span>
          </p>
        </div>
      </div>
    </div>
  </section>
);

export default ProblemSolutionSection;
