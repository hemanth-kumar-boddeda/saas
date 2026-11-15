export type Faq = {
  question: string;
  answer: string;
};

/**
 * Every answer states what is live in the current build and what is still planned.
 * No pricing, no usage numbers, no claims that are not in the product.
 */
export const FAQS: Faq[] = [
  {
    question: "What is CreatorFlow?",
    answer:
      "CreatorFlow is a workspace for YouTube production. It keeps the uploaded files, the numbered versions of a cut, the review notes, the approval and the publishing metadata for a video in one place instead of across folders, chats and documents.",
  },
  {
    question: "What works today, and what is still being built?",
    answer:
      "Accounts, sign in with email and password, sign in with Google, the video marketplace and its payments are live now. The production workspace around them, with review, versions, approval, AI tools and direct publishing, is the part of CreatorFlow that is still in development.",
  },
  {
    question: "How do I create an account?",
    answer:
      "Create an account with your name, email and password, then confirm it with the four digit code sent to your inbox. The code expires after a few minutes, and you can request a new one by signing up again with the same address.",
  },
  {
    question: "Can I sign in with Google?",
    answer:
      "Yes. Google sign in is available on both the sign up and the sign in page. If the address has never been used here, Google sign in creates the account for you. The identity token is verified on our server before any account is created or linked.",
  },
  {
    question: "Do I need a YouTube channel to use CreatorFlow?",
    answer:
      "No. You can create an account and start a workspace without connecting a channel. A channel connection is only needed for the publishing step, which is planned and not live yet.",
  },
  {
    question: "How does the review and approval flow work?",
    answer:
      "In the planned workflow, every upload becomes a numbered version. Feedback is attached to the timestamp it refers to, and the owner approves one exact version. That approval is the version the publishing step is allowed to send.",
  },
  {
    question: "What does AI Creator Studio generate?",
    answer:
      "The planned AI tools work from the video you upload and produce a transcript, captions, translations, title and description suggestions, chapter markers and thumbnail concepts. Everything arrives as a draft you can edit before it is applied.",
  },
  {
    question: "Can I publish a video to YouTube from CreatorFlow?",
    answer:
      "Not yet. Today the workflow prepares the publishing package, with the approved cut, the title, the description and the chapter markers, so it is ready to go out. Publishing that package directly through a connected channel is planned and still in build.",
  },
  {
    question: "How does CreatorFlow handle teams and roles?",
    answer:
      "The planned workspace has two roles. Owners approve a version and publish it. Editors upload versions, answer review notes and prepare the package. Granular roles beyond owner and editor are not planned.",
  },
  {
    question: "Is there a paid plan?",
    answer:
      "CreatorFlow does not publish subscription pricing yet. The marketplace charges for the assets it sells today, and workspace pricing will be announced once the workspace opens.",
  },
];
