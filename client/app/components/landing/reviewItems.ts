// Sample reviews shown in the orbit. Clips are generated gradients; titles, versions and note counts are made up.
export type OrbitItem = { clip: number; title: string; meta: string; version: number; pins: number[]; blurb: string };

export const ORBIT_ITEMS: OrbitItem[] = [
  { clip: 1, title: "Brand reel", meta: "Version 3 · 2 notes open", version: 3, pins: [0.2, 0.62], blurb: "Intro tightened, captions still to add." },
  { clip: 2, title: "Podcast trailer", meta: "Version 1 · waiting on you", version: 1, pins: [0.35], blurb: "First cut just arrived from the editor." },
  { clip: 3, title: "Product launch", meta: "Version 4 · approved", version: 4, pins: [], blurb: "Approved. The publish kit is drafted." },
  { clip: 4, title: "Travel vlog", meta: "Version 2 · all changes done", version: 2, pins: [0.15, 0.5, 0.8], blurb: "Editor ticked every change off." },
  { clip: 5, title: "Tutorial, ep. 12", meta: "Version 2 · voice note", version: 2, pins: [0.44], blurb: "A 9 second voice note, transcribed." },
  { clip: 6, title: "Shorts batch", meta: "Scheduled · Fri 18:00", version: 5, pins: [], blurb: "Scheduled to YouTube. Cancel any time before release." },
  { clip: 7, title: "Client testimonial", meta: "Version 3 · drawing on frame", version: 3, pins: [0.7], blurb: "Logo circled on the frame, move it out of the corner." },
  { clip: 8, title: "Channel intro", meta: "Version 1 · draft notes", version: 1, pins: [0.3, 0.55], blurb: "Owner notes stay drafts until Send feedback." },
];
