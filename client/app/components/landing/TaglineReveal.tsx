"use client";

import React, { useEffect, useRef } from "react";

const LINES = [
  "Good videos take a team.",
  "Great workflows keep that team moving.",
];

const TaglineReveal: React.FC = () => {
  const wordRefs = useRef<(HTMLSpanElement | null)[]>([]);

  useEffect(() => {
    const words = wordRefs.current.filter(Boolean) as HTMLSpanElement[];

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      words.forEach((word) => word.classList.add("cf-word-on"));
      return;
    }

    // The trigger band sits across the middle of the viewport, so words
    // brighten one at a time as they cross it.
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("cf-word-on");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    words.forEach((word) => observer.observe(word));
    return () => observer.disconnect();
  }, []);

  let wordIndex = 0;

  return (
    <section className="border-y border-cf-line bg-cf-surface py-24 md:py-32">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        {LINES.map((line) => (
          <p key={line} className="cf-tagline cf-measure text-cf-text">
            {line.split(" ").map((word) => {
              const index = wordIndex;
              wordIndex += 1;
              return (
                <span
                  key={`${line}-${index}`}
                  ref={(node) => {
                    wordRefs.current[index] = node;
                  }}
                  className="cf-word mr-2 inline-block"
                >
                  {word}
                </span>
              );
            })}
          </p>
        ))}
      </div>
    </section>
  );
};

export default TaglineReveal;
