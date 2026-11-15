"use client";

import Link from "next/link";
import React, { FC, useEffect, useState } from "react";

const NAV_LINKS = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#how-it-works" },
  { label: "For teams", href: "#teams" },
  { label: "FAQ", href: "#faq" },
];

const MarketingNavbar: FC = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div className="mx-auto max-w-6xl px-4 pt-4 md:px-8">
        <nav
          aria-label="Primary"
          className={`flex items-center justify-between rounded-full border border-cf-line px-3 py-2 backdrop-blur transition-colors duration-300 ${
            scrolled ? "bg-cf-surface/95" : "bg-cf-surface/70"
          }`}
        >
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full px-2 py-1"
            aria-label="CreatorFlow home"
          >
            <span aria-hidden="true" className="block h-6 w-6 rounded-md bg-cf-violet" />
            <span className="title-3 text-cf-text">CreatorFlow</span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-2 body-3 text-cf-muted transition-colors duration-300 hover:text-cf-text"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/login"
              className="rounded-full px-4 py-2 body-3 text-cf-muted transition-colors duration-300 hover:text-cf-text"
            >
              Sign in
            </Link>
            <Link href="/signup" className="cf-btn cf-btn-primary cf-btn-sm button-md">
              Start creating
            </Link>
          </div>

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="cf-mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            className={`flex h-9 w-9 items-center justify-center rounded-full border border-cf-line text-cf-text transition-colors duration-300 hover:border-cf-violet md:hidden ${
              open ? "cf-toggle-open" : ""
            }`}
          >
            <span aria-hidden="true" className="relative block h-3 w-4">
              <span className="cf-toggle-bar cf-toggle-top absolute left-0 top-0 block h-0.5 w-4 rounded-full bg-current" />
              <span className="cf-toggle-bar cf-toggle-mid absolute left-0 top-[5px] block h-0.5 w-4 rounded-full bg-current" />
              <span className="cf-toggle-bar cf-toggle-bottom absolute left-0 top-[10px] block h-0.5 w-4 rounded-full bg-current" />
            </span>
          </button>
        </nav>
      </div>

      {open && (
        <div
          id="cf-mobile-menu"
          className="fixed inset-0 z-40 flex flex-col bg-cf-bg/95 backdrop-blur-xl md:hidden"
        >
          <div aria-hidden="true" className="h-24" />

          <nav aria-label="Mobile" className="flex flex-1 flex-col justify-center px-8">
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="cf-menu-item border-b border-cf-line py-6 heading-6 text-cf-text"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                {link.label}
              </a>
            ))}
            <Link
              href="/login"
              onClick={() => setOpen(false)}
              className="cf-menu-item py-6 heading-6 text-cf-muted"
              style={{ animationDelay: `${Math.min(NAV_LINKS.length, 6) * 60}ms` }}
            >
              Sign in
            </Link>
          </nav>

          <div className="px-8 pb-12">
            <Link
              href="/signup"
              onClick={() => setOpen(false)}
              className="cf-menu-item cf-btn cf-btn-primary w-full button-lg"
              style={{ animationDelay: `${Math.min(NAV_LINKS.length + 1, 6) * 60}ms` }}
            >
              Start creating
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default MarketingNavbar;
