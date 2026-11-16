import type { Metadata } from "next";
import MarketingNavbar from "../components/landing/MarketingNavbar";
import AboutStage from "../components/about/AboutStage";

export const metadata: Metadata = {
  title: "About - CreatorFlow",
  description: "CreatorFlow is where creators and editors review, approve and publish videos together.",
};

export default function About() {
  return (
    <div className="dark cf-root relative min-h-screen bg-cf-bg font-cf text-cf-text">
      <MarketingNavbar />
      <AboutStage />
    </div>
  );
}
