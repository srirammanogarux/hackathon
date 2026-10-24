// Contract between the Reels Magic funnel orchestrator (app/page.tsx) and the screen components
// (components/rm/onboarding.tsx, components/rm/shoot.tsx). Screens are dumb-ish: they read ctx.s,
// call ctx.set(...) for answers and ctx.go(...) / ctx.next() to navigate; async work lives in the orchestrator.

export type Lang = "en" | "hi" | "ta" | "kn" | "te";

// Every screen in order. The /prototype sidebar uses the same ids (?step=<id>).
export const STEPS = [
  // Onboarding · Meet your team (Paper artboard 6B3-0) + sign-up
  "meet", // 1 Meet your team (Phone 6CL-0)
  "signup", // Name + Email -> POST /api/signup
  "why", // 2 A · Why (6ER-0)
  "niche", // 3 B · Niche (6HG-0)
  "more", // 4 B2 · Tell me more (6LI-0)
  "audience", // 5 C · Audience (6Q7-0)
  "experience", // 6 D+E · Experience & time (6UR-0)
  "languages", // 7 F+G · Languages & Reel style (6YZ-0)
  "never", // 8 H · Never show (73O-0)
  "warmup", // 9 Warm-up talk (784-0)
  "script", // 10 Script ready (7D8-0)
  "read", // 11 Read it out (7I0-0)
  "change", // 12 Want to change anything? (7O4-0)
  // First Reel · Shoot & post (Paper artboard 7VA-0)
  "shots", // 1 Your 6 shots (7VP-0)
  "shoot", // 2 Shooting shot N (7XP-0)  -- live camera
  "saved", // 3 Shot N saved (7Z1-0)
  "alldone", // 4 All shots done (81V-0)
  "team", // 5 Team at work (84M-0)
  "reel", // 6 Your intro Reel (87L-0)
  // After posting (core funnel board 3R8-0), no paywall
  "live",
  "v2", // Instagram simulation: leads from the Reel (iframe /v2?embed=1&step=1, posts {type:"reels-magic-v2-done"})
  "week",
] as const;
export type StepId = (typeof STEPS)[number];

export type Talk = { text: string; file: string | null; source: "voice" | "typed" | "mock" | "" };
export type Draft = { day: string; time: string; format: string; title: string };
export type Job = {
  id: string;
  steps: Record<"writer" | "voice" | "designer" | "guard", "todo" | "active" | "done">;
  reels: Partial<Record<Lang, string>>;
  captions: Partial<Record<Lang, string>>;
  verdict: { verdict: string; reasons: string[] } | null;
  week: Draft[];
  done: boolean;
  duration?: number;
  voiceKind?: string;
  guard?: { via: boolean; ms: number | null; escalated: boolean; approval: { status?: string; note?: string } | null; runId: string | null; risk: string | null } | null;
};

// AgenticOrg team run from the script step (Scout -> Writer -> Editor).
export type TeamInfo = { via: boolean; ms: Record<string, number>; angle?: string | null; total?: number } | null;

export type RMState = {
  step: StepId;
  // sign-up
  name: string;
  email: string;
  signedUp: boolean;
  // onboarding answers (free-form strings so screens can match the Paper options exactly)
  why: string | null; // A
  niche: string | null; // B
  more: string[]; // B2 suggested chips picked
  location: string; // B2
  audience: string | null; // C
  experience: string | null; // D
  time: string | null; // E
  langs: string[]; // F (labels as shown, e.g. "English", "Hindi", "Hinglish")
  style: string | null; // G Reel style
  never: string[]; // H toggled-on items (labels as shown)
  warmup: Talk; // 9 warm-up talk (15 sec)
  // script + voiceover
  lines: string[]; // 6 lines
  voice: string | null; // server file name of her reading (from /api/funnel/transcribe), null = demo voice
  voiceTaken: boolean;
  // shoot
  shot: number; // 0..5 current shot
  clips: (string | null)[]; // server file names (or "local") per shot
  demo: boolean; // show AI demo footage after each shot
  // result
  jobId: string | null;
  job: Job | null;
  posted: { live: boolean; permalink?: string | null } | null;
  claimed: boolean;
  team?: TeamInfo; // set by loadScript when AgenticOrg wrote the script
};

export type RMCtx = {
  s: RMState;
  set: (patch: Partial<RMState> | ((p: RMState) => Partial<RMState>)) => void;
  go: (step: StepId) => void;
  next: () => void; // next step in STEPS order
  back: () => void;
  flash: (msg: string) => void;
  embed: boolean; // inside the /prototype iPhone (top inset 58px is applied by the orchestrator)
  // orchestrator actions
  submitSignup: (vals?: { name: string; email: string }) => Promise<void>; // POSTs /api/signup, stores locally, goes to "why"
  loadScript: (change?: "shorter" | "phone" | string) => Promise<void>; // fills s.lines (6)
  build: () => Promise<void>; // starts assembly (/api/intro/build), goes to "team", then auto to "reel"
  postIt: () => Promise<void>; // publish or download+copy caption, goes to "live"
  pct: number; // team-at-work progress 0..100
};
