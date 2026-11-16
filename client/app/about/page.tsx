import type { Metadata } from "next";
import LegalPage, { Section } from "../components/legal/LegalPage";

export const metadata: Metadata = { title: "About - CreatorFlow", description: "CreatorFlow is where creators and editors review, approve and publish videos together." };

export default function About() {
  return (
    <LegalPage chip="About" title="Review, approve, publish." intro="CreatorFlow is a workspace for YouTube and Instagram creators and the editors they work with.">
      <Section title="What it does">
        <p>Editors upload a cut or paste an unlisted link. Owners and invited guests leave comments pinned to exact timestamps. Editors upload new versions until the owner approves.</p>
        <p>After approval, AI drafts a publish kit from the transcript and video frames: thumbnails, title options, a description, chapters, hashtags, tags and captions. You edit everything, then publish or schedule to YouTube or Instagram.</p>
      </Section>
      <Section title="What it does not do">
        <p>Videos play as a streaming preview with no download button. That deters casual saving but cannot stop screen recording.</p>
        <p>AI output is a starting point. CreatorFlow does not promise views, reach or viral results.</p>
      </Section>
    </LegalPage>
  );
}
