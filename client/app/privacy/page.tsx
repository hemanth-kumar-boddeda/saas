import type { Metadata } from "next";
import LegalPage, { Section } from "../components/legal/LegalPage";

export const metadata: Metadata = {
  title: "Privacy - CreatorFlow",
  description: "What CreatorFlow stores, which providers process it, and how sessions and connected accounts are handled.",
};

// ponytail: plain-language draft. Have counsel review before launch.
export default function PrivacyPage() {
  return (
    <LegalPage chip="Privacy" title="Privacy" intro="What the current build of CreatorFlow stores and which providers see it.">
      <Section title="Account and session">
        <p>An account keeps your name, email and a hashed password, or the verified email and identifier from Google sign-in. Signing in sets a session cookie that scripts cannot read. A four digit code confirms new email addresses and expires after a few minutes.</p>
      </Section>
      <Section title="Videos, comments and review links">
        <p>Uploaded videos are stored on the server, transcoded for streaming and attached to their project. Comments are stored with the name of the commenter. Guests need no account; a guest&apos;s name is stored on their comments. Revoke a link at any time.</p>
      </Section>
      <Section title="AI processing">
        <p>When the owner generates a publish kit, the audio is sent for transcription and the transcript plus sampled video frames are sent to the configured AI provider (Google Gemini, Groq, Anthropic or OpenAI) to rank thumbnails and write copy. Your channel profile is included in those requests. Nothing is generated until the owner asks.</p>
      </Section>
      <Section title="Connected accounts and publishing">
        <p>YouTube and Instagram access tokens are stored encrypted and never shown in the app. Publishing sends the original video, your edited text and the chosen thumbnail to that platform. For Instagram, a short-lived signed link lets Meta fetch the video. Disconnect an account to delete its tokens.</p>
      </Section>
      <Section title="What we do not do">
        <p>Your uploads and account data are not sold, and no advertising profile is built from them.</p>
      </Section>
    </LegalPage>
  );
}
