// One source for the About page: the sideways track on desktop and the stacked article elsewhere.
export type Row = { text: string; kind: "head" | "body" | "list" | "numeral" | "small" | "quote" | "link"; href?: string };
export type Block = { id: string; side: "top" | "bottom"; rows: Row[] };

export const HEADLINE = ["Shaping the loop between", "creators and editors into", "feedback that gets finished."];
export const SUBLINE = "CreatorFlow: review, approve, publish";

export const BLOCKS: Block[] = [
  { id: "review", side: "top", rows: [
    { kind: "head", text: "Review" },
    { kind: "body", text: "Notes pinned to the exact second, as text, as a voice note with a written transcript, or as a drawing on the frame." },
  ] },
  { id: "versions", side: "bottom", rows: [
    { kind: "head", text: "Versions" },
    { kind: "list", text: "Numbered cuts" }, { kind: "list", text: "Side-by-side compare" }, { kind: "list", text: "A change checklist" }, { kind: "list", text: "Editors tick changes off" },
  ] },
  { id: "p1", side: "top", rows: [
    { kind: "head", text: "Part One  ·  Craft" }, { kind: "numeral", text: "I" },
    { kind: "small", text: "Good feedback is specific. A second beats a paragraph, and a circle on the frame beats both." },
  ] },
  { id: "q1", side: "bottom", rows: [
    { kind: "quote", text: "“Feedback should point, not describe.”" }, { kind: "head", text: "— CreatorFlow principle" },
  ] },
  { id: "kit", side: "top", rows: [
    { kind: "head", text: "After approval" },
    { kind: "list", text: "Thumbnails from the best frames" }, { kind: "list", text: "Titles and a description" }, { kind: "list", text: "Chapters, tags, hashtags" }, { kind: "list", text: "SRT captions" },
  ] },
  { id: "honest", side: "bottom", rows: [
    { kind: "head", text: "Honesty" },
    { kind: "body", text: "AI output is a starting point. CreatorFlow does not promise views, reach or viral results." },
  ] },
  { id: "p2", side: "top", rows: [
    { kind: "head", text: "Part Two  ·  Rhythm" }, { kind: "numeral", text: "II" },
    { kind: "small", text: "Streaming previews deter casual saving. They cannot stop screen recording." },
  ] },
  { id: "roles", side: "bottom", rows: [
    { kind: "head", text: "Roles" },
    { kind: "list", text: "Owner: decides" }, { kind: "list", text: "Editor: a link, no account" }, { kind: "list", text: "Guest: can comment" },
  ] },
  { id: "q2", side: "top", rows: [
    { kind: "quote", text: "“Approve one version. Publish that one.”" }, { kind: "head", text: "— CreatorFlow principle" },
  ] },
  { id: "start", side: "bottom", rows: [
    { kind: "head", text: "Start" },
    { kind: "link", text: "Create an account →", href: "/signup" },
    { kind: "link", text: "Try the sample project →", href: "/projects" },
    { kind: "link", text: "Read the FAQ →", href: "/#faq" },
  ] },
];
