import React from "react";
import Link from "next/link";

const PRODUCT_LINKS = [
  { label: "Product", href: "/#product" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For teams", href: "/#teams" },
  { label: "FAQ", href: "/#faq" },
];

const COMPANY_LINKS = [
  { label: "Marketplace", href: "/marketplace" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/policy" },
];

const MarketingFooter: React.FC = () => (
  <footer className="border-t border-cf-line py-16">
    <div className="mx-auto max-w-6xl px-4 md:px-8">
      <div className="grid gap-10 md:grid-cols-3">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <span aria-hidden="true" className="block h-6 w-6 rounded-md bg-cf-violet" />
            <span className="title-3 text-cf-text">CreatorFlow</span>
          </Link>
          <p className="body-3 mt-4 max-w-xs text-cf-muted">
            One workspace for the YouTube production loop, from the first upload to the
            publish decision.
          </p>
        </div>

        <nav aria-label="Product">
          <h2 className="caption-3 text-cf-text">Product</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {PRODUCT_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="caption-2 text-cf-muted transition-colors duration-300 hover:text-cf-text"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <nav aria-label="Company">
          <h2 className="caption-3 text-cf-text">Company</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {COMPANY_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="caption-2 text-cf-muted transition-colors duration-300 hover:text-cf-text"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-cf-line pt-8 caption-4 text-cf-muted md:flex-row md:items-center md:justify-between">
        <span>© 2026 CreatorFlow. All rights reserved.</span>
        <span>Made for creators who publish on YouTube.</span>
      </div>
    </div>
  </footer>
);

export default MarketingFooter;
