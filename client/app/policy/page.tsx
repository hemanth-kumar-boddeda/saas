import type { Metadata } from "next";
import LegalPage, { Section } from "../components/legal/LegalPage";

export const metadata: Metadata = { title: "Terms - CreatorFlow", description: "Terms of use for CreatorFlow." };

// ponytail: plain-language draft. Have counsel review before launch.
export default function Terms() {
  return (
    <LegalPage chip="Terms" title="Terms of use" intro="Plain-language terms for using CreatorFlow. This draft needs legal review before public launch.">
      <Section title="Your content">
        <p>You own the videos and text you upload. You give CreatorFlow permission to store, transcode, stream and process them to provide the service, including sending audio to a transcription provider and transcript and frames to an AI provider to build your publish kit.</p>
      </Section>
      <Section title="Sharing and guests">
        <p>Anyone with a review link can view and comment until the link expires or you revoke it. Preview streaming deters casual downloading but cannot prevent screen recording. Only share with people you trust.</p>
      </Section>
      <Section title="Connected accounts">
        <p>When you connect YouTube or Instagram you authorize CreatorFlow to publish on your behalf. Tokens are stored encrypted and you can disconnect at any time. You are responsible for what you publish and for following each platform&apos;s rules.</p>
      </Section>
      <Section title="AI output">
        <p>AI suggestions may be wrong or unsuitable. Review and edit them before publishing. No result, view count or ranking is guaranteed.</p>
      </Section>
    </LegalPage>
  );
}
