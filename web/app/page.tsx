"use client";
// Reels Magic demo funnel (Paper p-4-0): group-chat onboarding (6B3-0) -> shoot & post (7VA-0) -> live -> first week.
// This file owns state + async work; screens live in components/rm/*.
import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/ui";
import { OnboardingScreen, ONBOARDING_STEPS } from "@/components/rm/onboarding";
import { ShootFlowScreen, SHOOT_STEPS } from "@/components/rm/shoot";
import { LiveScreen, WeekScreen } from "@/components/rm/after";
import { STEPS, type StepId, type RMState, type RMCtx, type Job } from "@/components/rm/types";
import { DEFAULT_LINES } from "@/lib/introShots";

const KEY = "reelsmagic:funnel";

const INITIAL: RMState = {
  step: "meet",
  name: "",
  email: "",
  signedUp: false,
  why: null,
  niche: null,
  more: [],
  location: "",
  audience: null,
  experience: null,
  time: null,
  langs: [],
  style: null,
  never: [],
  warmup: { text: "", file: null, source: "" },
  lines: [],
  voice: null,
  voiceTaken: false,
  shot: 0,
  clips: [null, null, null, null, null, null],
  demo: false,
  jobId: null,
  job: null,
  posted: null,
  claimed: false,
};

const MOCK_JOB: Job = {
  id: "mock",
  steps: { writer: "done", voice: "done", designer: "done", guard: "done" },
  reels: { en: "/demo/intro-en.mp4" },
  captions: {
    en: "Bored of the same office lunch every day?\n\nFresh, home-style tiffins from my kitchen in Gomti Nagar. Aloo parathas made by hand, cooked in real ghee.\n\nWhatsApp me before 11 and your lunch reaches your office by 1. Follow for today's menu!\n\n#homefood #tiffin #gharkakhana #lucknowfood",
  },
  verdict: { verdict: "pass", reasons: [] },
  week: [
    { day: "Tuesday", time: "4 pm", format: "Reel", title: "Paratha Reel" },
    { day: "Wednesday", time: "11 am", format: "Carousel", title: "Dal tadka carousel" },
    { day: "Friday", time: "4 pm", format: "Photo", title: "Tiffin menu" },
    { day: "Saturday", time: "6 pm", format: "Reel", title: "Diwali gujiya" },
  ],
  done: true,
  duration: 52,
  voiceKind: "stock",
};

// Demo persona answers, used when jumping straight to a step from /prototype.
const PERSONA: Partial<RMState> = {
  name: "Sunita",
  email: "sunita.demo@example.com",
  signedUp: true,
  why: "Get more orders",
  niche: "Food & cooking",
  more: ["Home tiffin service"],
  location: "Gomti Nagar, Lucknow",
  audience: "Office workers nearby",
  experience: "Never posted",
  time: "30 min a day",
  langs: ["English", "Hindi"],
  style: "Voice + hands",
  never: ["My face", "My family"],
  warmup: { text: "I'm Sunita. I make fresh home-style tiffins in Gomti Nagar. Office people order aloo parathas, dal and sabzi every day.", file: null, source: "mock" },
};

function mockStateFor(step: StepId): RMState {
  const i = STEPS.indexOf(step);
  const at = (id: StepId) => i > STEPS.indexOf(id);
  const s: RMState = { ...INITIAL, step };
  if (at("meet")) Object.assign(s, { name: PERSONA.name, email: PERSONA.email, signedUp: true });
  if (i >= STEPS.indexOf("why")) Object.assign(s, PERSONA, { step });
  if (at("warmup")) s.lines = DEFAULT_LINES;
  if (at("read")) s.voiceTaken = true;
  if (at("shoot")) s.clips = s.clips.map((_, k) => (step === "saved" ? (k === 0 ? "local" : null) : "local"));
  if (step === "shoot" || step === "saved") s.clips = [step === "saved" ? "local" : null, null, null, null, null, null];
  if (step === "team") s.job = { ...MOCK_JOB, done: false, steps: { writer: "done", voice: "done", designer: "active", guard: "todo" } };
  if (at("team")) s.job = MOCK_JOB;
  if (at("reel")) s.posted = { live: true };
  return s;
}

// Instagram simulation (leads from her Reel), built at /v2. It tells us when it's finished.
function V2Screen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      if (e.origin === location.origin && e.data?.type === "reels-magic-v2-done") onDone();
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, [onDone]);
  return (
    <main className="relative mx-auto h-dvh w-full max-w-[430px] overflow-hidden bg-white">
      <div className="absolute inset-0">
        <iframe src="/v2?embed=1&step=1&statusbar=0" title="Instagram" className="h-full w-full border-0" allow="autoplay; clipboard-write" />
      </div>
    </main>
  );
}

const persist = (s: RMState) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

export default function ReelsMagicFunnel() {
  const [s, setS] = useState<RMState>(INITIAL);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pct, setPct] = useState(4);
  const embed = useRef(false);
  const fast = useRef(false);
  const scriptReq = useRef<{ key: string; p: Promise<void> } | null>(null);
  const ctxRef = useRef<(RMCtx & { profile: () => unknown }) | null>(null);
  const teamStarted = useRef(false);

  const flash = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2600);
  }, []);
  const set = useCallback((patch: Partial<RMState> | ((p: RMState) => Partial<RMState>)) => {
    setS((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      persist(next);
      return next;
    });
  }, []);
  const go = useCallback((step: StepId) => set({ step }), [set]);

  // Boot: ?reset, ?step=<id> (prototype jump with demo persona), ?demo=0|1, ?embed, ?fast.
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    embed.current = q.has("embed");
    fast.current = q.has("fast");
    if (embed.current) {
      document.documentElement.style.setProperty("--top-inset", "58px");
      document.documentElement.classList.add("rm-hints"); // pulsing "Tap here" on the primary button (stage demo)
    }
    let st: RMState = INITIAL;
    if (!q.has("reset")) {
      try {
        st = { ...INITIAL, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
        if (!STEPS.includes(st.step)) st.step = "meet";
      } catch {}
    }
    const jump = q.get("step") as StepId | null;
    if (jump && STEPS.includes(jump)) st = mockStateFor(jump);
    if (q.has("demo")) st = { ...st, demo: q.get("demo") !== "0" };
    setS(st);
    persist(st);
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready && embed.current) window.parent?.postMessage({ rmStep: s.step }, "*");
    window.scrollTo(0, 0);
  }, [s.step, ready]);

  // Team at work: poll the assembly job, then show the Reel.
  useEffect(() => {
    if (s.step !== "team" || !s.jobId) return;
    let alive = true;
    const t0 = Date.now();
    (async () => {
      while (alive) {
        const job: Job | null = await fetch(`/api/funnel/status?id=${s.jobId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!alive) return;
        if (job) set({ job });
        if ((job?.done && Date.now() - t0 > (fast.current ? 600 : 2500)) || !job || Date.now() - t0 > 180_000) {
          setPct(100);
          await new Promise((r) => setTimeout(r, 500));
          set({ step: "reel", job: job?.done ? job : MOCK_JOB });
          return;
        }
        await new Promise((r) => setTimeout(r, 800));
      }
    })();
    return () => {
      alive = false;
    };
  }, [s.step, s.jobId, set]);

  useEffect(() => {
    if (s.step !== "team") return;
    const t = setInterval(() => {
      const st = s.job?.steps;
      const floor = (st ? Object.values(st).filter((v) => v === "done").length : 0) * 25;
      setPct((p) => Math.min(Math.max(p, floor) + (p < floor + 22 ? 1 : 0), 99));
    }, 250);
    return () => clearInterval(t);
  }, [s.step, s.job?.steps]);

  // Speed: draft the script in the background as soon as enough answers exist, redo it when the warm-up
  // transcript arrives, and run the AgenticOrg team (Scout -> Writer -> Editor) in parallel without blocking.
  const scriptInputs = JSON.stringify([s.niche, s.more, s.location, s.why, s.audience, s.langs, s.warmup.text]);
  useEffect(() => {
    if (!ready) return;
    const i = STEPS.indexOf(s.step);
    if (i < STEPS.indexOf("languages") || i > STEPS.indexOf("script")) return;
    ctxRef.current?.loadScript();
    if (!teamStarted.current) {
      teamStarted.current = true;
      fetch("/api/intro/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile: ctxRef.current?.profile() }) })
        .then((r) => r.json())
        .then((r) => r?.team && set({ team: r.team }))
        .catch(() => null);
    }
  }, [ready, s.step, scriptInputs, set]);

  const vibe = (s.style ?? "").toLowerCase().includes("fun") ? "fun" : (s.style ?? "").toLowerCase().includes("calm") ? "calm" : "warm";
  const never = s.never.map((n) => (/face/i.test(n) ? "Face" : /family|kid/i.test(n) ? "Family" : /home|house|address/i.test(n) ? "Home" : /price/i.test(n) ? "Prices" : n));

  const profile = () => ({
    name: s.name || null,
    profession: s.more[0] ?? s.niche ?? "home business",
    city: s.location || null,
    what_they_make: [s.niche, ...s.more].filter(Boolean).join(", "),
    audience: s.audience ?? "",
    never,
    tone: s.style ?? vibe,
    language: s.langs.join(" + ") || "English",
    texts: [s.warmup.text].filter(Boolean),
  });
  const ctx: RMCtx & { profile: typeof profile } = {
    profile,
    s,
    set,
    go,
    embed: embed.current,
    flash,
    pct,
    next: () => {
      const i = STEPS.indexOf(s.step);
      set({ step: STEPS[Math.min(STEPS.length - 1, i + 1)] });
    },
    back: () => {
      const i = STEPS.indexOf(s.step);
      let prev = STEPS[Math.max(0, i - 1)];
      if (prev === "signup" && s.signedUp) prev = "meet";
      if (prev === "saved") prev = "shots";
      if (prev === "shoot") prev = "shots";
      set({ step: prev });
    },
    submitSignup: async (vals) => {
      // Values come from the form directly: state set just before this call isn't visible in this closure yet.
      const body = { name: (vals?.name ?? s.name).trim(), email: (vals?.email ?? s.email).trim().toLowerCase(), source: embed.current ? "prototype" : "funnel" };
      try {
        localStorage.setItem("reelsmagic:signup", JSON.stringify({ ...body, at: new Date().toISOString() }));
      } catch {}
      const res = await fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      if (res && !res.ok) console.error("[signup] not saved", res.status, await res.text().catch(() => ""));
      set({ name: body.name, email: body.email, signedUp: true, step: "why" });
    },
    loadScript: async (change) => {
      const key = JSON.stringify([s.niche, s.more, s.location, s.why, s.audience, s.langs, s.warmup.text, change ?? ""]);
      if (!change && scriptReq.current?.key === key) return scriptReq.current.p;
      const p = (async () => {
      const about = [
        s.name && `My name is ${s.name}.`,
        s.niche && `I'm in ${s.niche}${s.more.length ? ` (${s.more.join(", ")})` : ""}${s.location ? ` in ${s.location}` : ""}.`,
        s.why && `I want to ${s.why.toLowerCase()}.`,
        s.audience && `My audience: ${s.audience}.`,
        s.langs.length && `My viewers speak ${s.langs.join(" and ")}.`,
      ]
        .filter(Boolean)
        .join(" ");
      const r = await fetch("/api/intro/script", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          fast: true,
          texts: [about, s.warmup.text],
          never,
          vibe,
          change,
          lines: s.lines,
          profile: {
            name: s.name || null,
            profession: s.more[0] ?? s.niche ?? "home business",
            city: s.location || null,
            what_they_make: [s.niche, ...s.more].filter(Boolean).join(", "),
            audience: s.audience ?? "",
            never,
            tone: s.style ?? vibe,
            language: s.langs.join(" + ") || "English",
            texts: [about, s.warmup.text].filter(Boolean),
          },
        }),
      })
        .then((r) => r.json())
        .catch(() => null);
      set({ lines: r?.lines?.length === 6 ? r.lines : DEFAULT_LINES });
      })();
      if (!change) scriptReq.current = { key, p };
      return p;
    },
    build: async () => {
      setPct(4);
      set({ step: "team", job: null, jobId: null });
      const body = {
        lines: s.lines.length === 6 ? s.lines : DEFAULT_LINES,
        voice: s.voice,
        clips: s.clips.map((c) => (c && c !== "local" ? c : null)),
        demo: s.demo,
        vibe,
        never,
        profession: s.more[0] ?? s.niche ?? "home business",
        team: s.team ?? null,
      };
      const job: Job | null = await fetch("/api/intro/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (job) set({ jobId: job.id, job });
      else setTimeout(() => set({ step: "reel", job: MOCK_JOB }), 2500);
    },
    postIt: async () => {
      const reel = s.job?.reels?.en ?? MOCK_JOB.reels.en!;
      const caption = s.job?.captions?.en ?? MOCK_JOB.captions.en!;
      try {
        await navigator.clipboard.writeText(caption);
      } catch {}
      const cfg = await fetch("/api/funnel/config").then((r) => r.json()).catch(() => ({}));
      if (cfg.instagram) {
        const r = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "reel", reel, caption, ai: true }) })
          .then((r) => r.json())
          .catch(() => null);
        if (r?.ok) return set({ step: "live", posted: { live: true, permalink: r.permalink } });
      }
      // No download step: go straight to "It's live" (the Reel is saved to her account in the real app).
      set({ step: "live", posted: { live: true } });
    },
  };

  ctxRef.current = ctx;
  if (!ready) return <main className="min-h-dvh bg-[#F7F8FA]" />;

  let screen = null;
  if ((ONBOARDING_STEPS as readonly string[]).includes(s.step)) screen = <OnboardingScreen ctx={ctx} />;
  else if ((SHOOT_STEPS as readonly string[]).includes(s.step)) screen = <ShootFlowScreen ctx={ctx} />;
  else if (s.step === "live") screen = <LiveScreen ctx={ctx} />;
  else if (s.step === "v2") screen = <V2Screen onDone={() => go("week")} />;
  else screen = <WeekScreen ctx={ctx} />;

  return (
    <>
      {screen}
      <Toast text={toast} />
    </>
  );
}
