"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useScroll, useSpring } from "motion/react";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr/ChatCircleDots";
import { Check } from "@phosphor-icons/react/dist/ssr/Check";
import { PaperPlaneTilt } from "@phosphor-icons/react/dist/ssr/PaperPlaneTilt";
import { Sparkle } from "@phosphor-icons/react/dist/ssr/Sparkle";
import { UploadSimple } from "@phosphor-icons/react/dist/ssr/UploadSimple";
import GlowCard from "./GlowCard";

// One video, told as a week. Every beat is something the product does today.
const DAYS = [
  { day: "Monday", Icon: UploadSimple, title: "The cut arrives", text: "Your editor uploads version 1, or pastes an unlisted link. It plays in a streaming preview. No download button, though a screen recording can still copy it.",
    screen: ["Brand reel · version 1", "Processing… ready", "Preview only, no download"] },
  { day: "Tuesday", Icon: ChatCircleDots, title: "You say it where it happens", text: "At 0:12 you type a note. At 0:38 you talk it through. At 1:05 you draw a circle on the frame. Your notes stay drafts until you press Send feedback.",
    screen: ["0:12  Tighten the intro", "0:38  Voice note · transcript", "1:05  Drawing on frame", "3 drafts · Send feedback"] },
  { day: "Wednesday", Icon: Check, title: "Version 2, checked off", text: "Your editor opens a link, no account, and ticks each change done. You put v1 and v2 side by side and see it with your own eyes.",
    screen: ["Checklist: 3 of 3 done", "v1 | v2 side by side", "You are told it is ready"] },
  { day: "Thursday", Icon: Sparkle, title: "Approved. The kit is waiting", text: "You approve version 2. Thumbnails, titles, a description, chapters, tags and captions are drafted for you. You rewrite what you like.",
    screen: ["Approved: version 2", "Thumbnails · titles", "Description · chapters", "Tags · hashtags · SRT"] },
  { day: "Friday", Icon: PaperPlaneTilt, title: "Scheduled, and still cancellable", text: "Pick a time for YouTube or Instagram. Changed your mind on Thursday night? Cancel it before it goes out.",
    screen: ["YouTube · Fri 18:00", "Scheduled", "Cancel any time before release"] },
];

const StoryTimeline: React.FC = () => {
  const list = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: list, offset: ["start 70%", "end 60%"] });
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });

  // The card crossing the middle band of the viewport is the active scene.
  useEffect(() => {
    const items = Array.from(list.current?.children ?? []);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(items.indexOf(e.target))),
      { rootMargin: "-45% 0px -45% 0px" }
    );
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, []);

  const scene = DAYS[active];

  return (
    <section id="how-it-works" className="cf-scroll-offset py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <span className="cf-chip">One video, one week</span>
            <h2 className="cf-section-heading mt-6 text-cf-text">What a review looks like when nothing gets lost</h2>
            <p className="body-3 mt-4 text-cf-muted md:body-1">Scroll through five beats, every one of them something CreatorFlow does today.</p>

            <div className="mt-8 hidden lg:block" aria-hidden="true">
              <div className="cf-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-cf-line px-4 py-3 caption-3 text-cf-muted">
                  <span>{scene.day}</span>
                  <span>Sample project</span>
                </div>
                <AnimatePresence mode="wait">
                  <motion.ul
                    key={scene.day}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    className="flex min-h-[148px] flex-col gap-2 p-4"
                  >
                    {scene.screen.map((row) => (
                      <li key={row} className="rounded border border-cf-line bg-cf-raised px-3 py-2 caption-2 text-cf-text">{row}</li>
                    ))}
                  </motion.ul>
                </AnimatePresence>
              </div>
            </div>
          </div>

          <div className="relative">
            <div aria-hidden="true" className="absolute bottom-0 left-[11px] top-0 w-px bg-cf-line">
              <motion.div className="h-full w-px origin-top bg-cf-violet" style={{ scaleY: fill }} />
            </div>
            <ol ref={list} className="flex flex-col gap-6 pl-10 lg:gap-0">
              {DAYS.map(({ day, Icon, title, text }, i) => (
                <li key={day} className="relative lg:flex lg:min-h-[62vh] lg:items-center">
                  <span
                    aria-hidden="true"
                    className={`absolute -left-[37px] top-6 h-3 w-3 rounded-full border-2 transition-colors duration-300 lg:top-1/2 lg:-translate-y-1/2 ${
                      i <= active ? "border-cf-violet bg-cf-violet" : "border-cf-line bg-cf-bg"
                    }`}
                  />
                  <motion.div
                    className="w-full"
                    initial={false}
                    animate={{ opacity: i === active ? 1 : 0.55, scale: i === active ? 1 : 0.98 }}
                    transition={{ duration: 0.3 }}
                  >
                    <GlowCard accent={i === active}>
                      <div className="flex items-center justify-between">
                        <span className="caption-2 text-cf-violet">{day}</span>
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-cf-line bg-cf-raised text-cf-cyan">
                          <Icon size={18} />
                        </span>
                      </div>
                      <h3 className="title-2 mt-4 text-cf-text">{title}</h3>
                      <p className="body-3 mt-2 text-cf-muted">{text}</p>
                    </GlowCard>
                  </motion.div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
};

export default StoryTimeline;
