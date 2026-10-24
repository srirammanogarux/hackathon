"use client";

// Reels Magic onboarding: "Meet your team" group chat (Paper artboard 6B3-0) + sign-up.
// Every screen reads ctx.s, writes answers with ctx.set and moves on with ctx.next()/ctx.go().

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import type { RMCtx, RMState, StepId } from "./types";

export const ONBOARDING_STEPS = [
  "meet",
  "signup",
  "why",
  "niche",
  "more",
  "audience",
  "experience",
  "languages",
  "never",
  "warmup",
  "script",
  "read",
  "change",
] as const satisfies readonly StepId[];

type OnbStep = (typeof ONBOARDING_STEPS)[number];

/* ---------- tokens (from Paper) ---------- */

const INK = "#0B0F19";
const MUTED = "#6B7280";
const BLUE = "#1E8BFF";
const BLUE_TEXT = "#1E6FD9";
const BLUE_BG = "#EAF4FF";
const LINE = "#EEF0F3";
const PAGE = "#F7F8FA";
const TOP = "max(env(safe-area-inset-top), var(--top-inset, 14px))";

const AGENTS = {
  smiley: { name: "Smiley", img: "/rm/smiley.png", bg: "#EAF4FF" },
  scout: { name: "Scout", img: "/rm/scout.png", bg: "#FFF4E5" },
  writer: { name: "Writer", img: "/rm/writer.png", bg: "#EAF8EE" },
  editor: { name: "Editor", img: "/rm/editor.png", bg: "#FDEDF3" },
} as const;
type Who = keyof typeof AGENTS;

/* ---------- demo persona defaults (Sunita, tiffins in Gomti Nagar) ---------- */

const D = {
  why: "Get more customers & orders",
  niche: "Food & cooking",
  more: ["Lunch tiffins", "Home-style thali"],
  location: "Gomti Nagar, Lucknow",
  audience: "Offices within 3 km",
  experience: "Never",
  time: "10 min a day",
  langs: ["English", "Hindi"],
  style: "Hands only",
  never: ["My face", "My home & address", "My family"],
};

const MOCK_WARMUP = {
  text: "I'm Sunita. I make fresh home-style tiffins in Gomti Nagar…",
  file: null,
  source: "mock" as const,
};

const PAPER_LINES = [
  "Bored of the same office lunch every day?",
  "I'm Sunita, and every morning I make fresh, home-style tiffins right here in my kitchen in Gomti Nagar.",
  "Aloo parathas made by hand, cooked in real ghee — still soft when you open your tiffin at lunch.",
  "Fresh dal and seasonal sabzi every single day. No leftovers, no shortcuts.",
  "Everything is packed hot in steel tiffins, so it tastes just like home.",
  "WhatsApp me before 11 and your lunch reaches your office by 1. Follow for today's menu!",
];

function vals(s: RMState) {
  return {
    why: s.why ?? D.why,
    niche: s.niche ?? D.niche,
    more: s.more.length ? s.more : D.more,
    location: s.location || D.location,
    audience: s.audience ?? D.audience,
    experience: s.experience ?? D.experience,
    time: s.time ?? D.time,
    langs: s.langs.length ? s.langs : D.langs,
    style: s.style ?? D.style,
  };
}
const firstName = (s: RMState) => s.name.trim().split(/\s+/)[0] || "";
const scriptLines = (s: RMState) => (s.lines.length ? s.lines : PAPER_LINES);
const fmt = (secs: number) => `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, "0")}`;

// The last voiceover take, kept for playback on the "change" screen (same tab only).
const LAST_TAKE: { url: string | null; secs: number } = { url: null, secs: 0 };

/* ---------- icons ---------- */

function Check({ size = 14, color = "#FFFFFF", w = 3.5 }: { size?: number; color?: string; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d="M5 12l5 5L20 7" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Arrow() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Mic({ size = 20, color = BLUE, w = 2.2 }: { size?: number; color?: string; w?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke={color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function Play({ color = BLUE }: { color?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden className="shrink-0">
      <path d="M7 4v16l13-8z" fill={color} />
    </svg>
  );
}
function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`spin block h-5 w-5 shrink-0 rounded-full border-[2.5px] ${dark ? "border-[#1E8BFF]" : "border-white"}`}
      style={{ borderTopColor: "transparent" }}
    />
  );
}
function Img({ src, size }: { src: string; size: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} draggable={false} className="shrink-0 select-none" style={{ width: size, height: size }} />;
}

/* ---------- recording helpers ---------- */

function useRecorder() {
  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const chunks = useRef<Blob[]>([]);

  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    rec.current = null;
  }

  async function start(): Promise<boolean> {
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return false;
    let st: MediaStream;
    try {
      st = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return false;
    }
    const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) => MediaRecorder.isTypeSupported?.(t));
    const r = new MediaRecorder(st, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.current.push(e.data);
    };
    r.start(250);
    stream.current = st;
    rec.current = r;
    return true;
  }

  function stop(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const r = rec.current;
      if (!r || r.state === "inactive") {
        release();
        resolve(null);
        return;
      }
      r.onstop = () => {
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        release();
        resolve(blob);
      };
      r.stop();
    });
  }

  useEffect(
    () => () => {
      if (rec.current && rec.current.state !== "inactive") rec.current.stop();
      release();
    },
    [],
  );

  return { start, stop };
}

function useTicker(on: boolean) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!on) return;
    setSecs(0);
    const t = setInterval(() => setSecs((x) => x + 0.25), 250);
    return () => clearInterval(t);
  }, [on]);
  return secs;
}

async function transcribe(blob: Blob, name: string, idx: string): Promise<{ text?: string | null; file?: string | null }> {
  const fd = new FormData();
  fd.append("audio", blob, name);
  fd.append("idx", idx);
  const r = await fetch("/api/funnel/transcribe", { method: "POST", body: fd });
  if (!r.ok) throw new Error(`transcribe ${r.status}`);
  return r.json();
}

/* ---------- chat primitives ---------- */

function Header({ ctx }: { ctx: RMCtx }) {
  const order: Who[] = ["smiley", "scout", "writer", "editor"];
  return (
    <div className="flex shrink-0 items-center gap-3 border-b bg-white px-4 pb-3 pt-1" style={{ borderColor: LINE }}>
      <button
        type="button"
        onClick={ctx.back}
        aria-label="Back"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
        style={{ background: LINE }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
          <path d="M15 5l-7 7 7 7" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="relative h-[34px] w-[104px] shrink-0">
        {order.map((k, i) => (
          <div
            key={k}
            className="absolute top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white"
            style={{ left: i * 23, background: AGENTS[k].bg }}
          >
            <Img src={AGENTS[k].img} size={22} />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-[17px] font-bold leading-[22px]" style={{ color: INK }}>
          Your team
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-[7px] w-[7px] shrink-0 rounded-full bg-[#22C55E]" />
          <span className="text-[13px] leading-4" style={{ color: MUTED }}>
            4 agents · online
          </span>
        </div>
      </div>
    </div>
  );
}

function Composer() {
  return (
    <div className="flex items-center gap-2.5" aria-hidden>
      <div className="flex h-11 flex-1 items-center rounded-full border border-[#E5E7EB] bg-white px-4">
        <span className="text-[15px] leading-5 text-[#9CA3AF]">Type a message</span>
      </div>
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" style={{ background: BLUE_BG }}>
        <Mic />
      </div>
    </div>
  );
}

function CTA({
  children,
  onClick,
  blue,
  busy,
  disabled,
  type = "button",
  form,
}: {
  children: ReactNode;
  onClick?: () => void;
  blue?: boolean;
  busy?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  form?: string;
}) {
  return (
    <button
      type={type}
      form={form}
      onClick={onClick}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className="flex h-14 w-full shrink-0 items-center justify-center rounded-full text-[17px] font-semibold leading-[22px] text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      style={
        blue
          ? { gap: 10, backgroundImage: "linear-gradient(180deg, #4FB3FF 0%, #1E8BFF 100%)", boxShadow: "0 12px 28px #1E8BFF59" }
          : { gap: 8, background: "#111111" }
      }
    >
      {children}
    </button>
  );
}

function ChatShell({
  ctx,
  cta,
  children,
  start,
  scrollKey,
}: {
  ctx: RMCtx;
  cta: ReactNode;
  children: ReactNode;
  start?: boolean; // content aligned to top instead of bottom
  scrollKey?: unknown;
}) {
  const body = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = body.current;
    if (el && !start) el.scrollTop = el.scrollHeight;
  }, [ctx.s.step, scrollKey, start]);

  return (
    <main
      className="rhyme relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip"
      style={{ height: "100dvh", paddingTop: TOP, background: "#FFFFFF" }}
    >
      <Header ctx={ctx} />
      <div ref={body} className="no-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-3" style={{ background: PAGE }}>
        <div key={ctx.s.step} className={`pop flex flex-col gap-3 ${start ? "" : "mt-auto"}`}>
          {children}
        </div>
      </div>
      <div
        className="flex shrink-0 flex-col gap-2.5 px-4 pt-2"
        style={{ background: PAGE, paddingBottom: "max(28px, env(safe-area-inset-bottom))" }}
      >
        {cta}
        <Composer />
      </div>
    </main>
  );
}

function Agent({ who, children, wide }: { who: Who; children: ReactNode; wide?: boolean }) {
  const a = AGENTS[who];
  return (
    <div className="flex shrink-0 items-start gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: a.bg }}>
        <Img src={a.img} size={24} />
      </div>
      <div className={`flex min-w-0 flex-col gap-1.5 ${wide ? "flex-1" : "max-w-[290px]"}`}>
        <div className="pl-1 text-[12px] font-semibold leading-4" style={{ color: MUTED }}>
          {a.name}
        </div>
        {children}
      </div>
    </div>
  );
}

function Bubble({ children, first = true }: { children: ReactNode; first?: boolean }) {
  return (
    <div
      className="self-start bg-white px-3.5 py-[11px] text-[15px] leading-[21px]"
      style={{ color: INK, borderRadius: first ? "6px 18px 18px 18px" : 18, boxShadow: "0 4px 14px #1018280F" }}
    >
      {children}
    </div>
  );
}

function Me({ children }: { children: ReactNode }) {
  return (
    <div className="flex shrink-0 justify-end">
      <div
        className="max-w-[270px] px-3.5 py-[11px] text-[15px] leading-[21px] text-white"
        style={{ background: BLUE, borderRadius: "18px 18px 6px 18px" }}
      >
        {children}
      </div>
    </div>
  );
}

function SysPill({ who, children }: { who?: Who; children: ReactNode }) {
  return (
    <div
      className="flex shrink-0 items-center gap-1.5 self-center rounded-full py-[5px] pr-3 text-[12px] font-medium leading-4"
      style={{ background: LINE, color: MUTED, paddingLeft: who ? 6 : 12 }}
    >
      {who && (
        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full" style={{ background: AGENTS[who].bg }}>
          <Img src={AGENTS[who].img} size={12} />
        </span>
      )}
      {children}
    </div>
  );
}

function Note({ img, warm, children }: { img: string; warm?: boolean; children: ReactNode }) {
  return (
    <div
      className="flex shrink-0 items-center gap-2.5 rounded-[14px] px-3 py-2.5 text-[13px] leading-[18px]"
      style={{ background: warm ? "#FFF4E5" : BLUE_BG, color: warm ? "#7A4A10" : "#1E4E8C" }}
    >
      <Img src={img} size={22} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-1.5">
      <Img src="/rm/sparkles.png" size={14} />
      <div className="text-[12px] font-bold leading-4 tracking-[0.06em]" style={{ color: BLUE_TEXT }}>
        {children}
      </div>
    </div>
  );
}

function Radio({ on }: { on: boolean }) {
  return on ? (
    <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full" style={{ background: BLUE }}>
      <Check size={12} />
    </span>
  ) : (
    <span className="h-[22px] w-[22px] shrink-0 rounded-full border-2 border-[#D1D5DB]" />
  );
}

function OptionRow({
  img,
  title,
  sub,
  on,
  onClick,
}: {
  img: string;
  title: string;
  sub?: string;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="flex w-full shrink-0 items-center gap-3 rounded-2xl pl-2.5 pr-3.5 text-left transition-[background-color,border-color,transform] duration-150 active:scale-[0.99]"
      style={{
        height: sub ? 62 : 56,
        border: `1.5px solid ${on ? BLUE : "#FFFFFF"}`,
        background: on ? BLUE_BG : "#FFFFFF",
        boxShadow: on ? "none" : "0 6px 18px #1018280F",
      }}
    >
      <span
        className="flex shrink-0 items-center justify-center rounded-xl"
        style={{ width: sub ? 40 : 38, height: sub ? 40 : 38, background: on ? "#FFFFFF" : "#F3F4F6" }}
      >
        <Img src={img} size={28} />
      </span>
      {sub ? (
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
            {title}
          </span>
          <span className="text-[13px] leading-[17px]" style={{ color: MUTED }}>
            {sub}
          </span>
        </span>
      ) : (
        <span className="min-w-0 flex-1 text-[15px] font-semibold leading-[19px]" style={{ color: INK }}>
          {title}
        </span>
      )}
      <Radio on={on} />
    </button>
  );
}

function Chip({
  label,
  on,
  onClick,
  h = 36,
  px = 12,
  check = "before",
  thin,
  busy,
}: {
  label: string;
  on: boolean;
  onClick: () => void;
  h?: number;
  px?: number;
  check?: "before" | "after" | "none";
  thin?: boolean; // 1px border when off (change screen)
  busy?: boolean;
}) {
  const showCheck = on && check !== "none";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-pressed={on}
      className="flex items-center rounded-full text-[14px] font-semibold leading-[18px] transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]"
      style={{
        height: h,
        gap: h <= 34 ? 5 : 6,
        paddingLeft: px,
        paddingRight: on && check === "after" ? px - 2 : px,
        background: on ? BLUE_BG : "#FFFFFF",
        border: `${on || !thin ? 1.5 : 1}px solid ${on ? BLUE : "#E5E7EB"}`,
        color: on ? BLUE_TEXT : INK,
      }}
    >
      {showCheck && check === "before" && <Check size={h <= 34 ? 12 : 13} color={BLUE} />}
      {label}
      {showCheck && check === "after" && <Check size={14} color={BLUE} />}
      {busy && <Spinner dark />}
    </button>
  );
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-[46px] shrink-0 items-center rounded-full px-[3px] transition-colors duration-200"
      style={{ background: on ? BLUE : "#E5E7EB" }}
    >
      <span
        className="h-[22px] w-[22px] rounded-full bg-white transition-transform duration-200"
        style={{ boxShadow: "0 1px 3px #00000033", transform: on ? "translateX(18px)" : "none" }}
      />
    </button>
  );
}

function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`flex shrink-0 flex-col bg-white ${className}`} style={{ borderRadius: 20, boxShadow: "0 6px 18px #1018280F", ...style }}>
      {children}
    </div>
  );
}

const WAVE = [8, 14, 20, 12, 18, 24, 16, 10, 20, 14, 22, 12, 8, 16, 20, 12, 18, 10, 14, 8, 12, 6];

function VoiceBubble({
  button,
  onButton,
  buttonLabel,
  played = WAVE.length,
  live,
  tick = 0,
  time,
  children,
}: {
  button: ReactNode;
  onButton?: () => void;
  buttonLabel: string;
  played?: number;
  live?: boolean;
  tick?: number;
  time: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex shrink-0 justify-end">
      <div
        className="flex w-[280px] max-w-full shrink-0 flex-col gap-2 pb-3 pl-2.5 pr-3.5 pt-2.5"
        style={{ background: BLUE, borderRadius: "18px 18px 6px 18px" }}
      >
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={onButton}
            aria-label={buttonLabel}
            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-white transition-transform active:scale-95"
          >
            {button}
          </button>
          <div className="flex h-6 min-w-0 flex-1 items-center gap-0.5 overflow-hidden">
            {WAVE.map((h, i) => (
              <span
                key={i}
                className="w-[3px] shrink-0 rounded-[2px] transition-[height] duration-200"
                style={{
                  height: live ? WAVE[(i + Math.floor(tick * 4)) % WAVE.length] : h,
                  background: i < played ? "#FFFFFF" : "#FFFFFF8C",
                }}
              />
            ))}
          </div>
          <span className="shrink-0 text-[13px] font-semibold tabular-nums leading-4 text-white">{time}</span>
        </div>
        {children && <div className="pl-1 text-[14px] leading-[19px] text-white opacity-95">{children}</div>}
      </div>
    </div>
  );
}

function usePlayer() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => () => audio.current?.pause(), []);
  function toggle(url: string | null) {
    if (!url) return;
    if (playing && audio.current) {
      audio.current.pause();
      setPlaying(false);
      return;
    }
    const a = new Audio(url);
    audio.current = a;
    a.onended = () => setPlaying(false);
    a.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
  }
  return { playing, toggle };
}

/* ---------- 1 · Meet your team (6CL-0) ---------- */

function Meet({ ctx }: { ctx: RMCtx }) {
  const name = firstName(ctx.s);
  const team: { who: Who; desc: string }[] = [
    { who: "smiley", desc: "runs your team" },
    { who: "scout", desc: "finds what's working" },
    { who: "writer", desc: "writes in your words" },
    { who: "editor", desc: "makes your Reels" },
  ];
  return (
    <main
      className="rhyme relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip"
      style={{
        paddingTop: TOP,
        background: "linear-gradient(180deg, #3FA4FF 0px, #7CC4FF 275px, #DCEFFF 440px, #F7F8FA 500px)",
      }}
    >
      <div className="relative flex h-[410px] shrink-0 flex-col justify-end">
        <div className="bob pointer-events-none absolute left-[-70px] top-2 opacity-95">
          <Img src="/rm/cloud.png" size={240} />
        </div>
        <div className="bob pointer-events-none absolute right-[-60px] top-[88px] opacity-95" style={{ animationDelay: "-1.2s" }}>
          <Img src="/rm/cloud.png" size={200} />
        </div>
        <div className="bob pointer-events-none absolute left-[150px] top-[-22px] opacity-85" style={{ animationDelay: "-2.1s" }}>
          <Img src="/rm/cloud.png" size={120} />
        </div>
        {/* Tilted Reel collage of real people, with the team working around it */}
        <div className="relative mx-auto h-[392px] w-full max-w-[390px]">
          {[
            { photo: "saree-shop", label: "Meena Sarees", x: -82, y: 64, r: -11, h: 214, z: 1 },
            { photo: "dentist", label: "SmileCare Clinic", x: 82, y: 70, r: 10, h: 214, z: 1 },
            { photo: "home-cook", label: "Asha's Kitchen", x: 0, y: 34, r: -2, h: 262, z: 2 },
          ].map((c) => (
            <figure
              key={c.photo}
              className="absolute left-1/2 top-0 m-0 overflow-hidden rounded-[20px] border-[3px] border-white bg-white"
              style={{ height: c.h, aspectRatio: "9/16", zIndex: c.z, transform: `translateX(calc(-50% + ${c.x}px)) translateY(${c.y}px) rotate(${c.r}deg)`, boxShadow: "0 18px 36px #103C784D" }}
            >
              <img src={`/demo/photos/${c.photo}.jpg`} alt="" className="h-full w-full object-cover" draggable={false} />
              <span className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/45 to-transparent" />
              <figcaption className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-bold" style={{ color: INK }}>
                {c.label}
              </figcaption>
            </figure>
          ))}
          {team.map(({ who, desc }, i) => {
            const pos = [
              { left: 10, top: 18 },
              { right: 10, top: 26 },
              { left: 6, top: 268 },
              { right: 6, top: 276 },
            ][i];
            return (
              <div key={who} className="bob absolute z-10 flex w-[84px] flex-col items-center gap-1" style={{ ...pos, animationDelay: `${-i * 0.7}s` }}>
                <div className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-white" style={{ boxShadow: "0 10px 24px #1E8BFF40" }}>
                  <div className="flex h-[50px] w-[50px] items-center justify-center rounded-full" style={{ background: AGENTS[who].bg }}>
                    <Img src={AGENTS[who].img} size={34} />
                  </div>
                </div>
                <div className="rounded-full bg-white/95 px-2 py-0.5 text-center text-[11px] leading-[14px]" style={{ boxShadow: "0 4px 10px #10182814" }}>
                  <b style={{ color: INK }}>{AGENTS[who].name}</b> <span className="text-[#4B5563]">{desc}</span>
                </div>
              </div>
            );
          })}
          <div className="bob pointer-events-none absolute left-[104px] top-[150px] z-10 text-[22px]" style={{ animationDelay: "-.4s" }}>✨</div>
          <div className="bob pointer-events-none absolute right-[100px] top-[118px] z-10 text-[18px]" style={{ animationDelay: "-1.5s" }}>✨</div>
        </div>
      </div>
      <div
        className="flex flex-1 flex-col justify-between gap-6 px-6 pt-[18px]"
        style={{ paddingBottom: "max(34px, env(safe-area-inset-bottom))" }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-1.5 rounded-full px-3 py-1.5" style={{ background: BLUE_BG }}>
            <span className="h-2 w-2 shrink-0 rounded-full bg-[#22C55E]" />
            <span className="text-[13px] font-semibold leading-4" style={{ color: BLUE_TEXT }}>
              4 agents · online for {name || "you"}
            </span>
          </div>
          <h1 className="text-balance text-center text-[32px] font-bold leading-9 tracking-[-0.02em]" style={{ color: INK }}>
            Your content team is ready
          </h1>
          <p className="text-center text-[16px] leading-[22px]" style={{ color: MUTED }}>
            They&apos;ll ask a few quick questions. 2 minutes.
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            {["Just tap to answer", "First Reel at the end"].map((t) => (
              <div
                key={t}
                className="flex items-center gap-1.5 rounded-full bg-white px-3 py-2 text-[13px] font-medium leading-4 text-[#374151]"
                style={{ boxShadow: "0 4px 12px #1018280F" }}
              >
                <Check size={14} color="#22C55E" w={3} />
                {t}
              </div>
            ))}
          </div>
        </div>
        <CTA blue onClick={() => ctx.go(ctx.s.signedUp ? "why" : "signup")}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <path
              d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Meet the team
        </CTA>
      </div>
    </main>
  );
}

/* ---------- Sign-up (not in Paper; same chat style) ---------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Field({
  id,
  label,
  error,
  ...input
}: { id: string; label: string; error?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-semibold leading-4 text-[#374151]">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={!!error || undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="h-12 w-full rounded-[14px] border-[1.5px] bg-white px-3.5 text-[16px] outline-none transition-[border-color,box-shadow] placeholder:text-[#9CA3AF] focus:border-[#1E8BFF] focus:shadow-[0_0_0_3px_#1E8BFF26]"
        style={{ color: INK, borderColor: error ? "#DC2626" : "#E5E7EB" }}
      />
      {error && (
        <div id={`${id}-err`} className="text-[13px] leading-4 text-[#DC2626]">
          {error}
        </div>
      )}
    </div>
  );
}

function Signup({ ctx }: { ctx: RMCtx }) {
  const [name, setName] = useState(ctx.s.name);
  const [email, setEmail] = useState(ctx.s.email);
  const [err, setErr] = useState<{ name?: string; email?: string }>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const n = name.trim();
    const m = email.trim();
    const next: { name?: string; email?: string } = {};
    if (n.length < 2) next.name = "Please enter your name.";
    if (!EMAIL_RE.test(m)) next.email = "Please enter a valid email, like sunita@gmail.com.";
    setErr(next);
    if (next.name || next.email) return;
    ctx.set({ name: n, email: m });
    setBusy(true);
    try {
      await ctx.submitSignup({ name: n, email: m });
    } catch {
      ctx.flash("Could not save that. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA type="submit" form="rm-signup" busy={busy}>
          {busy ? <Spinner /> : null}
          {busy ? "Saving…" : "Continue"}
          {!busy && <Arrow />}
        </CTA>
      }
    >
      <SysPill>Today · Smiley started the chat</SysPill>
      <Agent who="smiley">
        <Bubble>Hi! I&apos;m Smiley. What should we call you?</Bubble>
      </Agent>
      <Card className="gap-3.5 p-3.5">
        <form id="rm-signup" onSubmit={submit} noValidate className="flex flex-col gap-3.5">
          <Field
            id="rm-name"
            label="Your name"
            placeholder="Sunita Verma"
            autoComplete="name"
            autoCapitalize="words"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={err.name}
          />
          <Field
            id="rm-email"
            label="Email"
            type="email"
            inputMode="email"
            placeholder="sunita@gmail.com"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={err.email}
          />
        </form>
        <div className="flex items-center gap-1.5 text-[12px] leading-4" style={{ color: MUTED }}>
          <Img src="/3d/lock.png" size={14} />
          We only use this to save your Reels. No spam.
        </div>
      </Card>
    </ChatShell>
  );
}

/* ---------- 2 · Why (6ER-0) ---------- */

const WHY = [
  { label: "Get more customers & orders", img: "/rm/bags.png" },
  { label: "Grow followers & become a creator", img: "/rm/rocket.png" },
  { label: "Earn side income from brand deals", img: "/rm/moneybag.png" },
  { label: "Build trust for my practice", img: "/rm/shield.png" },
  { label: "Just share what I love", img: "/rm/sparkles.png" },
];

function SmileyHello({ s }: { s: RMState }) {
  const n = firstName(s);
  return (
    <Agent who="smiley">
      <Bubble>Hi {n || "there"}! I&apos;m Smiley, I run your team. Scout, Writer and Editor will join as we go.</Bubble>
      <Bubble first={false}>First, why do you want to post content?</Bubble>
    </Agent>
  );
}

function Why({ ctx }: { ctx: RMCtx }) {
  const why = ctx.s.why ?? D.why;
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            ctx.set({ why });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <SysPill>Today · Smiley started the chat</SysPill>
      <SmileyHello s={ctx.s} />
      <div className="flex shrink-0 flex-col gap-2">
        {WHY.map((o) => (
          <OptionRow key={o.label} img={o.img} title={o.label} on={why === o.label} onClick={() => ctx.set({ why: o.label })} />
        ))}
      </div>
    </ChatShell>
  );
}

/* ---------- 3 · Niche (6HG-0) ---------- */

const NICHES = [
  { label: "Food & cooking", img: "/rm/cooking.png" },
  { label: "Health & clinic", img: "/rm/tooth.png" },
  { label: "Fashion & sarees", img: "/rm/dress.png" },
  { label: "Beauty & salon", img: "/rm/art.png" },
  { label: "Teaching", img: "/rm/writer.png" },
  { label: "Home & decor", img: "/rm/house.png" },
  { label: "Local shop", img: "/rm/bags.png" },
  { label: "Fitness", img: "/rm/rocket.png" },
  { label: "Something else", img: "/rm/mic.png" },
];

function ScoutNicheQ() {
  return (
    <>
      <SysPill who="scout">Scout joined the chat</SysPill>
      <Agent who="scout">
        <Bubble>Hey, I&apos;m Scout. I find what&apos;s working. What&apos;s your niche?</Bubble>
      </Agent>
    </>
  );
}

function Niche({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const niche = ctx.s.niche ?? D.niche;
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            ctx.set({ niche });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <SmileyHello s={ctx.s} />
      <Me>{v.why}</Me>
      <ScoutNicheQ />
      <div className="flex shrink-0 flex-col gap-2">
        <div className="pl-1">
          <Label>SUGGESTED FOR BUSINESS OWNERS</Label>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {NICHES.map((o) => {
            const on = niche === o.label;
            return (
              <button
                key={o.label}
                type="button"
                aria-pressed={on}
                onClick={() => ctx.set({ niche: o.label })}
                className="relative flex h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 transition-[background-color,border-color,transform] duration-150 active:scale-[0.97]"
                style={{
                  border: `1.5px solid ${on ? BLUE : "#FFFFFF"}`,
                  background: on ? BLUE_BG : "#FFFFFF",
                  boxShadow: on ? "none" : "0 6px 18px #1018280F",
                }}
              >
                <Img src={o.img} size={34} />
                <span className="text-center text-[13px] font-semibold leading-4" style={{ color: INK }}>
                  {o.label}
                </span>
                {on && (
                  <span className="absolute right-1.5 top-1.5 flex h-[18px] w-[18px] items-center justify-center rounded-full" style={{ background: BLUE }}>
                    <Check size={10} w={4} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </ChatShell>
  );
}

/* ---------- 4 · Tell me more (6LI-0) ---------- */

const MORE: Record<string, { tag: string; items: string[] }> = {
  "Food & cooking": { tag: "FOOD BUSINESS", items: ["Lunch tiffins", "Home-style thali", "Paratha & breakfast", "Snacks for offices"] },
  "Health & clinic": { tag: "CLINIC", items: ["Check-ups", "Dental care", "Health tips", "Clinic tour"] },
  "Fashion & sarees": { tag: "FASHION", items: ["Sarees", "Suits & kurtis", "Bridal wear", "New arrivals"] },
  "Beauty & salon": { tag: "SALON", items: ["Hair", "Bridal makeup", "Skin care", "Nails"] },
  Teaching: { tag: "TEACHING", items: ["School tuition", "Spoken English", "Exam prep", "Music or art"] },
  "Home & decor": { tag: "HOME & DECOR", items: ["Handmade decor", "Furniture", "Plants", "Gifts"] },
  "Local shop": { tag: "LOCAL SHOP", items: ["Groceries", "Electronics", "Daily offers", "Home delivery"] },
  Fitness: { tag: "FITNESS", items: ["Yoga", "Gym training", "Diet plans", "Online classes"] },
};
const MORE_FALLBACK = { tag: "YOUR BUSINESS", items: ["Products", "Services", "Offers", "Behind the scenes"] };

function More({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const sugg = MORE[v.niche] ?? MORE_FALLBACK;
  const [more, setMore] = useState<string[]>(
    ctx.s.more.length ? ctx.s.more : v.niche === D.niche ? D.more : sugg.items.slice(0, 2),
  );
  const [location, setLocation] = useState(v.location);
  const chips = [...sugg.items, ...more.filter((m) => !sugg.items.includes(m))];

  function toggle(m: string) {
    const next = more.includes(m) ? more.filter((x) => x !== m) : [...more, m];
    setMore(next);
    ctx.set({ more: next });
  }
  function addOther() {
    const t = window.prompt("What else do you make or sell?")?.trim();
    if (!t) return;
    const next = more.includes(t) ? more : [...more, t];
    setMore(next);
    ctx.set({ more: next });
  }
  function changeLocation() {
    const t = window.prompt("Where do you sell from?", location)?.trim();
    if (!t) return;
    setLocation(t);
    ctx.set({ location: t });
  }

  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            if (!more.length) {
              ctx.flash("Pick at least one.");
              return;
            }
            ctx.set({ more, location });
            ctx.next();
          }}
        >
          <Check size={18} w={2.6} />
          Looks right
        </CTA>
      }
    >
      <ScoutNicheQ />
      <Me>{v.niche}</Me>
      <Agent who="scout">
        <Bubble>Love it. What exactly do you make? Pick all that fit.</Bubble>
      </Agent>
      <Card className="gap-3 p-3.5">
        <Label>SUGGESTED FOR YOU · {sugg.tag}</Label>
        <div className="flex flex-wrap gap-2">
          {chips.map((m) => (
            <Chip key={m} label={m} on={more.includes(m)} onClick={() => toggle(m)} h={38} px={14} check="after" />
          ))}
          <button
            type="button"
            onClick={addOther}
            className="flex h-[38px] items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-[#D1D5DB] bg-white px-3.5 text-[14px] font-semibold leading-[18px] transition-transform active:scale-[0.97]"
            style={{ color: MUTED }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 5v14M5 12h14" fill="none" stroke={MUTED} strokeWidth="2.6" strokeLinecap="round" />
            </svg>
            Something else
          </button>
        </div>
        <div className="h-px shrink-0" style={{ background: LINE }} />
        <div className="flex items-center gap-2.5">
          <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6]">
            <Img src="/rm/house.png" size={26} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-px">
            <span className="text-[12px] leading-4" style={{ color: MUTED }}>
              You sell from · detected
            </span>
            <span className="text-[15px] font-semibold leading-5" style={{ color: INK }}>
              {location}
            </span>
          </div>
          <button type="button" onClick={changeLocation} className="py-2 pl-2 text-[14px] font-semibold leading-[18px]" style={{ color: BLUE }}>
            Change
          </button>
        </div>
        <div className="flex items-center gap-1.5 self-start text-[13px] font-medium leading-4" style={{ color: MUTED }}>
          <Mic size={14} color={MUTED} />
          or say it in your words
        </div>
      </Card>
    </ChatShell>
  );
}

/* ---------- 5 · Audience (6Q7-0) ---------- */

function audienceOptions(location: string) {
  const [area, city = "Lucknow"] = location.split(",").map((x) => x.trim());
  return [
    { label: "Offices within 3 km", sub: `${area} · weekday lunch`, img: "/rm/bust.png", note: "Office workers near you order lunch between 11 and 12. I'll post then." },
    { label: "Families nearby", sub: "Weekend thali orders", img: "/rm/house.png", note: "Families near you plan weekend meals on Friday evening. I'll post then." },
    { label: "Students in Aliganj", sub: "PG and hostel dinners", img: "/rm/writer.png", note: "Students order dinner between 7 and 9 at night. I'll post then." },
    { label: `All of ${city}`, sub: "Wider reach, fewer orders", img: "/rm/globe.png", note: `${city} scrolls most between 8 and 10 at night. I'll post then.` },
  ];
}

function Audience({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const opts = audienceOptions(v.location);
  const audience = ctx.s.audience ?? D.audience;
  const note = (opts.find((o) => o.label === audience) ?? opts[0]).note;
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            ctx.set({ audience });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <Agent who="scout">
        <Bubble>Love it. What exactly do you make? Pick all that fit.</Bubble>
      </Agent>
      <Me>
        {v.more.join(", ")} · {v.location}
      </Me>
      <Agent who="scout">
        <Bubble>Who should see your posts?</Bubble>
      </Agent>
      <div className="flex shrink-0 flex-col gap-2">
        <div className="pl-1">
          <Label>SUGGESTED FOR YOUR {v.niche === D.niche ? "TIFFINS" : "BUSINESS"}</Label>
        </div>
        {opts.map((o) => (
          <OptionRow key={o.label} img={o.img} title={o.label} sub={o.sub} on={audience === o.label} onClick={() => ctx.set({ audience: o.label })} />
        ))}
      </div>
      <Note img="/rm/scout.png" warm>
        {note}
      </Note>
    </ChatShell>
  );
}

/* ---------- 6 · Experience & time (6UR-0) ---------- */

const EXPERIENCE = ["Never", "A few times", "Sometimes", "Regularly"];
const TIME = ["10 min a day", "1 hour a week", "Weekends only"];
const PLAN_NOTE: Record<string, string> = {
  "10 min a day": "Perfect. 5 small posts a week, I'll guide every step.",
  "1 hour a week": "Perfect. 3 posts a week, I'll guide every step.",
  "Weekends only": "Perfect. 2 posts every weekend, I'll guide every step.",
};

function Experience({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const experience = ctx.s.experience ?? D.experience;
  const time = ctx.s.time ?? D.time;
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            ctx.set({ experience, time });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <Agent who="scout">
        <Bubble>Who should see your posts?</Bubble>
      </Agent>
      <Me>{v.audience}</Me>
      <Agent who="smiley">
        <Bubble>Two quick ones, so I plan the right amount for you.</Bubble>
      </Agent>
      <Card className="gap-3.5 px-3.5 py-4">
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Img src="/rm/camera.png" size={22} />
            <div className="text-[15px] font-bold leading-5" style={{ color: INK }}>
              Have you posted before?
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {EXPERIENCE.map((o) => (
              <Chip key={o} label={o} on={experience === o} onClick={() => ctx.set({ experience: o })} />
            ))}
          </div>
        </div>
        <div className="h-px shrink-0" style={{ background: LINE }} />
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <Img src="/rm/calendar.png" size={22} />
            <div className="text-[15px] font-bold leading-5" style={{ color: INK }}>
              How much time can you give?
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {TIME.map((o) => (
              <Chip key={o} label={o} on={time === o} onClick={() => ctx.set({ time: o })} />
            ))}
          </div>
        </div>
      </Card>
      <Note img="/rm/smiley.png">{PLAN_NOTE[time] ?? PLAN_NOTE[D.time]}</Note>
    </ChatShell>
  );
}

/* ---------- 7 · Languages & Reel style (6YZ-0) ---------- */

const LANGS = ["English", "Hindi", "Tamil", "Kannada", "Telugu"];

function Languages({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const [langs, setLangs] = useState<string[]>(v.langs);
  function toggle(l: string) {
    const next = langs.includes(l) ? langs.filter((x) => x !== l) : [...langs, l];
    setLangs(next);
    ctx.set({ langs: next });
  }
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            if (!langs.length) {
              ctx.flash("Pick at least one language.");
              return;
            }
            ctx.set({ langs, style: ctx.s.style ?? D.style });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <Me>
        {v.experience} · {v.time}
      </Me>
      <Note img="/rm/smiley.png">{PLAN_NOTE[v.time] ?? PLAN_NOTE[D.time]}</Note>
      <div className="flex shrink-0 justify-center gap-2">
        <SysPill who="writer">Writer joined</SysPill>
        <SysPill who="editor">Editor joined</SysPill>
      </div>
      <Agent who="writer" wide>
        <Bubble>Which languages do your viewers speak?</Bubble>
        <div className="flex flex-wrap gap-1.5">
          {LANGS.map((l) => (
            <Chip key={l} label={l} on={langs.includes(l)} onClick={() => toggle(l)} h={34} px={11} />
          ))}
        </div>
      </Agent>
      <Agent who="editor">
        <Bubble>We&apos;ll start without your face — just your voice and your kitchen. You can change this anytime.</Bubble>
      </Agent>
    </ChatShell>
  );
}

/* ---------- 8 · Never show (73O-0) ---------- */

const NEVER = [
  { label: "My face", img: "/rm/bust.png" },
  { label: "My home & address", img: "/rm/house.png" },
  { label: "My family", img: "/rm/hand.png" },
  { label: "Prices", img: "/rm/banknote.png" },
];

function Never({ ctx }: { ctx: RMCtx }) {
  const v = vals(ctx.s);
  const [never, setNever] = useState<string[]>(ctx.s.never.length ? ctx.s.never : D.never);
  function toggle(l: string) {
    const next = never.includes(l) ? never.filter((x) => x !== l) : [...never, l];
    setNever(next);
    ctx.set({ never: next });
  }
  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA
          onClick={() => {
            ctx.set({ never });
            ctx.next();
          }}
        >
          Continue
          <Arrow />
        </CTA>
      }
    >
      <Agent who="editor">
        <Bubble>How do you want to show up in Reels?</Bubble>
      </Agent>
      <Me>
        {v.langs.join(" + ")} · {v.style}
      </Me>
      <Agent who="smiley">
        <Bubble>Anything that should never appear in your posts?</Bubble>
      </Agent>
      <Card className="px-3.5 pb-1.5 pt-3">
        <div className="pb-1">
          <Label>PRE-SET FROM &quot;{v.style.toUpperCase()}&quot;</Label>
        </div>
        {NEVER.map((o, i) => (
          <div
            key={o.label}
            className="flex h-14 shrink-0 items-center gap-3"
            style={{ borderBottom: i < NEVER.length - 1 ? `1px solid ${LINE}` : "none" }}
          >
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl bg-[#F3F4F6]">
              <Img src={o.img} size={26} />
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold leading-5" style={{ color: INK }}>
              {o.label}
            </span>
            <Toggle label={o.label} on={never.includes(o.label)} onClick={() => toggle(o.label)} />
          </div>
        ))}
      </Card>
      <Note img="/rm/shield.png">I&apos;ll check every post against these before you see it.</Note>
    </ChatShell>
  );
}

/* ---------- 9 · Warm-up talk (784-0) ---------- */

function Warmup({ ctx }: { ctx: RMCtx }) {
  const w = ctx.s.warmup;
  const [phase, setPhase] = useState<"idle" | "rec" | "busy" | "done">(w.text || w.file ? "done" : "idle");
  const [dur, setDur] = useState(15);
  const [url, setUrl] = useState<string | null>(null);
  const [consent, setConsent] = useState(true);
  const rec = useRecorder();
  const secs = useTicker(phase === "rec");
  const player = usePlayer();

  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);

  function takeSample() {
    ctx.set({ warmup: MOCK_WARMUP });
    setDur(15);
    setPhase("done");
  }

  async function begin() {
    const ok = await rec.start();
    if (!ok) {
      ctx.flash("No mic access. Using a sample for now.");
      takeSample();
      return;
    }
    setPhase("rec");
  }

  async function finish(): Promise<void> {
    setPhase("busy");
    const took = secs;
    const blob = await rec.stop();
    if (!blob || !blob.size) {
      takeSample();
      return;
    }
    setDur(Math.max(1, took));
    setUrl(URL.createObjectURL(blob));
    try {
      const { text, file } = await transcribe(blob, "warmup.webm", "0");
      ctx.set({ warmup: { text: text || "", file: file ?? null, source: text ? "voice" : "mock" } });
    } catch {
      ctx.set({ warmup: { text: "", file: null, source: "mock" } });
    }
    setPhase("done");
  }

  // Safety stop so a forgotten recording does not run forever.
  useEffect(() => {
    if (phase === "rec" && secs >= 30) void finish();
  }); // eslint-disable-line react-hooks/exhaustive-deps

  async function cta() {
    if (phase === "rec") await finish();
    else if (phase === "idle") ctx.set({ warmup: MOCK_WARMUP });
    ctx.next();
  }

  const shown = ctx.s.warmup.text;
  return (
    <ChatShell
      ctx={ctx}
      scrollKey={phase}
      cta={
        <CTA onClick={cta} busy={phase === "busy"}>
          {phase === "busy" ? <Spinner /> : <Img src="/rm/sparkles.png" size={22} />}
          {phase === "busy" ? "Listening…" : "Write my script"}
        </CTA>
      }
    >
      <Note img="/rm/smiley.png">All set! Your first Reel = a short intro: who you are, what you make, how to order.</Note>
      <Agent who="writer">
        <Bubble>Before I write your first Reel — tell me about your kitchen like you&apos;d tell a friend. 15 seconds.</Bubble>
        <div className="flex flex-col gap-1.5 pl-1 pt-1">
          <div className="text-[12px] font-semibold leading-4" style={{ color: MUTED }}>
            Just say:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {["Your name", "What you cook", "Where you deliver"].map((t) => (
              <span key={t} className="flex h-7 items-center rounded-full px-2.5 text-[13px] font-semibold leading-4" style={{ background: BLUE_BG, color: BLUE_TEXT }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </Agent>

      {phase === "done" ? (
        <VoiceBubble
          button={player.playing ? <span className="block h-2.5 w-2.5 rounded-[2px]" style={{ background: BLUE }} /> : <Play />}
          buttonLabel={player.playing ? "Pause" : "Play your voice note"}
          onButton={() => player.toggle(url)}
          played={12}
          time={fmt(dur)}
        >
          {shown ? `"${shown}"` : "Got your voice note. Thanks!"}
        </VoiceBubble>
      ) : phase === "rec" ? (
        <VoiceBubble
          button={<span className="block h-3 w-3 rounded-[3px] bg-[#EF4444]" />}
          buttonLabel="Stop recording"
          onButton={() => void finish()}
          live
          tick={secs}
          time={`${fmt(secs)} / 0:15`}
        >
          <span className="flex items-center gap-2">
            <span className="recdot h-2 w-2 rounded-full bg-white" />
            Recording… tap the square when you&apos;re done.
          </span>
        </VoiceBubble>
      ) : phase === "busy" ? (
        <VoiceBubble button={<Spinner dark />} buttonLabel="Saving" played={0} time={fmt(secs)}>
          Listening back…
        </VoiceBubble>
      ) : (
        <>
          <VoiceBubble button={<Mic size={16} w={2.6} />} buttonLabel="Start recording" onButton={() => void begin()} played={0} time="0:15">
            Tap the mic and talk for 15 seconds.
          </VoiceBubble>
          <button type="button" onClick={takeSample} className="-mt-1 self-end px-1 text-[13px] font-semibold leading-4" style={{ color: BLUE_TEXT }}>
            Skip, use a sample
          </button>
        </>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={consent}
        onClick={() => setConsent((c) => !c)}
        className="flex w-[280px] max-w-full shrink-0 items-center gap-2.5 self-end rounded-[14px] bg-white px-3 py-2.5 text-left"
        style={{ boxShadow: "0 4px 12px #1018280D" }}
      >
        <span
          className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md transition-colors"
          style={consent ? { background: BLUE } : { border: "2px solid #D1D5DB" }}
        >
          {consent && <Check size={12} />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-px">
          <span className="text-[14px] font-semibold leading-[18px]" style={{ color: INK }}>
            Use my recordings for my Reels
          </span>
          <span className="text-[12px] leading-4" style={{ color: MUTED }}>
            Only for your posts. Delete anytime.
          </span>
        </span>
      </button>
    </ChatShell>
  );
}

/* ---------- 10 · Script ready (7D8-0) ---------- */

function estSecs(lines: string[]) {
  const chars = lines.join(" ").length;
  return Math.max(10, Math.round(chars / 9.4 / 5) * 5);
}

function Script({ ctx }: { ctx: RMCtx }) {
  const [loading, setLoading] = useState(ctx.s.lines.length !== 6);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || ctx.s.lines.length === 6) return;
    asked.current = true;
    setLoading(true);
    ctx
      .loadScript()
      .catch(() => ctx.flash("Writer is busy. Showing a sample script."))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const waiting = loading && !ctx.s.lines.length;
  const lines = scriptLines(ctx.s);
  return (
    <ChatShell
      ctx={ctx}
      scrollKey={waiting}
      cta={
        <CTA onClick={ctx.next} disabled={waiting}>
          <Mic size={18} color="#FFFFFF" w={2.4} />
          Read it out
        </CTA>
      }
    >
      <Agent who="writer">
        {waiting ? (
          <Bubble>
            <span className="flex items-center gap-2.5">
              <Spinner dark />
              Writing your intro Reel…
            </span>
          </Bubble>
        ) : (
          <Bubble>Here&apos;s your intro Reel. I wrote it the way you talk. About {estSecs(lines)} seconds.</Bubble>
        )}
      </Agent>
      {!waiting && (
        <div className="flex shrink-0 flex-col bg-white px-4 pb-1.5 pt-4" style={{ borderRadius: 24, boxShadow: "0 8px 24px #1018280F" }}>
          <div className="flex items-center justify-between pb-2">
            <div className="text-[15px] font-bold leading-5" style={{ color: INK }}>
              Your intro Reel
            </div>
            <div className="flex h-6 items-center rounded-full px-[9px] text-[12px] font-semibold leading-4" style={{ background: BLUE_BG, color: BLUE_TEXT }}>
              {lines.length} lines · ~{estSecs(lines)} sec
            </div>
          </div>
          {lines.map((l, i) => (
            <div key={i} className="flex items-start gap-2.5 border-t border-[#F0F2F5] py-2">
              <div className="w-4 shrink-0 text-[13px] font-bold leading-5" style={{ color: BLUE }}>
                {i + 1}
              </div>
              <div className="min-w-0 flex-1 text-[15px] font-medium leading-5" style={{ color: INK }}>
                {l}
              </div>
            </div>
          ))}
        </div>
      )}
    </ChatShell>
  );
}

/* ---------- 11 · Read it out (7I0-0) ---------- */

const READ_SECS = 50;
const REC_BARS = [6, 12, 16, 9, 14, 7, 12, 5, 10, 4];

function Read({ ctx }: { ctx: RMCtx }) {
  const lines = scriptLines(ctx.s);
  const [phase, setPhase] = useState<"idle" | "rec" | "busy">("idle");
  const rec = useRecorder();
  const secs = useTicker(phase === "rec");
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Current line: cumulative share of characters vs elapsed share of ~50 s.
  const weights = lines.map((l) => l.length);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const found = weights.findIndex((w) => ((acc += w) / total) * READ_SECS > secs);
  const cur = phase === "idle" ? 0 : found === -1 ? lines.length - 1 : found;

  useEffect(() => {
    lineRefs.current[cur]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [cur]);

  function skip() {
    ctx.set({ voice: null, voiceTaken: true });
    ctx.next();
  }

  async function begin() {
    const ok = await rec.start();
    if (!ok) {
      ctx.flash("No mic access. Smiley's voice will read it for now.");
      skip();
      return;
    }
    setPhase("rec");
  }

  async function finish() {
    setPhase("busy");
    const took = secs;
    const blob = await rec.stop();
    let file: string | null = null;
    if (blob && blob.size) {
      if (LAST_TAKE.url) URL.revokeObjectURL(LAST_TAKE.url);
      LAST_TAKE.url = URL.createObjectURL(blob);
      LAST_TAKE.secs = took;
      try {
        file = (await transcribe(blob, "voiceover.webm", "9")).file ?? null;
      } catch {
        ctx.flash("Could not save your voice. Using the demo voice.");
      }
    }
    ctx.set({ voice: file, voiceTaken: true });
    ctx.next();
  }

  const recording = phase === "rec";
  return (
    <ChatShell
      ctx={ctx}
      start
      cta={
        phase === "idle" ? (
          <CTA onClick={() => void begin()}>
            <Mic size={18} color="#FFFFFF" w={2.4} />
            Start reading
          </CTA>
        ) : (
          <CTA onClick={() => void finish()} busy={phase === "busy"}>
            {phase === "busy" ? <Spinner /> : <Check size={18} w={2.6} />}
            {phase === "busy" ? "Saving your voice…" : "Done reading"}
          </CTA>
        )
      }
    >
      <div className="flex shrink-0 items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: AGENTS.smiley.bg }}>
          <Img src={AGENTS.smiley.img} size={24} />
        </div>
        <div
          className="max-w-[300px] bg-white px-3.5 py-[9px] text-[14px] leading-[19px]"
          style={{ color: INK, borderRadius: "6px 18px 18px 18px", boxShadow: "0 4px 14px #1018280F" }}
        >
          Read slowly, like you&apos;re telling a friend. Mistakes are okay.
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-3 bg-white px-5 py-4" style={{ borderRadius: 24, boxShadow: "0 8px 24px #1018280F" }}>
        <div className="flex items-center justify-between">
          <div className="text-[13px] font-bold leading-4 tracking-[0.08em]" style={{ color: MUTED }}>
            READ THIS OUT
          </div>
          <div className="text-[13px] font-semibold leading-4" style={{ color: BLUE_TEXT }}>
            Line {cur + 1} of {lines.length}
          </div>
        </div>
        <div className="flex flex-col gap-2.5">
          {lines.map((l, i) =>
            i === cur ? (
              <div
                key={i}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className="rounded-[14px] px-2.5 py-2 text-[17px] font-bold leading-[23px] transition-colors duration-300"
                style={{ background: BLUE_BG, borderLeft: `4px solid ${BLUE}`, color: BLUE_TEXT }}
              >
                {l}
              </div>
            ) : (
              <div
                key={i}
                ref={(el) => {
                  lineRefs.current[i] = el;
                }}
                className="pl-3.5 pr-1.5 text-[16px] font-semibold leading-[21px] transition-colors duration-300"
                style={{ color: i < cur ? "#C4C9D2" : INK }}
              >
                {l}
              </div>
            ),
          )}
        </div>
      </div>

      <div className="flex h-9 shrink-0 items-center gap-2.5 self-center rounded-full bg-white px-3.5" style={{ boxShadow: "0 4px 12px #1018280D" }}>
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${recording ? "recdot" : ""}`}
          style={{ background: recording ? "#EF4444" : "#D1D5DB", boxShadow: recording ? "0 0 0 4px #EF44442E" : "none" }}
        />
        <span className="text-[14px] font-bold tabular-nums leading-[18px]" style={{ color: INK }}>
          {fmt(secs)}
        </span>
        <span className="flex h-4 items-center gap-0.5" aria-hidden>
          {REC_BARS.map((h, i) => (
            <span
              key={i}
              className="w-0.5 shrink-0 rounded-[2px] transition-[height] duration-200"
              style={{
                height: recording ? REC_BARS[(i + Math.floor(secs * 4)) % REC_BARS.length] : h,
                background: !recording ? "#D1D5DB" : i < 8 ? "#EF4444" : "#FCA5A5",
              }}
            />
          ))}
        </span>
        <span className="text-[13px] leading-4" style={{ color: MUTED }}>
          {recording ? "Recording" : phase === "busy" ? "Saving" : "Ready"}
        </span>
      </div>
      {phase === "idle" && (
        <button type="button" onClick={skip} className="self-center px-2 py-1 text-[13px] font-semibold leading-4" style={{ color: MUTED }}>
          Use demo voice for now
        </button>
      )}
    </ChatShell>
  );
}

/* ---------- 12 · Want to change anything? (7O4-0) ---------- */

const CHANGES: { label: string; change: string | null; done: string }[] = [
  { label: "Sounds good", change: null, done: "" },
  { label: "Make it shorter", change: "shorter", done: "Done. Your script is shorter now." },
  { label: "Add my phone number", change: "phone", done: "Done. Your phone number is in the last line." },
  { label: "Say line 1 differently", change: "Say line 1 differently", done: "Done. New first line ready." },
];

function Change({ ctx }: { ctx: RMCtx }) {
  const [picked, setPicked] = useState("Sounds good");
  const [busy, setBusy] = useState<string | null>(null);
  const player = usePlayer();
  const real = !!ctx.s.voice || !!LAST_TAKE.url;
  const n = scriptLines(ctx.s).length;

  async function pick(c: (typeof CHANGES)[number]) {
    if (busy) return;
    setPicked(c.label);
    if (!c.change) return;
    setBusy(c.label);
    try {
      await ctx.loadScript(c.change);
      ctx.flash(c.done);
    } catch {
      ctx.flash("Could not change it. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ChatShell
      ctx={ctx}
      cta={
        <CTA blue onClick={() => ctx.go("shots")} disabled={!!busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden className="shrink-0">
            <path
              d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth="2.2"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="#FFFFFF" strokeWidth="2.2" />
          </svg>
          Let&apos;s shoot
        </CTA>
      }
    >
      <VoiceBubble
        button={player.playing ? <span className="block h-2.5 w-2.5 rounded-[2px]" style={{ background: BLUE }} /> : <Play />}
        buttonLabel={player.playing ? "Pause" : "Play your voiceover"}
        onButton={() => (LAST_TAKE.url ? player.toggle(LAST_TAKE.url) : ctx.flash("Your voice is saved with your Reel."))}
        time={LAST_TAKE.secs ? fmt(LAST_TAKE.secs) : "0:52"}
      >
        <span className="font-semibold">{real ? `Your voiceover · ${n} lines` : `Demo voice · ${n} lines`}</span>
      </VoiceBubble>
      <Note img="/rm/smiley.png">
        {real ? "Saved! Your real voice goes straight into the Reel." : "No problem. A demo voice reads it for now."}
      </Note>
      <Agent who="writer">
        <Bubble>Sounds great! Want to change anything?</Bubble>
        <div className="flex flex-wrap gap-2 pt-0.5">
          {CHANGES.map((c) => (
            <Chip
              key={c.label}
              label={c.label}
              on={picked === c.label}
              onClick={() => void pick(c)}
              px={14}
              check="none"
              thin
              busy={busy === c.label}
            />
          ))}
        </div>
        <div className="flex items-center gap-1.5 pl-1 pt-0.5 text-[13px] font-semibold leading-4" style={{ color: BLUE_TEXT }}>
          <Mic size={14} w={2.4} />
          or say it
        </div>
      </Agent>
      <Card className="flex-row items-center gap-3 px-3.5 py-3">
        <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[#F3F4F6]">
          <Img src="/rm/camera.png" size={36} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="text-[12px] font-bold leading-4 tracking-[0.06em]" style={{ color: BLUE_TEXT }}>
            NEXT
          </div>
          <div className="text-[15px] font-bold leading-5" style={{ color: INK }}>
            6 short shots · ~5 min
          </div>
          <div className="text-[13px] leading-[17px]" style={{ color: MUTED }}>
            Hands and kitchen only.
          </div>
        </div>
      </Card>
    </ChatShell>
  );
}

/* ---------- router ---------- */

const SCREENS: Record<OnbStep, (p: { ctx: RMCtx }) => ReactNode> = {
  meet: Meet,
  signup: Signup,
  why: Why,
  niche: Niche,
  more: More,
  audience: Audience,
  experience: Experience,
  languages: Languages,
  never: Never,
  warmup: Warmup,
  script: Script,
  read: Read,
  change: Change,
};

export function OnboardingScreen({ ctx }: { ctx: RMCtx }) {
  const step = ctx.s.step as OnbStep;
  if (!(ONBOARDING_STEPS as readonly string[]).includes(step)) return null;
  const Screen = SCREENS[step];
  return <Screen key={step} ctx={ctx} />;
}
