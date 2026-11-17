"use client";

import React, { FC, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Dock from "../Dock";

const SECTIONS = [
  { label: "Story", id: "how-it-works" },
  { label: "Features", id: "features" },
  { label: "Teams", id: "teams" },
  { label: "FAQ", id: "faq" },
];

/** Landing and legal pages: scroll-spy dock. On other pages the tabs link back to the home sections. */
const MarketingNavbar: FC = () => {
  const home = usePathname() === "/";
  const [active, setActive] = useState("");

  useEffect(() => {
    if (!home) return;
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-40% 0px -50% 0px" }
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [home]);

  return (
    <Dock
      brand={{ label: "CF", href: "/", aria: "CreatorFlow home" }}
      tabs={SECTIONS.map((s) => ({ label: s.label, href: `${home ? "" : "/"}#${s.id}`, active: home && active === s.id }))}
      note="Editors need no account. Nothing posts without your approval."
      menu={[
        { label: "Start", meta: "01", href: "/signup" },
        { label: "Sign in", meta: "02", href: "/login" },
        { label: "About", meta: "03", href: "/about" },
      ]}
    />
  );
};

export default MarketingNavbar;
