"use client";

import dynamic from "next/dynamic";
import React from "react";

// WebGL is loaded after first paint and never on the server. Reduced motion freezes it (React Bits Aurora).
const Aurora = dynamic(() => import("../reactbits/Aurora"), { ssr: false });

/** Soft violet/cyan aurora behind the hero. Decorative: hidden from assistive tech, ignores the pointer. */
const HeroBackground: React.FC = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 -z-10 [mask-image:linear-gradient(to_bottom,#000_55%,transparent)]"
  >
    <Aurora colorStops={["#7c5cff", "#22d3ee", "#4c2fd1"]} amplitude={1} blend={0.6} speed={0.6} opacity={0.3} dpr={1} />
  </div>
);

export default HeroBackground;
