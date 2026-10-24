"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { Toast } from "@/components/ui";
import { VoiceTeleprompter, ShootScreen } from "@/components/intro";
import { DEFAULT_LINES, SHOTS, refUrl } from "@/lib/introShots";

// Reels Magic core demo funnel (mascot: Smiley). Style follows the Rhyme iOS app.
// Talk twice -> Reel in her words and her voice -> post free -> reminder promise -> unlock the week for ₹1.
type Lang = "en" | "hi" | "ta" | "kn" | "te";
type StepState = "todo" | "active" | "done";
type Draft = { day: string; time: string; format: string; title: string };
type Job = {
  id: string;
  quote: string;
  langs: Lang[];
  steps: Record<"writer" | "voice" | "designer" | "guard", StepState>;
  voiceKind: string;
  reels: Partial<Record<Lang, string>>;
  rendering: Lang[];
  captions: Partial<Record<Lang, string>>;
  verdict: { verdict: string; reasons: string[] } | null;
  week: Draft[];
  done: boolean;
  visuals?: "photos" | "ai" | "cards" | null;
  aiGenerated?: boolean;
  duration?: number;
};
type Talk = { text: string; file: string | null; source: "voice" | "typed" | "mock" | "" };
type State = {
  step: number;
  talks: Talk[];
  consent: boolean;
  never: string[];
  langs: Lang[];
  jobId: string | null;
  job: Job | null;
  lang: Lang;
  posted: { live: boolean; permalink?: string | null } | null;
  remindDays: number;
  plan: "trial" | "starter";
  paid: boolean;
  claimed: boolean;
  vibe: "warm" | "fun" | "calm";
  photos: string[]; // her own photos, small JPEG data URLs
  useSamples: boolean; // demo: the sample kitchen photos
  lines: string[]; // intro Reel script, 6 lines
  voice: string | null; // her voiceover (server file name)
  voiceTaken: boolean;
  shot: number; // 0..5
  clips: (string | null)[]; // her recorded shots (server file names)
  demo: boolean; // stage demo: show AI demo footage after each shot
  name: string;
  email: string;
  signedUp: boolean;
};

const LAST = 14;
const SIGNUP = 15; // sign-up screen, shown between the hook (1) and Talk 1 (2)
const LANGS: { id: Lang; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "Hindi" },
  { id: "ta", label: "Tamil" },
  { id: "kn", label: "Kannada" },
  { id: "te", label: "Telugu" },
];
const NEVER = [
  { id: "Face", icon: "bust", sub: "Hands and voice only" },
  { id: "Family", icon: "family", sub: "No one else in frame" },
  { id: "Home", icon: "house", sub: "No address or house front" },
  { id: "Prices", icon: "label", sub: "You say prices yourself" },
];
const MOCK_TALK = [
  "I make soft aloo parathas and fresh tiffin at home. Office people near my house order every morning.",
  "Tell people my parathas taste just like their mom's cooking. Soft, not oily, and delivered before 9 every morning.",
];
const MOCK_WEEK: Draft[] = [
  { day: "Tuesday", time: "4 pm", format: "Reel", title: "Paratha flip in 30 seconds" },
  { day: "Wednesday", time: "11 am", format: "Carousel", title: "3 fillings my customers love" },
  { day: "Friday", time: "4 pm", format: "Reel", title: "Packing 20 tiffins before 9 am" },
  { day: "Sunday", time: "6 pm", format: "Photo", title: "This week's menu" },
];
const DEMO_REEL: Record<Lang, string> = { en: "/demo/funnel-en.mp4", hi: "/demo/funnel-hi.mp4", ta: "/demo/reel-ta.mp4", kn: "/demo/reel-kn.mp4", te: "/demo/reel-te.mp4" };
const MOCK_JOB: Job = {
  id: "mock",
  quote: "I'm Sunita, and every morning I make fresh, home-style tiffins",
  langs: ["en"],
  steps: { writer: "done", voice: "done", designer: "done", guard: "done" },
  voiceKind: "demo",
  reels: { en: "/demo/intro-en.mp4" },
  rendering: [],
  captions: {
    en: "Bored of the same office lunch every day?\n\nFresh, home-style tiffins from my kitchen in Gomti Nagar. Aloo parathas made by hand, cooked in real ghee.\n\nWhatsApp me before 11 and your lunch reaches your office by 1. Follow for today's menu!\n\n#homefood #tiffin #gharkakhana #lucknowfood",
    hi: "\"बिल्कुल माँ के हाथ जैसा\" 🫓 हर सुबह ताज़ा आलू पराठे। रात 9 बजे से पहले मैसेज करें!",
  },
  verdict: { verdict: "pass", reasons: [] },
  week: MOCK_WEEK,
  done: true,
  visuals: "photos",
  duration: 52,
};
const COVERS = [
  "linear-gradient(160deg, #FFE3B3 0%, #FFB86B 100%)",
  "linear-gradient(160deg, #D9ECFF 0%, #8CC8FF 100%)",
  "linear-gradient(160deg, #DDF7E7 0%, #7FD6A4 100%)",
  "linear-gradient(160deg, #FFE0EC 0%, #FF9EC0 100%)",
];
const DRAFT_ICON: Record<string, string> = { Reel: "camera", Carousel: "art", Photo: "flatbread" };
const VIBE_OPTS = [
  { id: "warm" as const, title: "Warm & homely", icon: "cooking" },
  { id: "fun" as const, title: "Fun & fast", icon: "party" },
  { id: "calm" as const, title: "Calm & helpful", icon: "sparkles" },
];

const INITIAL: State = {
  step: 1,
  talks: [
    { text: "", file: null, source: "" },
    { text: "", file: null, source: "" },
  ],
  consent: true,
  never: ["Face"],
  langs: ["en", "hi"],
  jobId: null,
  job: null,
  lang: "en",
  posted: null,
  remindDays: 2,
  plan: "trial",
  paid: false,
  claimed: false,
  vibe: "warm",
  photos: [],
  useSamples: true,
  lines: [],
  voice: null,
  voiceTaken: false,
  shot: 0,
  clips: [null, null, null, null, null, null],
  demo: false,
  name: "",
  email: "",
  signedUp: false,
};

// Prefilled state for jumping straight to a step (prototype shell, ?step=N).
function mockStateFor(step: number): State {
  const s: State = { ...INITIAL, step };
  if (step >= 2 && step !== SIGNUP) s.signedUp = true;
  if (step >= 2) s.name = "Sunita";
  if (step >= 3) s.talks = [{ text: MOCK_TALK[0], file: null, source: "mock" }, { text: step >= 4 ? MOCK_TALK[1] : "", file: null, source: step >= 4 ? "mock" : "" }];
  if (step >= 5) s.lines = DEFAULT_LINES;
  if (step >= 7) s.voiceTaken = true;
  if (step === 9) s.job = { ...MOCK_JOB, done: false, steps: { writer: "done", voice: "done", designer: "active", guard: "todo" } };
  if (step >= 10) s.job = MOCK_JOB;
  if (step >= 11) s.posted = { live: false };
  if (step >= LAST) s.paid = true;
  return s;
}

const KEY = "instabud:funnel";
const persist = (s: State) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
};

/* ---------- pieces ---------- */

function I3({ name, size = 28, className = "", style }: { name: string; size?: number; className?: string; style?: CSSProperties }) {
  return <img src={`/3d/${name}.png`} alt="" width={size} height={size} className={`select-none ${className}`} style={style} draggable={false} />;
}

function Glyph({ name, size = 20, color = "#FFFFFF" }: { name: string; size?: number; color?: string }) {
  const p: Record<string, ReactNode> = {
    mic: (<><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><path d="M12 17v4" /></>),
    arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
    sparkle: (<><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></>),
    ig: (<><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="0.6" fill={color} /></>),
    lock: (<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>),
    unlock: (<><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 7.5-2" /></>),
    stop: <rect x="7" y="7" width="10" height="10" rx="2" fill={color} />,
    back: <path d="m15 18-6-6 6-6" />,
    check: <path d="m5 12 5 5 9-10" />,
    bell: (<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></>),
    download: (<><path d="M12 3v12M6 11l6 6 6-6" /><path d="M4 21h16" /></>),
    sound: (<><path d="M4 9v6h4l5 4V5L8 9z" /><path d="M16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" /></>),
    wave: (<><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></>),
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {p[name]}
    </svg>
  );
}

// One primary CTA per screen, always with an icon. "dark" = Rhyme's black Continue pill; "blue" = big moments.
function CTA({ icon, children, onClick, disabled, kind = "dark" }: { icon: string; children: ReactNode; onClick?: () => void; disabled?: boolean; kind?: "dark" | "blue" | "white" }) {
  const cls = kind === "blue" ? "btn-blue text-white" : kind === "white" ? "bg-white text-[#111] shadow-[0_10px_30px_rgba(16,24,40,0.12)]" : "bg-[#111] text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-14 w-full items-center justify-center gap-2 rounded-full text-[17px] font-semibold transition active:scale-[0.98] disabled:opacity-35 ${cls}`}
    >
      {kind !== "dark" && <Glyph name={icon} size={20} color={kind === "white" ? "#111" : "#FFFFFF"} />}
      {children}
      {kind === "dark" && <Glyph name={icon} size={18} color="#FFFFFF" />}
    </button>
  );
}

function TextLink({ children, onClick, href }: { children: ReactNode; onClick?: () => void; href?: string }) {
  const cls = "text-[15px] font-semibold text-[#1E8BFF]";
  if (href) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  return <button onClick={onClick} className={cls}>{children}</button>;
}

function Shell({ children, bg = "#F7F8FA" }: { children: ReactNode; bg?: string }) {
  return (
    <main
      className="rhyme relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip"
      style={{ background: bg, paddingTop: "max(env(safe-area-inset-top), var(--top-inset, 14px))" }}
    >
      {children}
    </main>
  );
}

function TopBar({ step, onBack, total = 3 }: { step: number; onBack: () => void; total?: number }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-1">
      <button onClick={onBack} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
        <Glyph name="back" size={18} color="#111" />
      </button>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
        <div className="h-full rounded-full bg-[#1E8BFF] transition-all duration-500" style={{ width: `${(step / total) * 100}%` }} />
      </div>
    </div>
  );
}

function CheckCircle({ on, multi = false }: { on: boolean; multi?: boolean }) {
  return on ? (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1E8BFF]">
      <Glyph name="check" size={14} />
    </span>
  ) : (
    <span className={`h-6 w-6 shrink-0 border-2 border-[#D1D5DB] ${multi ? "rounded-[7px]" : "rounded-full"}`} />
  );
}

function OptionRow({ icon, title, sub, on, onClick, multi }: { icon: string; title: string; sub?: string; on: boolean; onClick: () => void; multi?: boolean }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full items-center gap-3 rounded-[20px] p-3 text-left transition active:scale-[0.99]"
      style={{ background: on ? "#EAF4FF" : "#FFFFFF", boxShadow: on ? "inset 0 0 0 1.5px #1E8BFF" : "0 8px 24px rgba(16,24,40,0.06)" }}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F3F4F6]">
        <I3 name={icon} size={30} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[16px] font-semibold leading-5">{title}</span>
        {sub && <span className="text-[13px] leading-[18px] text-[#6B7280]">{sub}</span>}
      </span>
      <CheckCircle on={on} multi={multi} />
    </button>
  );
}

/* ---------- recorder ---------- */

function Recorder({ idx, talk, onTalk, flash, onRecording }: { idx: number; talk: Talk; onTalk: (t: Talk) => void; flash: (s: string) => void; onRecording?: (r: boolean) => void }) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [levels, setLevels] = useState<number[]>(Array(18).fill(4));
  const [typing, setTyping] = useState(false);
  const mr = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const raf = useRef<number | null>(null);

  useEffect(() => onRecording?.(rec || busy || typing), [rec, busy, typing, onRecording]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(an);
      const buf = new Uint8Array(an.frequencyBinCount);
      const tick = () => {
        an.getByteFrequencyData(buf);
        setLevels(Array.from({ length: 18 }, (_, i) => 4 + (buf[i + 1] / 255) * 34));
        raf.current = requestAnimationFrame(tick);
      };
      tick();
      const r = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (raf.current) cancelAnimationFrame(raf.current);
        ctx.close();
        await upload(new Blob(chunks, { type: r.mimeType || "audio/webm" }));
      };
      r.start();
      mr.current = r;
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 1), 1000);
      setRec(true);
    } catch {
      flash("No mic access. Type your answer instead.");
      setTyping(true);
    }
  }
  function stop() {
    mr.current?.stop();
    mr.current = null;
    if (timer.current) clearInterval(timer.current);
    setRec(false);
  }
  async function upload(blob: Blob) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, `talk-${idx}.webm`);
      fd.append("idx", String(idx));
      const r = await fetch("/api/funnel/transcribe", { method: "POST", body: fd }).then((r) => r.json());
      onTalk({ text: r.text || MOCK_TALK[idx], file: r.file ?? null, source: r.text ? "voice" : "mock" });
    } catch {
      onTalk({ text: MOCK_TALK[idx], file: null, source: "mock" });
    }
    setBusy(false);
  }

  if (typing) {
    return (
      <div className="flex flex-col gap-3 px-5 pt-5">
        <textarea
          autoFocus
          value={talk.text}
          onChange={(e) => onTalk({ text: e.target.value, file: null, source: "typed" })}
          rows={4}
          placeholder={idx === 0 ? "I make… and … buy it." : "Tell people that…"}
          className="card w-full p-4 text-[16px] leading-6 outline-none focus:shadow-[inset_0_0_0_1.5px_#1E8BFF]"
        />
        <div className="text-center">
          <TextLink onClick={() => setTyping(false)}>Talk instead</TextLink>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 px-5 pt-5">
      <button
        onClick={rec ? stop : start}
        disabled={busy}
        aria-label={rec ? "Stop recording" : "Start recording"}
        className={`btn-blue relative flex h-[96px] w-[96px] items-center justify-center rounded-full ${rec ? "recording" : ""}`}
      >
        {busy ? <span className="spin block h-8 w-8 rounded-full border-[3px] border-white border-t-transparent" /> : <Glyph name={rec ? "stop" : "mic"} size={38} />}
      </button>
      <div className="flex h-10 items-center gap-[3px]">
        {levels.map((h, i) => (
          <span
            key={i}
            className="w-[3px] rounded-full transition-[height] duration-75"
            style={{ height: rec ? h : [8, 14, 22, 12, 18, 10, 26, 14, 9, 20, 12, 16, 8, 22, 10, 14, 8, 12][i], background: rec ? "#1E8BFF" : "#BFDDFF" }}
          />
        ))}
        <span className="w-12 pl-2 text-[14px] font-semibold tabular-nums text-[#111]">0:{String(secs).padStart(2, "0")}</span>
      </div>
      <p className="text-[14px] text-[#6B7280]">{busy ? "Smiley is listening back…" : rec ? "Tap again when you're done" : talk.text ? "Tap to record again" : "Tap the mic and talk for 20 seconds"}</p>
      {talk.text && !rec && !busy && (
        <div className="pop card w-full p-4">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#1E8BFF]">You said{talk.source === "mock" ? " · demo transcript" : ""}</span>
          <p className="mt-1 text-[17px] font-medium leading-[25px]">“{talk.text}”</p>
        </div>
      )}
      <TextLink onClick={() => setTyping(true)}>Type instead</TextLink>
    </div>
  );
}

/* ---------- page ---------- */

export default function Funnel() {
  const [s, setS] = useState<State>(INITIAL);
  const [ready, setReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [paying, setPaying] = useState(false);
  const [recBusy, setRecBusy] = useState(false);
  const [pct, setPct] = useState(4);
  const [burst, setBurst] = useState(0);
  const fast = useRef(false);
  const embed = useRef(false);
  const video = useRef<HTMLVideoElement>(null);

  const flash = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2600);
  }, []);

  const set = useCallback((patch: Partial<State> | ((p: State) => Partial<State>)) => {
    setS((prev) => {
      const next = { ...prev, ...(typeof patch === "function" ? patch(prev) : patch) };
      persist(next);
      return next;
    });
  }, []);

  // Boot: ?reset, ?step=N (prototype jump), ?fast, ?embed, Pine Labs return (?order_id&back).
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    fast.current = q.has("fast");
    embed.current = q.has("embed");
    // Inside the prototype's iPhone frame: leave room for the status bar + dynamic island.
    if (embed.current) document.documentElement.style.setProperty("--top-inset", "58px");
    let st: State = INITIAL;
    if (!q.has("reset")) {
      try {
        st = { ...INITIAL, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
      } catch {}
    }
    if (q.has("step")) {
      const n = Number(q.get("step")) || 1;
      st = mockStateFor(n === SIGNUP ? SIGNUP : Math.min(LAST, Math.max(1, n)));
    }
    if (q.has("demo")) st = { ...st, demo: q.get("demo") !== "0" };
    setS(st);
    persist(st);
    setReady(true);
    const orderId = q.get("order_id");
    if (q.has("back") && orderId) verifyPay(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && embed.current) window.parent?.postMessage({ instabudStep: s.step }, "*");
  }, [s.step, ready]);

  // Script step: draft once.
  useEffect(() => {
    if (ready && s.step === 5 && !s.lines.length) loadScript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, s.step]);

  // Building: poll the pipeline until the first Reel is ready.
  useEffect(() => {
    if (s.step !== 9 || !s.jobId) return;
    let alive = true;
    const t0 = Date.now();
    (async () => {
      while (alive) {
        const job: Job | null = await fetch(`/api/funnel/status?id=${s.jobId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
        if (!alive) return;
        if (job) set({ job });
        const timedOut = Date.now() - t0 > 120_000;
        if ((job?.done && Date.now() - t0 > (fast.current ? 800 : 3500)) || timedOut || !job) {
          setPct(100);
          await new Promise((r) => setTimeout(r, 500));
          set((p) => ({ step: 10, job: job?.done ? job : { ...MOCK_JOB, quote: p.job?.quote ?? MOCK_JOB.quote } }));
          return;
        }
        await new Promise((r) => setTimeout(r, 700));
      }
    })();
    return () => {
      alive = false;
    };
  }, [s.step, s.jobId, set]);

  // Building progress %: done steps + a slow creep inside the active one.
  useEffect(() => {
    if (s.step !== 9) return;
    const t = setInterval(() => {
      const st = s.job?.steps;
      const done = st ? Object.values(st).filter((v) => v === "done").length : 0;
      const floor = done * 25;
      setPct((p) => Math.min(Math.max(p, floor) + (p < floor + 22 ? 1 : 0), 99));
    }, 250);
    return () => clearInterval(t);
  }, [s.step, s.job?.steps]);

  // Your Reel: keep polling while other languages render.
  useEffect(() => {
    if (s.step !== 10 || !s.jobId || !s.job || s.job.id === "mock") return;
    if (!s.job.rendering.length && s.job.langs.every((l) => s.job!.reels[l])) return;
    const t = setTimeout(async () => {
      const job = await fetch(`/api/funnel/status?id=${s.jobId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      if (job) set({ job });
    }, 1200);
    return () => clearTimeout(t);
  }, [s.step, s.job, s.jobId, set]);

  // Autoplay with sound; fall back to muted + "Tap for sound" if the browser blocks it.
  useEffect(() => {
    const v = video.current;
    if (s.step !== 10 || !v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setNeedsTap(true);
      v.play().catch(() => {});
    });
  }, [s.step, s.lang, s.job?.reels?.[s.lang]]);

  // Script: Writer drafts the 6-line intro from onboarding (mock: Sunita's default script).
  async function loadScript(change?: string) {
    const r = await fetch("/api/intro/script", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ texts: s.talks.map((t) => t.text), never: s.never, vibe: s.vibe, change, lines: s.lines }),
    })
      .then((r) => r.json())
      .catch(() => null);
    set({ lines: r?.lines?.length === 6 ? r.lines : DEFAULT_LINES });
    return r;
  }

  // Assemble: 6 shots cut to her voiceover + captions + music, then Guard.
  async function build() {
    setPct(4);
    set({ step: 9, job: null, jobId: null });
    const body = { lines: s.lines.length ? s.lines : DEFAULT_LINES, voice: s.voice, clips: s.clips, demo: s.demo, vibe: s.vibe, never: s.never };
    const job: Job | null = await fetch("/api/intro/build", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
    if (job) set({ jobId: job.id, job, lang: "en" });
    else setTimeout(() => set({ step: 10, job: MOCK_JOB, lang: "en" }), 2500);
  }


  async function pickLang(l: Lang) {
    set({ lang: l });
    setNeedsTap(false);
    const job = s.job;
    if (!job || job.reels[l]) return;
    if (job.id === "mock" || !s.jobId) {
      set({ job: { ...job, reels: { ...job.reels, [l]: DEMO_REEL[l] } } });
      return;
    }
    const j = await fetch("/api/funnel/lang", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: s.jobId, lang: l }) })
      .then((r) => r.json())
      .catch(() => null);
    if (j) set({ job: j });
  }

  const reel = s.job?.reels?.[s.lang] ?? null;
  const caption = s.job?.captions?.[s.lang] ?? s.job?.captions?.en ?? "";

  async function postIt() {
    try {
      await navigator.clipboard.writeText(caption);
    } catch {}
    const cfg = await fetch("/api/funnel/config").then((r) => r.json()).catch(() => ({}));
    if (cfg.instagram && reel) {
      const r = await fetch("/api/publish", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind: "reel", reel, caption, ai: true }) })
        .then((r) => r.json())
        .catch(() => null);
      if (r?.ok) return set({ step: 11, posted: { live: true, permalink: r.permalink } });
    }
    if (reel && !embed.current) {
      const a = document.createElement("a");
      a.href = reel;
      a.download = "my-first-reel.mp4";
      a.click();
    }
    set({ step: 11, posted: { live: false } });
  }

  async function shareWhatsApp() {
    try {
      if (reel && navigator.canShare) {
        const blob = await fetch(reel).then((r) => r.blob());
        const file = new File([blob], "reel.mp4", { type: "video/mp4" });
        if (navigator.canShare({ files: [file] })) return await navigator.share({ files: [file], text: caption });
      }
    } catch {}
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  }

  async function verifyPay(orderId: string) {
    setPaying(true);
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`/api/pay/status?order_id=${encodeURIComponent(orderId)}`).then((r) => r.json()).catch(() => null);
      if (r?.paid) {
        setPaying(false);
        setBurst(Date.now());
        return set({ step: LAST, paid: true });
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    setPaying(false);
    set({ step: 13 });
    flash("Payment didn't go through. Try again?");
  }

  async function pay() {
    setPaying(true);
    const r = await fetch("/api/pay/create", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ plan: s.plan, returnTo: "/" }) })
      .then((r) => r.json())
      .catch(() => null);
    if (r?.redirect_url) {
      window.location.href = r.redirect_url;
      return;
    }
    await new Promise((res) => setTimeout(res, fast.current ? 400 : 1500));
    await verifyPay(r?.order_id ?? "mock-local");
  }

  const back = () => set((p) => ({ step: p.step === 2 ? (p.signedUp ? 1 : SIGNUP) : Math.max(1, p.step - 1) }));
  const week = s.job?.week?.length ? s.job.week : MOCK_WEEK;

  if (!ready) return <Shell>{null}</Shell>;

  /* 1 · Hook */
  if (s.step === 1) {
    const cards = [
      { photo: "saree-shop", r: -11, x: -74, y: 26, h: 230 },
      { photo: "dentist", r: 10, x: 74, y: 30, h: 230 },
      { photo: "home-cook", r: -2, x: 0, y: 0, h: 290 },
    ];
    const team = [
      { name: "Scout", role: "finds ideas", icon: "scout", pos: "left-[14px] top-[18px]", d: "0s" },
      { name: "Writer", role: "writes", icon: "pen", pos: "right-[12px] top-[30px]", d: ".7s" },
      { name: "Editor", role: "edits", icon: "clapper", pos: "left-[10px] bottom-[34px]", d: "1.4s" },
      { name: "Smiley", role: "checks", icon: "smile", pos: "right-[14px] bottom-[22px]", d: "2.1s" },
    ];
    return (
      <Shell bg="linear-gradient(180deg, #A9D8FF 0%, #D6ECFF 42%, #F7F8FA 78%)">
        <I3 name="cloud" size={84} className="bob absolute -left-6 top-[60px] opacity-90" />
        <I3 name="cloud" size={64} className="bob absolute -right-2 top-[26px] opacity-90" style={{ animationDelay: "1s" }} />
        <div className="relative flex items-center justify-center gap-2 px-6 pt-5">
          <I3 name="sparkles" size={26} />
          <span className="text-[24px] font-bold tracking-[-0.03em]">Reels Magic</span>
        </div>
        <div className="relative mx-auto mt-4 h-[372px] w-full max-w-[390px]">
          {/* the Reel the team is working on */}
          <div className="absolute left-1/2 top-[34px] h-[300px] w-0">
            {cards.map((c, k) => (
              <figure
                key={c.photo}
                className="absolute left-0 top-0 overflow-hidden rounded-[22px] border-4 border-white bg-white shadow-[0_18px_40px_rgba(16,24,40,0.2)]"
                style={{ height: c.h, aspectRatio: "9/16", zIndex: k, transform: `translateX(calc(-50% + ${c.x}px)) translateY(${c.y}px) rotate(${c.r}deg)`, opacity: k < 2 ? 0.92 : 1 }}
              >
                <img src={`/demo/photos/${c.photo}.jpg`} alt="" className="h-full w-full object-cover" />
                {k === 2 && (
                  <>
                    <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/45 px-2 py-0.5 text-[11px] font-semibold text-white">
                      <Glyph name="wave" size={11} /> Reel
                    </span>
                    <span className="absolute inset-x-3 bottom-3 rounded-[10px] bg-black/55 px-2 py-1 text-center text-[12px] font-bold leading-4 text-white">Ghar ka khana, office tak</span>
                  </>
                )}
              </figure>
            ))}
          </div>
          {/* the team, doing magic around it */}
          {team.map((t) => (
            <div key={t.name} className={`bob absolute z-10 flex flex-col items-center gap-1 ${t.pos}`} style={{ animationDelay: t.d }}>
              <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white shadow-[0_10px_24px_rgba(16,24,40,0.16)]">
                <I3 name={t.icon} size={36} />
              </span>
              <span className="rounded-full bg-white/95 px-2 py-0.5 text-center text-[11px] leading-[14px] shadow-[0_4px_10px_rgba(16,24,40,0.08)]">
                <b className="font-bold">{t.name}</b> <span className="text-[#6B7280]">{t.role}</span>
              </span>
            </div>
          ))}
          <I3 name="sparkles" size={26} className="bob absolute left-[96px] top-[150px] z-10" style={{ animationDelay: ".3s" }} />
          <I3 name="sparkles" size={20} className="bob absolute right-[92px] top-[118px] z-10" style={{ animationDelay: "1.1s" }} />
          <I3 name="sparkles" size={22} className="bob absolute right-[100px] bottom-[96px] z-10" style={{ animationDelay: "1.8s" }} />
        </div>
        <div className="flex flex-col items-center gap-2 px-7 text-center">
          <h1 className="text-[34px] font-bold leading-[38px]">Post like you have a team.</h1>
          <p className="text-[16px] leading-6 text-[#6B7280]">Because now you do. Your first Reel in 5 minutes.</p>
        </div>
        <div className="flex-1" />
        <div className="px-5 pb-9 pt-6">
          <CTA kind="blue" icon="arrow" onClick={() => set({ step: s.signedUp ? 2 : SIGNUP })}>Meet my team</CTA>
        </div>
        <Toast text={toast} />
      </Shell>
    );
  }

  /* Sign up (name + email), right after the hook */
  if (s.step === SIGNUP) {
    const valid = s.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email.trim());
    const submit = async () => {
      if (!valid) return;
      const body = { name: s.name.trim(), email: s.email.trim().toLowerCase(), source: embed.current ? "prototype" : "funnel" };
      try {
        localStorage.setItem("reelsmagic:signup", JSON.stringify({ ...body, at: new Date().toISOString() }));
      } catch {}
      fetch("/api/signup", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
      set({ signedUp: true, step: 2 });
    };
    return (
      <Shell>
        <div className="flex items-center gap-3 px-5 pt-1">
          <button onClick={() => set({ step: 1 })} aria-label="Back" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
            <Glyph name="back" size={18} color="#111" />
          </button>
        </div>
        <div className="flex flex-col items-center px-7 pt-6 text-center">
          <I3 name="smile" size={84} className="pop" />
          <h1 className="mt-3 text-[28px] font-bold leading-[33px]">Hi! I&apos;m Smiley.</h1>
          <p className="mt-1 text-[15px] leading-[22px] text-[#6B7280]">What should your team call you?</p>
        </div>
        <form
          className="flex flex-col gap-3 px-5 pt-7"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Your name</span>
            <input
              value={s.name}
              onChange={(e) => set({ name: e.target.value })}
              autoComplete="given-name"
              placeholder="Sunita"
              className="card h-14 px-4 text-[16px] outline-none focus:shadow-[inset_0_0_0_1.5px_#1E8BFF]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold">Email</span>
            <input
              value={s.email}
              onChange={(e) => set({ email: e.target.value })}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="card h-14 px-4 text-[16px] outline-none focus:shadow-[inset_0_0_0_1.5px_#1E8BFF]"
            />
          </label>
          <button type="submit" hidden />
        </form>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-6">
          <CTA icon="arrow" disabled={!valid} onClick={submit}>Continue</CTA>
          <span className="text-center text-[12px] leading-4 text-[#9CA3AF]">We only use this to save your Reels. No spam, ever.</span>
        </div>
      </Shell>
    );
  }

  /* 2, 3 · Talk */
  if (s.step === 2 || s.step === 3) {
    const idx = s.step - 2;
    const talk = s.talks[idx];
    const setTalk = (t: Talk) => set((p) => ({ talks: p.talks.map((x, i) => (i === idx ? t : x)) }));
    const showLetter = idx === 0 && !talk.text && !recBusy;
    return (
      <Shell>
        <TopBar step={idx + 1} onBack={back} />
        {showLetter && (
          <div className="pop card relative mx-5 mt-5 overflow-hidden p-5">
            <I3 name="envelope" size={46} className="absolute right-4 top-4 rotate-6" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#1E8BFF]">A note from Smiley</span>
            <h2 className="mt-1 text-[22px] font-bold leading-7">Welcome to Reels Magic</h2>
            <p className="mt-2 pr-6 text-[15px] leading-[22px] text-[#4B5563]">
              {s.name ? `Hi ${s.name.split(" ")[0]}! ` : "Hi! "}I&apos;m Smiley. No camera, no editing. Just tell me about your work, the way you&apos;d tell a friend. I&apos;ll turn it into your first Reel, in your own voice.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <I3 name="smile" size={26} />
              <span className="script text-[28px] leading-none text-[#111]">Smiley</span>
            </div>
          </div>
        )}
        <div className="flex items-start gap-3 px-6 pt-6">
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[13px] font-semibold text-[#6B7280]">Smiley asks · {idx + 1} of 2</span>
            <h1 className="text-[28px] font-bold leading-[33px]">{idx === 0 ? "Tell me what you make and who buys it." : "What should your first Reel say?"}</h1>
          </div>
          <I3 name={idx === 0 ? "cooking" : "clapper"} size={52} className="mt-5" />
        </div>
        <Recorder key={idx} idx={idx} talk={talk} onTalk={setTalk} flash={flash} onRecording={setRecBusy} />
        <div className="flex-1" />
        {idx === 1 && (
          <div className="px-5 pb-3">
            <OptionRow icon="studio-mic" title="Use my voice for my Reels" sub="Only for your posts. Delete anytime." on={s.consent} onClick={() => set({ consent: !s.consent })} multi />
          </div>
        )}
        <div className="px-5 pb-9 pt-2">
          <CTA icon="arrow" disabled={!talk.text.trim()} onClick={() => set({ step: s.step + 1 })}>Continue</CTA>
        </div>
        <Toast text={toast} />
      </Shell>
    );
  }

  /* 4 · Quick taps */
  if (s.step === 4) {
    const toggle = (key: "never" | "langs", v: string) =>
      set((p) => {
        const cur = p[key] as string[];
        const next = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v];
        return { [key]: key === "langs" && !next.length ? cur : next } as Partial<State>;
      });
    return (
      <Shell>
        <TopBar step={3} onBack={back} />
        <div className="px-6 pt-6">
          <h1 className="text-[28px] font-bold leading-[33px]">Never show in my posts</h1>
          <p className="mt-1 text-[15px] text-[#6B7280]">Guard checks every post against these.</p>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pt-4">
          {NEVER.map((n) => (
            <OptionRow key={n.id} icon={n.icon} title={n.id} sub={n.sub} on={s.never.includes(n.id)} onClick={() => toggle("never", n.id)} multi />
          ))}
        </div>
        <div className="flex items-center gap-2 px-6 pt-6">
          <I3 name="globe" size={26} />
          <h2 className="text-[20px] font-bold">My viewers speak</h2>
        </div>
        <div className="flex flex-wrap gap-2 px-5 pt-3">
          {LANGS.map((l) => {
            const on = s.langs.includes(l.id);
            return (
              <button
                key={l.id}
                onClick={() => toggle("langs", l.id)}
                aria-pressed={on}
                className="flex items-center gap-1.5 rounded-full px-4 py-2.5 text-[15px] font-semibold transition"
                style={{ background: on ? "#EAF4FF" : "#FFFFFF", color: on ? "#0B6BD3" : "#111", boxShadow: on ? "inset 0 0 0 1.5px #1E8BFF" : "0 4px 12px rgba(16,24,40,0.06)" }}
              >
                {on && <Glyph name="check" size={14} color="#1E8BFF" />}
                {l.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2 px-6 pt-6">
          <I3 name="clapper" size={26} />
          <h2 className="text-[20px] font-bold">Reel vibe</h2>
        </div>
        <div className="grid grid-cols-3 gap-2 px-5 pt-3">
          {VIBE_OPTS.map((v) => {
            const on = s.vibe === v.id;
            return (
              <button
                key={v.id}
                onClick={() => set({ vibe: v.id })}
                aria-pressed={on}
                className="flex flex-col items-center gap-1.5 rounded-[18px] px-2 py-3 text-center"
                style={{ background: on ? "#EAF4FF" : "#FFFFFF", boxShadow: on ? "inset 0 0 0 1.5px #1E8BFF" : "0 8px 24px rgba(16,24,40,0.06)" }}
              >
                <I3 name={v.icon} size={34} />
                <span className="text-[13px] font-semibold leading-4">{v.title}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="px-5 pb-9 pt-6">
          <CTA icon="arrow" onClick={() => set({ step: 5 })}>Continue</CTA>
        </div>
      </Shell>
    );
  }

  /* 5 · Script (text only) */
  if (s.step === 5) {
    const lines = s.lines;
    const secs = lines.map((l) => Math.max(4, Math.round(l.split(/\s+/).length / 2.6)));
    return (
      <Shell>
        <TopBar step={1} total={4} onBack={back} />
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex-1">
            <span className="text-[13px] font-semibold text-[#1E8BFF]">Writer · from what you told Smiley</span>
            <h1 className="text-[28px] font-bold leading-[33px]">Your intro Reel script</h1>
            <p className="mt-1 text-[15px] text-[#6B7280]">6 lines · about {secs.reduce((a, b) => a + b, 0) || 50} seconds</p>
          </div>
          <I3 name="pen" size={50} className="mt-3" />
        </div>
        {!lines.length ? (
          <div className="flex flex-1 items-center justify-center">
            <span className="spin block h-8 w-8 rounded-full border-[3px] border-[#1E8BFF] border-t-transparent" />
          </div>
        ) : (
          <div className="card mx-5 mt-4 flex flex-col divide-y divide-[#F1F2F4] px-4">
            {lines.map((l, i) => (
              <div key={i} className="pop flex gap-3 py-3" style={{ animationDelay: `${i * 70}ms` }}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF] text-[12px] font-bold text-[#1E8BFF]">{i + 1}</span>
                <p className="flex-1 text-[15px] leading-[22px]">{l}</p>
                <span className="shrink-0 pt-0.5 text-[12px] tabular-nums text-[#9CA3AF]">{secs[i]}s</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex-1" />
        <div className="px-5 pb-9 pt-5">
          <CTA icon="mic" disabled={!lines.length} onClick={() => set({ step: 6, voiceTaken: false })}>Record it in my voice</CTA>
        </div>
      </Shell>
    );
  }

  /* 6 · Record voiceover */
  if (s.step === 6) {
    const change = async (kind: "good" | "shorter" | "phone") => {
      if (kind === "good") return flash("Great. Now let's shoot 6 quick clips.");
      await loadScript(kind);
      flash(kind === "shorter" ? "Made it shorter. Record again to match?" : "Added your number to the last line.");
    };
    return (
      <Shell>
        <TopBar step={2} total={4} onBack={back} />
        <div className="px-6 pt-5">
          <h1 className="text-[26px] font-bold leading-[31px]">{s.voiceTaken ? "Want to change anything?" : "Read it out, slowly"}</h1>
          <p className="mt-1 text-[15px] text-[#6B7280]">{s.voiceTaken ? "Your take is saved. This is your Reel's voice." : "Your voice becomes the Reel's voiceover. One take is fine."}</p>
        </div>
        {s.voiceTaken ? (
          <>
            <div className="flex flex-wrap gap-2 px-5 pt-5">
              {[
                { k: "good" as const, t: "Sounds good", i: "check" },
                { k: "shorter" as const, t: "Make it shorter", i: "sparkles" },
                { k: "phone" as const, t: "Add my phone number", i: "phone" },
              ].map((c) => (
                <button key={c.k} onClick={() => change(c.k)} className="flex items-center gap-1.5 rounded-full bg-white px-3.5 py-2.5 text-[15px] font-semibold shadow-[0_4px_12px_rgba(16,24,40,0.06)] active:scale-[0.98]">
                  <I3 name={c.i} size={20} /> {c.t}
                </button>
              ))}
            </div>
            <div className="card mx-5 mt-4 flex flex-col gap-2 p-4">
              {s.lines.map((l, i) => (
                <p key={i} className="text-[14px] leading-5 text-[#4B5563]">
                  <b className="text-[#111]">{i + 1}.</b> {l}
                </p>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-5">
              <CTA kind="blue" icon="arrow" onClick={() => set({ step: 7 })}>Let&apos;s shoot</CTA>
              <TextLink onClick={() => set({ voiceTaken: false, voice: null })}>Record again</TextLink>
            </div>
          </>
        ) : (
          <>
            <VoiceTeleprompter lines={s.lines.length ? s.lines : DEFAULT_LINES} taken={s.voiceTaken} flash={flash} onTake={(file) => set({ voice: file, voiceTaken: true })} />
            <div className="-mt-3 pb-5 text-center">
              <TextLink onClick={() => set({ voice: null, voiceTaken: true })}>Skip, use Smiley&apos;s voice for now</TextLink>
            </div>
          </>
        )}
        <Toast text={toast} />
      </Shell>
    );
  }

  /* 7 · Shot list */
  if (s.step === 7) {
    return (
      <Shell>
        <TopBar step={3} total={4} onBack={back} />
        <div className="flex items-start gap-3 px-6 pt-5">
          <div className="flex-1">
            <h1 className="text-[28px] font-bold leading-[33px]">6 quick shots</h1>
            <p className="mt-1 text-[15px] text-[#6B7280]">About 8 seconds each. Hands only, in your kitchen.</p>
          </div>
          <I3 name="camera" size={52} className="mt-1" />
        </div>
        <div className="flex flex-col gap-2.5 px-5 pt-4 pb-4">
          {SHOTS.map((sh, i) => (
            <div key={i} className="card flex gap-3 p-2.5">
              <div className="relative h-[104px] w-[60px] shrink-0 overflow-hidden rounded-[12px] bg-[#111]">
                <img src={refUrl(i)} alt="" className="kenburns h-full w-full object-cover" style={{ animationDelay: `${i * -1.3}s` }} />
                {s.clips[i] && <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-[18px] text-white">✓</span>}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1 py-0.5">
                <span className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#1E8BFF]">Shot {i + 1} · {sh.seconds} sec</span>
                <p className="text-[15px] font-semibold leading-5">{sh.hinglish}</p>
                <p className="line-clamp-2 text-[12px] leading-4 text-[#9CA3AF]">“{(s.lines[i] ?? DEFAULT_LINES[i])}”</p>
              </div>
            </div>
          ))}
        </div>
        <div className="sticky bottom-0 mt-auto bg-gradient-to-t from-[#F7F8FA] via-[#F7F8FA] to-transparent px-5 pb-8 pt-6">
          <CTA kind="blue" icon="arrow" onClick={() => set({ step: 8, shot: s.clips.findIndex((c) => !c) < 0 ? 0 : s.clips.findIndex((c) => !c) })}>
            Start shot {(s.clips.findIndex((c) => !c) < 0 ? 0 : s.clips.findIndex((c) => !c)) + 1}
          </CTA>
        </div>
      </Shell>
    );
  }

  /* 8 · Shoot (live camera, one shot at a time) */
  if (s.step === 8) {
    return (
      <ShootScreen
        idx={s.shot}
        demo={s.demo}
        onBack={() => set({ step: 7 })}
        onSaved={(i, file) => set((p) => ({ clips: p.clips.map((c, k) => (k === i ? file ?? "local" : c)) }))}
        onNext={() => (s.shot >= SHOTS.length - 1 ? build() : set({ shot: s.shot + 1 }))}
      />
    );
  }

  /* 9 · Building */
  if (s.step === 9) {
    const job = s.job;
    const st = job?.steps ?? { writer: "active", voice: "todo", designer: "todo", guard: "todo" };
    const quote = job?.quote ?? s.talks[0].text.slice(0, 60);
    const rows = [
      { key: "writer" as const, name: "Writer", icon: "pen", text: `Your script: “${(s.lines[0] ?? quote).slice(0, 48)}”` },
      { key: "voice" as const, name: "Voice", icon: "studio-mic", text: st.voice === "done" ? (s.voice ? "Using your recording" : "Voiceover ready") : "Cleaning up your voice…" },
      { key: "designer" as const, name: "Designer", icon: "art", text: st.designer === "done" ? "Reel ready, 9:16" : "Cutting your 6 shots to your voice" },
      { key: "guard" as const, name: "Guard", icon: "shield", text: st.guard === "done" ? (s.never.length ? `No ${s.never.join(", no ").toLowerCase()}. All good.` : "All good") : "Checking your rules" },
    ];
    const activeRow = rows.find((r) => st[r.key] === "active") ?? rows[rows.length - 1];
    return (
      <Shell>
        <div className="flex flex-col items-center px-6 pt-6 text-center">
          <h1 className="text-[28px] font-bold leading-[33px]">We&apos;re setting everything up for you</h1>
          <p className="mt-1.5 text-[15px] text-[#6B7280]">{activeRow.key === "designer" ? "Adding captions and music…" : activeRow.text}</p>
        </div>
        <div className="card relative mx-5 mt-5 h-[190px] overflow-hidden" style={{ background: "linear-gradient(180deg, #EAF4FF 0%, #FFFFFF 100%)" }}>
          <I3 name="cooking" size={88} className="bob absolute left-[30px] top-[58px]" style={{ ["--r" as string]: "-8deg" }} />
          <I3 name="studio-mic" size={100} className="bob absolute left-[calc(50%-50px)] top-[30px]" style={{ animationDelay: ".6s" }} />
          <I3 name="sparkles" size={68} className="bob absolute right-[30px] top-[66px]" style={{ animationDelay: "1.2s" }} />
          <div className="scan absolute inset-x-0 top-0 h-10" style={{ background: "linear-gradient(180deg, #1E8BFF00 0%, #4FB3FF55 50%, #1E8BFF00 100%)" }} />
          <div className="scan absolute inset-x-0 top-[20px] h-[2px] bg-[#4FB3FF]" />
        </div>
        <div className="mx-5 mt-4 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#E5E7EB]">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1E8BFF,#4FB3FF)" }} />
          </div>
          <span className="w-10 text-right text-[14px] font-semibold tabular-nums">{pct}%</span>
        </div>
        <div className="card mx-5 mt-4 flex flex-col divide-y divide-[#F1F2F4] px-4">
          {rows.map((r) => {
            const state = st[r.key];
            return (
              <div key={r.key} className="flex items-center gap-3 py-3" style={{ opacity: state === "todo" ? 0.45 : 1 }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4F6]">
                  <I3 name={r.icon} size={26} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[15px] font-semibold leading-5">{r.name}</span>
                  <span className="line-clamp-1 text-[13px] leading-[18px] text-[#6B7280]">{state === "todo" ? "Waiting" : r.text}</span>
                </span>
                {state === "done" ? (
                  <CheckCircle on />
                ) : state === "active" ? (
                  <span className="spin block h-5 w-5 rounded-full border-[2.5px] border-[#1E8BFF] border-t-transparent" />
                ) : (
                  <CheckCircle on={false} />
                )}
              </div>
            );
          })}
        </div>
        <div className="flex-1" />
        <p className="px-8 pb-10 pt-4 text-center text-[13px] leading-5 text-[#6B7280]">
          <b className="text-[#111]">Smiley&apos;s tip:</b> Reels that open with what customers say get saved more.
        </p>
      </Shell>
    );
  }

  /* 6 · Your Reel */
  if (s.step === 10) {
    const job = s.job ?? MOCK_JOB;
    const loading = !reel || job.rendering?.includes(s.lang);
    const ordered = [...LANGS].sort((a, b) => Number(job.langs.includes(b.id)) - Number(job.langs.includes(a.id)));
    return (
      <Shell>
        <div className="flex items-center gap-3 px-5 pb-1">
          <button onClick={back} aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_2px_8px_rgba(16,24,40,0.06)]">
            <Glyph name="back" size={18} color="#111" />
          </button>
          <div className="flex-1">
            <h1 className="text-[22px] font-bold leading-7">
              Your first Reel{job.duration ? ` · ${Math.floor(job.duration / 60)}:${String(job.duration % 60).padStart(2, "0")}` : ""}
            </h1>
            <p className="text-[13px] text-[#6B7280]">Your words, your voice, your kitchen</p>
          </div>
          <I3 name="party" size={34} />
        </div>
        <div className="flex justify-center gap-1.5 px-5 pb-1 pt-1">
          {[
            { t: "In your voice", i: "studio-mic" },
            { t: "Your kitchen", i: "camera" },
            { t: "Safe", i: "shield" },
          ].map((c) => (
            <span key={c.t} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold shadow-[0_4px_12px_rgba(16,24,40,0.06)]">
              <I3 name={c.i} size={16} /> {c.t}
            </span>
          ))}
        </div>
        <div className="relative mx-auto mt-2">
          {loading ? (
            <div className="flex h-[396px] items-center justify-center rounded-[26px] bg-[#111]" style={{ aspectRatio: "9/16" }}>
              <span className="spin block h-8 w-8 rounded-full border-[3px] border-[#4FB3FF] border-t-transparent" />
            </div>
          ) : (
            <video
              ref={video}
              key={reel!}
              src={reel!}
              autoPlay
              playsInline
              loop
              onClick={(e) => {
                const v = e.currentTarget;
                v.muted = false;
                setNeedsTap(false);
                v.paused ? v.play() : v.pause();
              }}
              className="h-[396px] rounded-[26px] bg-[#111] object-cover shadow-[0_22px_48px_rgba(16,24,40,0.22)]"
              style={{ aspectRatio: "9/16" }}
            />
          )}
          {needsTap && !loading && (
            <button
              onClick={() => {
                if (video.current) {
                  video.current.muted = false;
                  video.current.play();
                }
                setNeedsTap(false);
              }}
              className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold"
            >
              <Glyph name="sound" size={15} color="#111" /> Tap for sound
            </button>
          )}
        </div>
        <div className={`no-scrollbar mt-3 gap-1.5 overflow-x-auto px-5 ${job.langs.length > 1 ? "flex" : "hidden"}`}>
          {ordered.map((l) => {
            const on = s.lang === l.id;
            const busy = job.rendering?.includes(l.id) || (on && !job.reels[l.id]);
            return (
              <button
                key={l.id}
                onClick={() => pickLang(l.id)}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[14px] font-semibold"
                style={{ background: on ? "#111" : "#FFFFFF", color: on ? "#FFF" : job.reels[l.id] ? "#111" : "#9CA3AF", boxShadow: on ? "none" : "0 4px 12px rgba(16,24,40,0.06)" }}
              >
                {busy && <span className="spin block h-3 w-3 rounded-full border-2 border-current border-t-transparent" />}
                {l.label}
              </button>
            );
          })}
        </div>
        <div className="card mx-5 mt-3 px-4 py-3">
          <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#6B7280]">Caption</span>
          <p className="line-clamp-2 whitespace-pre-line text-[14px] leading-5">{caption}</p>
        </div>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-4">
          <CTA kind="blue" icon="ig" onClick={postIt} disabled={loading}>Post it free</CTA>
          <TextLink onClick={shareWhatsApp}>Share to WhatsApp Status</TextLink>
        </div>
        <Toast text={toast} />
      </Shell>
    );
  }

  /* 7 · Live + locked week */
  if (s.step === 11) {
    const live = s.posted?.live;
    return (
      <Shell>
        <div className="flex flex-col items-center gap-1.5 px-7 pt-4 text-center">
          <I3 name="party" size={84} className="pop" />
          <h1 className="text-[32px] font-bold leading-9">{live ? "It's live!" : "Ready to post!"}</h1>
          <p className="text-[15px] leading-[22px] text-[#6B7280]">
            {live ? "Your first Reel is on Instagram." : "Reel downloaded, caption copied. Open Instagram, pick the video, paste."}
          </p>
          <div className="mt-1 flex gap-5">
            {live && s.posted?.permalink ? (
              <TextLink href={s.posted.permalink}>View on Instagram</TextLink>
            ) : (
              <>
                {reel && (
                  <a href={reel} download className="flex items-center gap-1 text-[15px] font-semibold text-[#1E8BFF]">
                    <Glyph name="download" size={15} color="#1E8BFF" /> Download again
                  </a>
                )}
                <TextLink href="https://www.instagram.com/">Open Instagram</TextLink>
              </>
            )}
          </div>
        </div>
        <section className="mt-6 px-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[20px] font-bold">Your week is ready</h2>
            <span className="text-[13px] font-medium text-[#6B7280]">4 posts drafted</span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            {week.slice(0, 4).map((d, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="relative h-[88px] overflow-hidden">
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: COVERS[i] }}>
                    <I3 name={DRAFT_ICON[d.format] ?? "camera"} size={56} />
                  </div>
                  <span className="absolute right-2 top-2 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-[#1E8BFF]">Drafted</span>
                </div>
                <div className="px-3 py-2.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{d.day.slice(0, 3)} · {d.format}</span>
                  <p className="line-clamp-2 text-[14px] font-semibold leading-[18px]">{d.title}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <div className="flex-1" />
        <div className="px-5 pb-9 pt-5">
          <CTA kind="blue" icon="arrow" onClick={() => set({ step: LAST, paid: true })}>See my week</CTA>
        </div>
      </Shell>
    );
  }

  /* 8 · Reminder promise */
  if (s.step === 12) {
    return (
      <Shell>
        <TopBar step={1} total={2} onBack={back} />
        <div className="flex flex-col items-center px-7 pt-5 text-center">
          <I3 name="calendar" size={92} className="pop" />
          <h1 className="mt-2 text-[28px] font-bold leading-[33px]">We&apos;ll remind you before your trial ends</h1>
          <p className="mt-1.5 text-[15px] text-[#6B7280]">No surprise charges. Ever.</p>
        </div>
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-[22px] bg-white/80 p-3.5 shadow-[0_12px_30px_rgba(16,24,40,0.10)] backdrop-blur">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px] bg-[#EAF4FF]">
            <I3 name="smile" size={28} />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="flex justify-between text-[13px]">
              <b>Reels Magic</b>
              <span className="text-[#9CA3AF]">now</span>
            </span>
            <span className="text-[14px] font-semibold leading-5">Your Reels Magic trial ends soon</span>
            <span className="text-[13px] leading-[18px] text-[#4B5563]">
              Ends in {s.remindDays} day{s.remindDays > 1 ? "s" : ""}. Keep posting for ₹299/month, or cancel in one tap.
            </span>
          </span>
        </div>
        <div className="flex flex-col gap-2.5 px-5 pt-5">
          {[1, 2, 3].map((d) => (
            <OptionRow key={d} icon="bell" title={`${d} day${d > 1 ? "s" : ""} before`} on={s.remindDays === d} onClick={() => set({ remindDays: d })} />
          ))}
        </div>
        <div className="flex-1" />
        <div className="px-5 pb-9 pt-5">
          <CTA icon="arrow" onClick={() => set({ step: 13 })}>Continue</CTA>
        </div>
      </Shell>
    );
  }

  /* 9 · Paywall */
  if (s.step === 13) {
    const remindDay = 7 - s.remindDays;
    const timeline = [
      { icon: "unlock", title: "Today", text: "Unlock your week: 4 posts already drafted" },
      { icon: "bell", title: `Day ${remindDay}`, text: "We remind you before the trial ends" },
      { icon: "check", title: "Day 7", text: "₹299/month starts. Cancel anytime before." },
    ];
    const plans = [
      { id: "trial" as const, title: "7-day trial", price: "₹1", note: "then ₹299/month", badge: "Most popular" },
      { id: "starter" as const, title: "30 days", price: "₹99", note: "one-time, no renewal" },
    ];
    return (
      <Shell>
        <TopBar step={2} total={2} onBack={back} />
        <div className="px-6 pt-5">
          <h1 className="text-[30px] font-bold leading-[35px]">Unlock your week</h1>
          <p className="mt-1 text-[15px] text-[#6B7280]">Your 4 posts are drafted and waiting.</p>
        </div>
        <div className="mx-6 mt-5 flex flex-col">
          {timeline.map((t, i) => (
            <div key={t.title} className="flex gap-3.5">
              <div className="flex flex-col items-center">
                <span className="flex h-9 w-9 items-center justify-center rounded-full" style={{ background: i === 0 ? "linear-gradient(90deg,#1E8BFF,#4FB3FF)" : "#EAF4FF" }}>
                  <Glyph name={t.icon} size={17} color={i === 0 ? "#FFFFFF" : i === 1 ? "#1E8BFF" : "#9CA3AF"} />
                </span>
                {i < timeline.length - 1 && <span className="my-1 w-[3px] flex-1 rounded-full" style={{ background: i === 0 ? "#4FB3FF" : "#DCEBFA", minHeight: 22 }} />}
              </div>
              <div className="pb-4 pt-1">
                <div className="text-[16px] font-bold leading-5">{t.title}</div>
                <div className="text-[14px] leading-5 text-[#6B7280]">{t.text}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2.5 px-5 pt-2">
          {plans.map((p) => {
            const on = s.plan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => set({ plan: p.id })}
                aria-pressed={on}
                className="relative flex flex-col items-start rounded-[20px] p-3.5 text-left"
                style={{ background: on ? "#EAF4FF" : "#FFFFFF", boxShadow: on ? "inset 0 0 0 1.5px #1E8BFF" : "0 8px 24px rgba(16,24,40,0.06)" }}
              >
                {p.badge && <span className="absolute -top-2.5 left-3 rounded-full bg-[#111] px-2 py-0.5 text-[11px] font-semibold text-white">{p.badge}</span>}
                <span className="flex w-full items-center justify-between">
                  <span className="text-[14px] font-semibold">{p.title}</span>
                  <CheckCircle on={on} />
                </span>
                <span className="mt-1 text-[26px] font-bold leading-8">{p.price}</span>
                <span className="text-[12px] text-[#6B7280]">{p.note}</span>
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-2.5 px-5 pb-8 pt-5">
          <CTA kind="blue" icon="unlock" onClick={pay} disabled={paying}>
            {paying ? "Opening Pine Labs…" : s.plan === "trial" ? "Start for ₹1" : "Start for ₹99"}
          </CTA>
          <span className="text-center text-[12px] leading-4 text-[#9CA3AF]">
            {s.plan === "trial" ? "Then ₹299/month · Cancel anytime · " : "No auto-renewal · "}Secured by Pine Labs
          </span>
        </div>
        <Toast text={toast} />
      </Shell>
    );
  }

  /* 10 · Unlocked: first-week checklist */
  const next = week[0];
  const tasks = [
    { icon: "check", title: "Post your first Reel", sub: "Done today" },
    { icon: "camera", title: `Make ${next.day}'s ${/paratha/i.test(next.title) ? "paratha " : ""}${next.format}`, sub: `${next.day} ${next.time} · ${next.title}` },
    { icon: "flatbread", title: "Add 3 photos", sub: "Kitchen, hands, finished dish" },
    { icon: "phone", title: "Connect Instagram", sub: "Post with one tap next time" },
    { icon: "speaking", title: "Share to WhatsApp", sub: "Your first customers are there" },
  ];
  const claim = () => {
    set({ claimed: true });
    setBurst(Date.now());
  };
  return (
    <Shell>
      {burst > 0 && (
        <div key={burst} className="pointer-events-none absolute left-1/2 top-[190px] z-40" aria-hidden>
          {Array.from({ length: 18 }).map((_, i) => (
            <span
              key={i}
              className="confetti absolute block h-2.5 w-2.5 rounded-[3px]"
              style={{ background: ["#1E8BFF", "#FFD84D", "#FF9EC0", "#7FD6A4", "#4FB3FF"][i % 5], ["--x" as string]: `${Math.cos(i) * (80 + (i % 4) * 30)}px`, ["--y" as string]: `${Math.sin(i * 1.7) * 90 + 60}px` }}
            />
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 px-6 pt-4">
        <div className="flex-1">
          <span className="text-[14px] font-semibold text-[#1F9D57]">Your first Reel is out.</span>
          <h1 className="text-[30px] font-bold leading-[35px]">Let&apos;s make it a habit</h1>
        </div>
        <I3 name="party" size={60} />
      </div>
      <div className="card mx-5 mt-4 p-4">
        <div className="flex items-center justify-between">
          <span className="text-[16px] font-bold">Your first week</span>
          <span className="text-[14px] font-semibold text-[#1E8BFF]">1/5</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#E5E7EB]">
          <div className="h-full w-1/5 rounded-full" style={{ background: "linear-gradient(90deg,#1E8BFF,#4FB3FF)" }} />
        </div>
        <div className="mt-2 flex flex-col divide-y divide-[#F1F2F4]">
          {tasks.map((t, i) => (
            <div key={t.title} className="flex items-center gap-3 py-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[#F3F4F6]">
                <I3 name={t.icon} size={28} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className={`text-[15px] font-semibold leading-5 ${i === 0 ? "text-[#6B7280] line-through decoration-[#9CA3AF]" : ""}`}>{t.title}</span>
                <span className="line-clamp-1 text-[13px] leading-[18px] text-[#6B7280]">{t.sub}</span>
              </span>
              {i === 0 ? (
                s.claimed ? (
                  <span className="rounded-full bg-[#E8F7EE] px-2.5 py-1 text-[12px] font-semibold text-[#1F9D57]">+1 claimed</span>
                ) : (
                  <button onClick={claim} className="rounded-full bg-[#EAF4FF] px-3 py-1.5 text-[13px] font-semibold text-[#1E8BFF]">
                    Claim +1
                  </button>
                )
              ) : (
                <CheckCircle on={false} />
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="flex-1" />
      <div className="px-5 pb-9 pt-5">
        <CTA icon="arrow" onClick={() => flash(`Smiley will remind you ${next.day} at ${next.time}. The draft is ready.`)}>
          Make {next.day}&apos;s post
        </CTA>
      </div>
      <Toast text={toast} />
    </Shell>
  );
}
