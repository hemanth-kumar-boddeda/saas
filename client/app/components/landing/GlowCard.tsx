"use client";

import React from "react";
import SpotlightCard from "../reactbits/SpotlightCard";

/** React Bits SpotlightCard in the CreatorFlow card colours. Cursor-follow glow, off for reduced motion. */
const GlowCard: React.FC<React.ComponentProps<"div"> & { accent?: boolean }> = ({ className = "", accent, style, ...rest }) => (
  <SpotlightCard
    spotlightColor="#7c5cff"
    intensity={0.22}
    className={`!rounded-2xl !p-6 ${className}`}
    style={{ "--spotlight-card-surface": "#181818", "--spotlight-card-border": accent ? "rgba(124,92,255,0.45)" : "#313131", ...style } as React.CSSProperties}
    {...rest}
  />
);

export default GlowCard;
