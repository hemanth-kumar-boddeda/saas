export type Faq = {
  question: string;
  answer: string;
};

/**
 * Answers describe what the product does today. No pricing, no usage numbers,
 * and no promises about views, reach or results.
 */
export const FAQS: Faq[] = [
  {
    question: "What is CreatorFlow?",
    answer:
      "CreatorFlow is a workspace where a creator and their editor review a video together. You pin notes to exact timestamps, the editor uploads new versions, you approve one, and an AI-drafted publish kit is ready to edit and send to YouTube or Instagram.",
  },
  {
    question: "How do I leave feedback?",
    answer:
      "Pause the video and type a note, record a voice note (it gets a written transcript), or draw a pen or arrow on the frame. Your own notes stay private drafts until you press Send feedback, which emails your editor one digest.",
  },
  {
    question: "Does my editor need an account?",
    answer:
      "No. You invite them by email and they open a magic link. They see your notes and a change checklist, mark each change done, and upload the next version. You are notified when every change is done.",
  },
  {
    question: "Can I compare two versions?",
    answer:
      "Yes. Pick any two processed uploads and play them side by side with shared play, pause and one scrubber. Only the newer version plays sound.",
  },
  {
    question: "How do I create an account?",
    answer:
      "Sign up with your name, email and password and confirm it with the four digit code sent to your inbox, or continue with Google. The Google identity token is verified on our server before any account is created or linked.",
  },
  {
    question: "What does the AI generate?",
    answer:
      "After you approve a version, CreatorFlow drafts thumbnails from the best frames, title options, a description, chapters, tags, hashtags and an SRT caption file from the transcript and the video. Every field is editable. It is a starting point, and CreatorFlow does not promise views, reach or viral results.",
  },
  {
    question: "Can I publish to YouTube and Instagram from CreatorFlow?",
    answer:
      "Yes, once you connect your own account. You can publish now or schedule a time, and you can cancel a scheduled post before it goes out. Only an approved version can be published. Instagram requires a business or creator account.",
  },
  {
    question: "Can people download my video?",
    answer:
      "Videos play as a streaming preview with no download button and signed, short-lived links. That deters casual saving. It cannot stop someone from screen recording.",
  },
  {
    question: "Do I need a YouTube channel to start?",
    answer:
      "No. You can create an account and run reviews without connecting anything. A channel connection is only needed for the publishing step.",
  },
  {
    question: "Is there a paid plan?",
    answer:
      "CreatorFlow does not publish pricing yet. Nothing on this page is a price or an offer.",
  },
];
