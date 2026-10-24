"use client";
// Reels Magic · First Reel · Shoot & post (Paper artboard 7VA-0): shot list, live camera, shot saved,
// all shots done, team at work, and the finished Reel.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { SHOTS, DEFAULT_LINES, refUrl, fallbackClip, demoClip } from "@/lib/introShots";
import type { RMCtx, StepId } from "./types";

export const SHOOT_STEPS = ["shots", "shoot", "saved", "alldone", "team", "reel"] as const satisfies readonly StepId[];

// Her takes, kept across screens so "saved" / "alldone" can play them back.
const takes = new Map<number, { url: string; secs: number }>();

// Short camera-pill copy per shot (Paper: "Phone pan ke upar · sirf sizzle").
const PILL = [
  "Phone upar se · bilkul seedha",
  "Sirf haath · phone side se",
  "Close-up · ghee ki chamak",
  "Phone pan ke upar · sirf sizzle",
  "Sirf haath · dhakkan band",
  "Left se right · dheere se",
];
// Smiley's line after each take (Paper: "Ekdum sahi! Sizzle saaf dikh raha hai.").
const PRAISE = [
  "Ekdum sahi! Tiffin saaf dikh raha hai.",
  "Ekdum sahi! Haath saaf dikh rahe hain.",
  "Ekdum sahi! Ghee ki chamak dikh rahi hai.",
  "Ekdum sahi! Sizzle saaf dikh raha hai.",
  "Ekdum sahi! Packing saaf dikh rahi hai.",
  "Ekdum sahi! Saare tiffin dikh rahe hain.",
];

const TOP = "max(env(safe-area-inset-top), var(--top-inset, 14px))";
const INK = "#0B0F19";
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function ShootFlowScreen({ ctx }: { ctx: RMCtx }) {
  switch (ctx.s.step) {
    case "shots":
      return <ShotsScreen ctx={ctx} />;
    case "shoot":
      return <CameraScreen key={ctx.s.shot} ctx={ctx} />;
    case "saved":
      return <SavedScreen key={ctx.s.shot} ctx={ctx} />;
    case "alldone":
      return <AllDoneScreen ctx={ctx} />;
    case "team":
      return <TeamScreen ctx={ctx} />;
    case "reel":
      return <ReelScreen ctx={ctx} />;
    default:
      return null;
  }
}

/* ---------- shared bits ---------- */

function Shell({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`rhyme relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip bg-[#F7F8FA] ${className}`}
      style={{ paddingTop: TOP }}
    >
      {children}
    </main>
  );
}

function BackBtn({ onClick, size = 40 }: { onClick: () => void; size?: number }) {
  return (
    <button
      onClick={onClick}
      aria-label="Back"
      className="flex shrink-0 items-center justify-center rounded-full bg-[#EEF0F3] active:scale-95"
      style={{ width: size, height: size }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path d="M15 5l-7 7 7 7" fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

function SmileyLine({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-1">
      <img src="/3d/smile.png" alt="" className="h-5 w-5 shrink-0" />
      <p className="text-[14px] leading-[18px] text-[#6B7280]">{children}</p>
    </div>
  );
}

function Check({ size = 22, icon = 11, ring = false }: { size?: number; icon?: number; ring?: boolean }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-[#22C55E] ${ring ? "border-2 border-white" : ""}`}
      style={{ width: size, height: size }}
    >
      <svg width={icon} height={icon} viewBox="0 0 24 24" aria-hidden>
        <path d="M5 12l5 5L20 7" fill="none" stroke="#fff" strokeWidth="3.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function BottomBar({ children, pb = 28, gap = 0 }: { children: ReactNode; pb?: number; gap?: number }) {
  return (
    <div
      className="sticky bottom-0 z-10 flex shrink-0 flex-col bg-[#F7F8FA] px-4 pt-2"
      style={{ paddingBottom: `max(env(safe-area-inset-bottom), ${pb}px)`, gap }}
    >
      {children}
    </div>
  );
}

function BlackCta({ onClick, icon, children, disabled }: { onClick: () => void; icon: ReactNode; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full bg-[#111111] text-[17px] font-semibold leading-[22px] text-white transition-transform active:scale-[0.98] disabled:opacity-60"
    >
      {icon}
      {children}
    </button>
  );
}

function BlueCta({ onClick, icon, children, busy }: { onClick: () => void; icon: ReactNode; children: ReactNode; busy?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="flex h-14 shrink-0 items-center justify-center gap-2.5 rounded-full text-[17px] font-semibold leading-[22px] text-white shadow-[0_12px_28px_#1E8BFF59] transition-transform active:scale-[0.98] disabled:opacity-80"
      style={{ backgroundImage: "linear-gradient(180deg, #4FB3FF 0%, #1E8BFF 100%)" }}
    >
      {busy ? <span className="spin block h-5 w-5 rounded-full border-[2.5px] border-white border-t-transparent" /> : icon}
      {children}
    </button>
  );
}

const ArrowIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Muted looping preview: her take, the AI demo clip (demo mode) or the reference picture.
function ClipThumb({ i, demo, className = "" }: { i: number; demo: boolean; className?: string }) {
  const [src, setSrc] = useState<string | null>(demo ? demoClip(i) : (takes.get(i)?.url ?? null));
  if (!src) return <img src={refUrl(i)} alt="" className={`kenburns h-full w-full object-cover ${className}`} />;
  return (
    <video
      src={src}
      autoPlay
      muted
      loop
      playsInline
      onError={() => setSrc(src === fallbackClip(i) ? null : fallbackClip(i))}
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

function ShotCard({ i, ctx, onClick }: { i: number; ctx: RMCtx; onClick?: () => void }) {
  const done = !!ctx.s.clips[i];
  const line = ctx.s.lines[i] ?? DEFAULT_LINES[i];
  return (
    <button
      onClick={onClick}
      className="flex shrink-0 items-center gap-3 rounded-[18px] bg-white py-[5px] pl-[5px] pr-3 text-left shadow-[0_4px_14px_#1018280F] active:scale-[0.99]"
    >
      <span className="relative h-[70px] w-[52px] shrink-0 overflow-hidden rounded-[12px] bg-[#EEF0F3]">
        <img src={refUrl(i)} alt="" className="kenburns h-full w-full object-cover" />
        <span className="absolute left-1 top-12 flex h-[18px] items-center gap-0.5 rounded-full bg-black/60 pl-[3px] pr-[5px]">
          <svg width="9" height="9" viewBox="0 0 24 24" aria-hidden>
            <path d="M7 4v16l13-8z" fill="#fff" />
          </svg>
          <span className="text-[10px] font-bold leading-3 text-white">3s</span>
        </span>
        {done && (
          <span className="absolute left-1 top-1">
            <Check size={20} icon={10} ring />
          </span>
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className={`text-[12px] font-bold leading-[15px] ${done ? "text-[#15803D]" : "text-[#1E6FD9]"}`}>
          Shot {i + 1} · {done ? "saved" : `${SHOTS[i].seconds} sec`}
        </span>
        <span className="text-[14px] font-semibold leading-[18px] text-[#0B0F19]">{SHOTS[i].hinglish}</span>
        <span className="line-clamp-1 text-[12px] italic leading-[15px] text-[#9CA3AF]">&ldquo;{line}&rdquo;</span>
      </span>
    </button>
  );
}

// Horizontal swipeable shot cards (~80% width, next card peeks).
function ShotCarousel({ ctx, onShoot }: { ctx: RMCtx; onShoot: (i: number) => void }) {
  const [active, setActive] = useState(0);
  return (
    <div className="-mx-4 flex flex-col gap-2">
      <div
        className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-[10%] pb-1 pt-1"
        onScroll={(e) => {
          const el = e.currentTarget;
          const w = el.firstElementChild ? (el.firstElementChild as HTMLElement).offsetWidth + 12 : 1;
          setActive(Math.round(el.scrollLeft / w));
        }}
      >
        {SHOTS.map((sh, i) => {
          const done = !!ctx.s.clips[i];
          return (
            <button
              key={i}
              onClick={() => onShoot(i)}
              className="flex w-[80%] shrink-0 snap-center flex-col overflow-hidden rounded-[22px] bg-white text-left shadow-[0_8px_24px_#10182814] active:scale-[0.99]"
            >
              <span className="relative block h-[250px] w-full overflow-hidden bg-[#EEF0F3]">
                <img src={refUrl(i)} alt="" className="kenburns h-full w-full object-cover" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-black/60 px-2.5 py-1 text-[12px] font-bold text-white">
                  Shot {i + 1} · {sh.seconds} sec
                </span>
                {done && (
                  <span className="absolute right-2.5 top-2.5">
                    <Check size={26} icon={13} ring />
                  </span>
                )}
              </span>
              <span className="flex flex-col gap-1 px-3.5 pb-3.5 pt-3">
                <span className="text-[16px] font-semibold leading-[21px] text-[#0B0F19]">{sh.hinglish}</span>
                <span className="line-clamp-2 text-[13px] italic leading-[17px] text-[#9CA3AF]">&ldquo;{ctx.s.lines[i] ?? DEFAULT_LINES[i]}&rdquo;</span>
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-1.5" aria-hidden>
        {SHOTS.map((_, i) => (
          <span key={i} className="h-1.5 rounded-full transition-all" style={{ width: i === active ? 18 : 6, background: i === active ? "#1E8BFF" : ctx.s.clips[i] ? "#86EFAC" : "#D1D5DB" }} />
        ))}
      </div>
    </div>
  );
}

/* ---------- 1 · Your 6 shots ---------- */

function ShotsScreen({ ctx }: { ctx: RMCtx }) {
  const doneCount = ctx.s.clips.filter(Boolean).length;
  const firstMissing = SHOTS.findIndex((_, i) => !ctx.s.clips[i]);
  const shoot = (i: number) => {
    ctx.set({ shot: i });
    ctx.go("shoot");
  };
  return (
    <Shell>
      <div className="flex shrink-0 items-center gap-3.5 px-4 pb-1 pt-2">
        <BackBtn onClick={ctx.back} size={32} />
        <div className="flex h-1.5 flex-1 rounded-[3px] bg-[#E5E7EB]">
          <div
            className="h-1.5 rounded-[3px] transition-[width] duration-500"
            style={{ width: `${Math.max(15, (doneCount / SHOTS.length) * 100)}%`, backgroundImage: "linear-gradient(90deg, #1E8BFF 0%, #4FB3FF 100%)" }}
          />
        </div>
        <span className="shrink-0 text-[14px] font-semibold leading-[18px] text-[#6B7280]">
          {doneCount} of {SHOTS.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-[7px] px-4 pb-2 pt-0.5">
        <h1 className="px-1 text-[27px] font-bold leading-8 tracking-[-0.02em] text-[#0B0F19]">6 chhote shots. ~5 minute.</h1>
        <SmileyLine>Har shot ke saath ek clip hai — bas waisa hi lo.</SmileyLine>
        <div className="flex shrink-0 items-center gap-2.5 rounded-[18px] border border-[#F5D58A] bg-[#FFF7E6] py-[5px] pl-1.5 pr-3">
          <img src="/rm/setup-phone.jpg" alt="" className="h-9 w-[30px] shrink-0 rounded-lg object-cover" />
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-bold leading-[14px] tracking-[0.06em] text-[#B7791F]">SET UP FIRST</span>
            <span className="text-[14px] font-semibold leading-[19px] text-[#0B0F19]">Phone ko dabbe pe tika do, khidki ke paas.</span>
          </div>
        </div>
        <ShotCarousel ctx={ctx} onShoot={shoot} />
      </div>
      <BottomBar pb={24}>
        {firstMissing === -1 ? (
          <BlackCta onClick={() => ctx.go("alldone")} icon={<ArrowIcon />}>
            See all 6 shots
          </BlackCta>
        ) : (
          <BlackCta
            onClick={() => shoot(firstMissing)}
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.4-2h5l1.4 2h1.6A2.5 2.5 0 0 1 20 8.5v8a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinejoin="round" />
                <circle cx="12" cy="12.5" r="3.4" fill="none" stroke="#fff" strokeWidth="2.2" />
              </svg>
            }
          >
            Start shot {firstMissing + 1}
          </BlackCta>
        )}
      </BottomBar>
    </Shell>
  );
}

/* ---------- 2 · Shooting shot N (live camera) ---------- */

// No camera (desktop, headless, denied): an animated canvas stream so MediaRecorder still works.
function fakeStream(label: string): MediaStream {
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = 960;
  const g = c.getContext("2d")!;
  let t = 0;
  let raf = 0;
  const draw = () => {
    t += 1;
    const grad = g.createLinearGradient(0, 0, 540, 960);
    grad.addColorStop(0, `hsl(${(30 + t) % 360},45%,32%)`);
    grad.addColorStop(1, `hsl(${(60 + t) % 360},40%,16%)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 540, 960);
    g.fillStyle = "rgba(255,255,255,.55)";
    g.font = "600 28px sans-serif";
    g.textAlign = "center";
    g.fillText(label, 270, 480);
    raf = requestAnimationFrame(draw);
  };
  draw();
  const stream = c.captureStream(30);
  const origStop = MediaStreamTrack.prototype.stop;
  stream.getVideoTracks().forEach((tr) => {
    tr.stop = () => {
      cancelAnimationFrame(raf);
      origStop.call(tr);
    };
  });
  return stream;
}

function CameraScreen({ ctx }: { ctx: RMCtx }) {
  const idx = ctx.s.shot;
  const TARGET = SHOTS[idx].seconds;
  const live = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [ready, setReady] = useState(false);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [how, setHow] = useState(false); // full-screen "how to shoot" video
  const [howSrc, setHowSrc] = useState(demoClip(idx));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        });
      } catch {
        stream = fakeStream("Camera preview");
      }
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (live.current) {
        live.current.srcObject = stream;
        live.current.play().catch(() => {});
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
      if (recRef.current?.state === "recording") {
        recRef.current.onstop = null;
        recRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Auto-stop at the shot's target length.
  useEffect(() => {
    if (rec && secs >= TARGET) end();
  }, [rec, secs]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    const stream = streamRef.current;
    if (!stream) return;
    const mime = MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm";
    const r = new MediaRecorder(stream, { mimeType: mime });
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    r.onstop = () => saveTake(new Blob(chunks, { type: r.mimeType || "video/webm" }));
    r.start(250);
    recRef.current = r;
    startedAt.current = Date.now();
    setSecs(0);
    setRec(true);
    timer.current = setInterval(() => setSecs((Date.now() - startedAt.current) / 1000), 100);
  }

  function end() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    if (recRef.current?.state === "recording") recRef.current.stop();
    recRef.current = null;
    setRec(false);
  }

  function saveTake(blob: Blob) {
    const took = Math.max(1, Math.min(TARGET, (Date.now() - startedAt.current) / 1000));
    const old = takes.get(idx);
    if (old) URL.revokeObjectURL(old.url);
    takes.set(idx, { url: URL.createObjectURL(blob), secs: took });
    ctx.set((p) => ({ clips: p.clips.map((c, k) => (k === idx ? "local" : c)) }));
    ctx.go("saved");
    const fd = new FormData();
    fd.append("video", blob, `shot-${idx + 1}.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
    fd.append("idx", String(idx + 1));
    fetch("/api/intro/clip", { method: "POST", body: fd })
      .then((r) => r.json())
      .then((r: { file?: string | null }) => {
        if (r.file) ctx.set((p) => ({ clips: p.clips.map((c, k) => (k === idx ? r.file! : c)) }));
      })
      .catch(() => ctx.flash("Couldn't upload that shot. It's saved on this phone."));
  }

  return (
    <main className="rhyme relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-black text-white">
      <div
        className="absolute inset-0"
        style={{ backgroundImage: "radial-gradient(ellipse 70% 50% at 52% 48%, #5A4636 0%, #2C2219 45%, #0E0B09 100%)" }}
      />
      <video ref={live} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
      {/* rule-of-thirds grid */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute inset-y-0 left-1/3 w-px bg-white/[0.14]" />
        <div className="absolute inset-y-0 left-2/3 w-px bg-white/[0.14]" />
        <div className="absolute inset-x-0 top-1/3 h-px bg-white/[0.14]" />
        <div className="absolute inset-x-0 top-2/3 h-px bg-white/[0.14]" />
      </div>
      <div
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "linear-gradient(180deg, #00000073 0%, #00000000 25%, #00000000 70%, #00000099 100%)" }}
      />

      <div className="relative flex flex-1 flex-col text-white" style={{ paddingTop: TOP }}>
        <div className="flex items-center gap-2.5 px-4 pt-1">
          <button
            onClick={() => ctx.go("shots")}
            aria-label="Close camera"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black/55"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </button>
          <div className="flex h-10 flex-1 items-center justify-center rounded-full bg-black/55 px-3.5">
            <span className="truncate text-[15px] font-semibold leading-5">{PILL[idx]}</span>
          </div>
          <div className="w-10 shrink-0" />
        </div>

        <div className="relative mt-4 flex-1">
          <button
            onClick={() => {
              setHowSrc(demoClip(idx));
              setHow(true);
            }}
            aria-label="See how to shoot this"
            className="absolute left-4 top-0 z-10 flex h-[106px] w-20 items-end justify-center overflow-hidden rounded-2xl border-2 border-white pb-1.5 shadow-[0_8px_20px_#00000059]"
          >
            <img src={refUrl(idx)} alt="Reference shot" className="kenburns absolute inset-0 h-full w-full object-cover" />
            <span className="relative flex h-[22px] items-center gap-1 rounded-full bg-white px-[9px] text-[12px] font-bold leading-4 text-[#0B0F19]">
              <svg width="8" height="8" viewBox="0 0 24 24" aria-hidden>
                <path d="M7 4v16l13-8z" fill="#0B0F19" />
              </svg>
              Aisa
            </span>
          </button>
          {/* framing guide */}
          <div className="pointer-events-none absolute inset-x-10 bottom-5 top-[114px] rounded-[28px] border-2 border-dashed border-white/85" />
        </div>
        {how && (
          <button onClick={() => setHow(false)} aria-label="Close example" className="fixed inset-0 z-50 mx-auto block w-full max-w-[430px] bg-black">
            <video
              key={howSrc}
              src={howSrc}
              autoPlay
              muted
              loop
              playsInline
              onError={() => howSrc !== fallbackClip(idx) && setHowSrc(fallbackClip(idx))}
              className="h-full w-full object-cover"
            />
            <span className="absolute inset-x-4 rounded-[18px] bg-black/60 px-4 py-3 text-left text-[16px] font-semibold leading-[22px] text-white" style={{ top: "max(env(safe-area-inset-top), calc(var(--top-inset, 14px) + 8px))" }}>
              {SHOTS[idx].hinglish}
            </span>
            <span className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-[14px] font-bold text-[#0B0F19]">Tap to close</span>
          </button>
        )}

        <div className="flex flex-col items-center" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 40px)" }}>
          <div className="flex h-[34px] items-center justify-center gap-2 rounded-full bg-black/55 px-4">
            <span className={`h-2 w-2 rounded-full ${rec ? "recdot bg-[#EF4444]" : "bg-white/50"}`} />
            <span className="text-[15px] font-bold leading-5 tabular-nums">
              {fmt(Math.min(secs, TARGET))} / {fmt(TARGET)}
            </span>
          </div>
          <div className="mt-[26px] flex w-full items-start justify-between px-5">
            <div className="flex h-[84px] w-[100px] shrink-0 items-center">
              <span className="flex h-[30px] items-center rounded-full bg-white/[0.18] px-2.5 text-[13px] font-semibold leading-4">
                Shot {idx + 1} of {SHOTS.length}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button
                onClick={rec ? end : begin}
                disabled={!ready}
                aria-label={rec ? "Stop recording" : "Record shot"}
                className="flex h-[84px] w-[84px] shrink-0 items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
              >
                <span
                  className={`block bg-[#EF4444] transition-all duration-200 ${rec ? "h-[34px] w-[34px] rounded-[10px]" : "h-[64px] w-[64px] rounded-full"}`}
                />
              </button>
              <span className="text-[14px] font-bold leading-[18px]">{rec ? "Recording" : "Tap to record"}</span>
            </div>
            <div className="h-[84px] w-[100px] shrink-0" />
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------- 3 · Shot N saved ---------- */

function ShotDots({ ctx, current }: { ctx: RMCtx; current: number }) {
  const next = SHOTS.findIndex((_, i) => !ctx.s.clips[i]);
  return (
    <div className="flex flex-1 items-center justify-center gap-1.5">
      {SHOTS.map((_, i) => {
        const done = !!ctx.s.clips[i];
        const color = done ? "#22C55E" : i === next ? "#1E8BFF" : "#D1D5DB";
        return <span key={i} className="h-2 shrink-0 rounded-full" style={{ width: i === current ? 28 : 8, background: color }} />;
      })}
    </div>
  );
}

function SavedScreen({ ctx }: { ctx: RMCtx }) {
  const idx = ctx.s.shot;
  const take = takes.get(idx);
  const first = ctx.s.demo ? demoClip(idx) : (take?.url ?? fallbackClip(idx));
  const [src, setSrc] = useState(first);
  const [playing, setPlaying] = useState(true);
  const vid = useRef<HTMLVideoElement>(null);
  const nextIdx = SHOTS.findIndex((_, i) => i > idx && !ctx.s.clips[i]);
  const anyMissing = SHOTS.findIndex((_, i) => !ctx.s.clips[i]);
  const upNext = nextIdx !== -1 ? nextIdx : anyMissing;
  const doneCount = ctx.s.clips.filter(Boolean).length;

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const goNext = () => {
    if (upNext === -1) return ctx.go("alldone");
    ctx.set({ shot: upNext });
    ctx.go("shoot");
  };

  return (
    <Shell>
      <div className="flex shrink-0 items-center gap-3.5 px-4 pb-2 pt-2">
        <BackBtn onClick={() => ctx.go("shots")} />
        <ShotDots ctx={ctx} current={idx} />
        <span className="shrink-0 text-[14px] font-semibold leading-[18px] text-[#6B7280]">
          {doneCount} of {SHOTS.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-2 pt-1">
        <h1 className="px-1 pb-0.5 text-[30px] font-bold leading-[34px] tracking-[-0.02em] text-[#0B0F19]">Shot {idx + 1} saved!</h1>
        <SmileyLine>{PRAISE[idx]}</SmileyLine>
        <div
          className="relative shrink-0 overflow-hidden rounded-[24px] bg-[#111] shadow-[0_8px_24px_#1018281A]"
          style={{ height: "clamp(300px, calc(100dvh - 420px), 400px)" }}
        >
          <video
            ref={vid}
            key={src}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onError={() => setSrc((s) => (s === fallbackClip(idx) ? s : fallbackClip(idx)))}
            onClick={toggle}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, #00000000 55%, #0000008C 100%)" }} />
          <span className="absolute left-3.5 top-3.5 flex h-8 items-center gap-1.5 rounded-full bg-white pl-1.5 pr-3">
            <Check size={22} icon={12} />
            <span className="text-[14px] font-bold leading-[18px] text-[#0B0F19]">Saved</span>
          </span>
          {!playing && (
            <button
              onClick={toggle}
              aria-label="Play"
              className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.92]"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" fill={INK} />
              </svg>
            </button>
          )}
          <span className="pointer-events-none absolute bottom-4 left-4 text-[14px] font-bold leading-[18px] text-white">
            {fmt(take?.secs ?? SHOTS[idx].seconds)}
          </span>
          <button
            onClick={() => ctx.go("shoot")}
            aria-label="Retake"
            className="absolute bottom-3 right-3.5 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_4px_12px_#00000033] active:scale-95"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <path d="M4 12a8 8 0 1 0 2.4-5.7M4 4v4.5h4.5" fill="none" stroke={INK} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
        {upNext !== -1 && (
          <>
            <div className="px-1 pt-1.5 text-[12px] font-bold leading-4 tracking-[0.08em] text-[#6B7280]">UP NEXT</div>
            <ShotCard i={upNext} ctx={ctx} onClick={goNext} />
          </>
        )}
      </div>
      <BottomBar>
        <BlackCta onClick={goNext} icon={<ArrowIcon />}>
          {upNext === -1 ? "See all 6 shots" : "Next shot"}
        </BlackCta>
      </BottomBar>
    </Shell>
  );
}

/* ---------- 4 · All shots done ---------- */

function AllDoneScreen({ ctx }: { ctx: RMCtx }) {
  const [busy, setBusy] = useState(false);
  const make = async () => {
    setBusy(true);
    try {
      await ctx.build();
    } finally {
      setBusy(false);
    }
  };
  const doneCount = ctx.s.clips.filter(Boolean).length;
  return (
    <Shell>
      <div className="flex shrink-0 items-center gap-3.5 px-4 pb-2 pt-2">
        <BackBtn onClick={() => ctx.go("shots")} />
        <div className="flex flex-1 items-center justify-center gap-1.5">
          {SHOTS.map((_, i) => (
            <span key={i} className="h-2 w-2 rounded-full" style={{ background: ctx.s.clips[i] ? "#22C55E" : "#D1D5DB" }} />
          ))}
        </div>
        <span className="shrink-0 text-[14px] font-semibold leading-[18px] text-[#6B7280]">
          {doneCount} of {SHOTS.length}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-2 pt-1">
        <div className="flex items-center gap-2.5 px-1 pb-0.5">
          <h1 className="text-[30px] font-bold leading-[34px] tracking-[-0.02em] text-[#0B0F19]">Sab ho gaya!</h1>
          <img src="/3d/party.png" alt="" className="bob h-10 w-10 shrink-0" />
        </div>
        <SmileyLine>6 shots + your voice. Ab Reel banate hain.</SmileyLine>
        <div className="grid shrink-0 grid-cols-3 gap-[11px] pt-1">
          {SHOTS.map((_, i) => (
            <button
              key={i}
              onClick={() => {
                ctx.set({ shot: i });
                ctx.go("saved");
              }}
              className="relative aspect-[112/196] overflow-hidden rounded-2xl bg-[#111]"
            >
              <ClipThumb i={i} demo={ctx.s.demo} />
              <span className="pointer-events-none absolute inset-0" style={{ backgroundImage: "linear-gradient(180deg, #00000000 55%, #00000099 100%)" }} />
              {ctx.s.clips[i] && (
                <span className="absolute left-2 top-2">
                  <Check ring />
                </span>
              )}
              <span className="absolute bottom-2 left-2.5 text-[12px] font-bold leading-4 text-white">
                Shot {i + 1} · {fmt(takes.get(i)?.secs ?? SHOTS[i].seconds)}
              </span>
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-[20px] bg-white py-2.5 pl-2.5 pr-3.5 shadow-[0_6px_18px_#1018280F]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF]">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M7 4v16l13-8z" fill="#1E8BFF" />
            </svg>
          </span>
          <span className="flex-1 text-[15px] font-semibold leading-5 text-[#0B0F19]">
            {ctx.s.voice ? "Your voiceover" : "Smiley's voiceover"} · 0:52
          </span>
          <Check />
        </div>
      </div>
      <BottomBar>
        <BlueCta onClick={make} busy={busy} icon={<img src="/3d/sparkles.png" alt="" className="h-[22px] w-[22px]" />}>
          Make my Reel
        </BlueCta>
      </BottomBar>
    </Shell>
  );
}

/* ---------- 5 · Team at work ---------- */

type St = "todo" | "active" | "done";

function TeamRow({ icon, bg, who, text, state, last, children }: { icon: string; bg: string; who: ReactNode; text: string; state: St; last?: boolean; children?: ReactNode }) {
  return (
    <div className={`flex items-start gap-2.5 py-2.5 ${last ? "" : "border-b border-[#EEF0F3]"} ${state === "todo" ? "opacity-50" : ""}`}>
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full" style={{ background: bg }}>
        <img src={icon} alt="" className="h-[18px] w-[18px]" />
      </span>
      <div className="flex flex-1 flex-col gap-1.5">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1 text-[12px] font-bold leading-4 text-[#6B7280]">{who}</div>
          <div className="flex items-center gap-1.5">
            <span className="text-[14px] leading-[19px] text-[#0B0F19]">{text}</span>
            {state === "done" && (
              <svg width="14" height="14" viewBox="0 0 24 24" className="shrink-0" aria-hidden>
                <path d="M5 12l5 5L20 7" fill="none" stroke="#22C55E" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
            {state === "active" && !children && (
              <span className="spin block h-3 w-3 shrink-0 rounded-full border-2 border-[#1E8BFF] border-t-transparent" />
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

function TeamScreen({ ctx }: { ctx: RMCtx }) {
  const pct = Math.max(0, Math.min(100, Math.round(ctx.pct)));
  const steps = ctx.s.job?.steps;
  // Without a job (prototype preview) derive the stages from progress.
  const stage = (from: number, to: number): St => (pct >= to ? "done" : pct >= from ? "active" : "todo");
  const writer: St = steps?.writer ?? stage(0, 25);
  const editor: St = steps ? (steps.designer === "done" ? "done" : steps.designer === "active" || steps.voice === "active" || steps.voice === "done" ? "active" : "todo") : stage(25, 85);
  const guard: St = steps?.guard ?? stage(85, 100);
  const ready = ctx.s.job?.done || pct >= 100;
  const left = Math.max(2, Math.round((100 - pct) / 5));

  const avatars = [
    { src: "/3d/smile.png", bg: "#EAF4FF" },
    { src: "/3d/scout.png", bg: "#FFF4E5" },
    { src: "/3d/pen.png", bg: "#EAF8EE" },
    { src: "/3d/clapper.png", bg: "#FDEDF3" },
  ];

  return (
    <main className="rhyme relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-[#F7F8FA]">
      <div className="flex shrink-0 flex-col border-b border-[#EEF0F3] bg-white" style={{ paddingTop: TOP }}>
        <div className="flex items-center gap-3 px-4 pb-3 pt-2">
          <BackBtn onClick={() => ctx.go("alldone")} />
          <div className="relative h-[34px] w-[104px] shrink-0">
            {avatars.map((a, i) => (
              <span
                key={a.src}
                className="absolute top-0 flex h-[34px] w-[34px] items-center justify-center rounded-full border-2 border-white"
                style={{ left: i * 23, background: a.bg }}
              >
                <img src={a.src} alt="" className="h-[22px] w-[22px]" />
              </span>
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-bold leading-[22px] text-[#0B0F19]">Your team</span>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-[#22C55E]" />
              <span className="text-[13px] leading-4 text-[#6B7280]">4 agents · online</span>
            </span>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-end gap-3 overflow-y-auto px-4 py-3">
        <div className="pop flex shrink-0 justify-end">
          <div className="flex flex-col gap-2 rounded-[18px] rounded-br-[6px] bg-[#1E8BFF] p-2">
            <div className="flex gap-1">
              {SHOTS.map((_, i) => (
                <img key={i} src={refUrl(i)} alt="" className="h-[52px] w-[38px] shrink-0 rounded-lg object-cover" />
              ))}
            </div>
            <span className="px-1 pb-0.5 text-[14px] font-semibold leading-[18px] text-white">6 shots + my voice. Make my Reel!</span>
          </div>
        </div>

        <div className="flex h-7 shrink-0 items-center gap-2 self-center rounded-full bg-[#EEF0F3] px-3">
          <span className={`h-[7px] w-[7px] rounded-full bg-[#22C55E] ${ready ? "" : "recdot"}`} />
          <span className="text-[13px] leading-4 text-[#4B5563]">
            {ready ? "Your Reel is ready" : `Team is making your Reel · about ${left} sec`}
          </span>
        </div>

        <div className="pop flex shrink-0 flex-col rounded-[20px] bg-white px-3.5 py-1 shadow-[0_6px_18px_#1018280F]">
          <TeamRow
            icon="/3d/clapper.png"
            bg="#FDEDF3"
            who="Editor"
            text={editor === "done" ? "Cut your voice over 6 clips" : "Cutting your voice over 6 clips…"}
            state={editor}
          >
            {editor !== "todo" && (
              <div className="flex items-center gap-2">
                <div className="flex h-1.5 flex-1 rounded-[3px] bg-[#E5E7EB]">
                  <div
                    className="h-1.5 rounded-[3px] transition-[width] duration-500"
                    style={{ width: `${editor === "done" ? 100 : pct}%`, backgroundImage: "linear-gradient(90deg, #1E8BFF 0%, #4FB3FF 100%)" }}
                  />
                </div>
                <span className="text-[12px] font-bold leading-4 tabular-nums text-[#1E8BFF]">{editor === "done" ? 100 : pct}%</span>
              </div>
            )}
          </TeamRow>
          <TeamRow
            icon="/3d/pen.png"
            bg="#EAF8EE"
            who={
              <>
                Writer
                <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden>
                  <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#1E8BFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Editor
              </>
            }
            text={writer === "done" ? "Added captions from your script" : "Adding captions from your script"}
            state={writer}
          />
          <TeamRow
            icon="/3d/smile.png"
            bg="#EAF4FF"
            who="Smiley"
            text={
              guard === "done"
                ? `Safe to post. Your face, home address and family aren't shown${ctx.s.job?.guard?.via ? " · on AgenticOrg" : ""}`
                : "Checking it's safe to post…"
            }
            state={guard}
            last
          />
        </div>

        <AgenticOrgCard ctx={ctx} />

        <div className="flex shrink-0 items-start gap-2">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#FDEDF3]">
            <img src="/3d/clapper.png" alt="" className="h-6 w-6" />
          </span>
          <div className="flex items-center gap-3.5 rounded-[20px] rounded-tl-[6px] bg-white py-2.5 pl-2.5 pr-4 shadow-[0_4px_14px_#1018280F]">
            <div className="relative h-[140px] w-[84px] shrink-0 overflow-hidden rounded-[14px]">
              <img
                src={refUrl(2)}
                alt=""
                className="kenburns h-full w-full object-cover transition-opacity duration-700"
                style={{ opacity: ready ? 1 : 0.5 }}
              />
            </div>
            <div className="flex w-[150px] shrink-0 flex-col gap-2">
              <span className="text-[12px] font-bold leading-4 tracking-[0.06em] text-[#1E6FD9]">{ready ? "READY" : "ALMOST READY"}</span>
              <span className="text-[16px] font-bold leading-[21px] text-[#0B0F19]">Your first Reel</span>
              <span className="h-2 w-[120px] rounded bg-[#EEF0F3]" />
              <span className="h-2 w-[84px] rounded bg-[#EEF0F3]" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex shrink-0 flex-col gap-2.5 px-4 pt-2" style={{ paddingBottom: "max(env(safe-area-inset-bottom), 28px)" }}>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => ctx.flash("Your team is busy for a few seconds. Reply when the Reel is ready.")}
            className="flex h-11 flex-1 items-center rounded-full border border-[#E5E7EB] bg-white px-4 text-left text-[15px] leading-5 text-[#9CA3AF]"
          >
            Type a message
          </button>
          <button
            onClick={() => ctx.flash("Your team is busy for a few seconds. Reply when the Reel is ready.")}
            aria-label="Voice message"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EAF4FF]"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="#1E8BFF" strokeWidth="2.2" />
              <path d="M5 11a7 7 0 0 0 14 0M12 18v3" fill="none" stroke="#1E8BFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </main>
  );
}

// Which agents ran on AgenticOrg (Pine Labs) and how long each took.
function AgenticOrgCard({ ctx }: { ctx: RMCtx }) {
  const team = ctx.s.team;
  const g = ctx.s.job?.guard;
  const rows: [string, string, number | null | undefined][] = [];
  if (team?.via) {
    rows.push(["/3d/scout.png", "Scout", team.ms?.scout], ["/3d/pen.png", "Writer", team.ms?.writer], ["/3d/clapper.png", "Editor", team.ms?.editor]);
  }
  if (g?.via) rows.push(["/3d/smile.png", "Smiley · Guard", g.ms]);
  if (!rows.length) return null;
  const sec = (ms?: number | null) => (ms ? `${(ms / 1000).toFixed(1)}s` : "…");
  return (
    <div className="pop flex shrink-0 flex-col gap-2 rounded-[20px] bg-white px-3.5 py-3 shadow-[0_6px_18px_#1018280F]">
      <span className="flex items-center gap-1.5 text-[12px] font-bold uppercase leading-4 tracking-[0.06em] text-[#1E6FD9]">
        <span className="h-[7px] w-[7px] rounded-full bg-[#22C55E]" /> Ran on AgenticOrg
      </span>
      <div className="flex flex-wrap gap-1.5">
        {rows.map(([icon, who, ms]) => (
          <span key={who} className="flex items-center gap-1.5 rounded-full bg-[#F3F4F6] py-1 pl-1 pr-2.5 text-[12px] font-semibold leading-4 text-[#0B0F19]">
            <img src={icon} alt="" className="h-5 w-5" />
            {who} <span className="tabular-nums text-[#6B7280]">{sec(ms)}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- 6 · Your intro Reel ---------- */

function ReelScreen({ ctx }: { ctx: RMCtx }) {
  const job = ctx.s.job;
  const src = job?.reels?.en ?? "/demo/intro-en.mp4";
  const caption =
    job?.captions?.en ??
    "Fresh, home-style tiffins from my kitchen in Gomti Nagar. WhatsApp me before 11, lunch at your office by 1.";
  const vid = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [prog, setProg] = useState(0);
  const [dur, setDur] = useState<number>(job?.duration ?? 52);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const v = vid.current;
    if (!v) return;
    v.muted = false;
    v.play().catch(() => {
      v.muted = true;
      setMuted(true);
      v.play().catch(() => {});
    });
  }, [src]);

  const toggle = () => {
    const v = vid.current;
    if (!v) return;
    if (muted) {
      v.muted = false;
      setMuted(false);
      v.play().catch(() => {});
      return;
    }
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  };
  const post = async () => {
    setBusy(true);
    try {
      await ctx.postIt();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell>
      <div className="flex shrink-0 items-center gap-3.5 px-4 pb-2 pt-2">
        <BackBtn onClick={() => ctx.go("alldone")} />
      </div>
      <div className="flex flex-1 flex-col gap-2.5 px-4 pb-2 pt-1">
        <h1 className="px-1 pb-0.5 text-[30px] font-bold leading-[34px] tracking-[-0.02em] text-[#0B0F19]">
          Your first Reel · {fmt(job?.duration ?? dur)}
        </h1>
        <div
          className="relative shrink-0 self-center overflow-hidden rounded-[28px] bg-[#111] shadow-[0_16px_40px_#1018282E]"
          style={{ height: "clamp(360px, calc(100dvh - 330px), 498px)", aspectRatio: "280 / 498" }}
        >
          <video
            ref={vid}
            src={src}
            autoPlay
            playsInline
            loop
            onClick={toggle}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            onLoadedMetadata={(e) => {
              if (!job?.duration && Number.isFinite(e.currentTarget.duration)) setDur(e.currentTarget.duration);
            }}
            onTimeUpdate={(e) => {
              const v = e.currentTarget;
              if (v.duration) setProg(v.currentTime / v.duration);
            }}
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundImage: "linear-gradient(180deg, #00000040 0%, #00000000 25%, #00000000 55%, #0000008C 100%)" }}
          />
          {!playing && (
            <button
              onClick={toggle}
              aria-label="Play"
              className="absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/[0.92]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                <path d="M8 5v14l11-7z" fill={INK} />
              </svg>
            </button>
          )}
          {muted && playing && (
            <button
              onClick={toggle}
              className="pop absolute left-1/2 top-4 flex h-8 -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[13px] font-semibold text-white"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
                <path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff" />
                <path d="M17 9l4 6M21 9l-4 6" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
              </svg>
              Tap for sound
            </button>
          )}
          <div className="pointer-events-none absolute inset-x-4 bottom-4 flex items-center gap-2.5">
            <div className="flex h-1 flex-1 rounded-sm bg-white/35">
              <div className="h-1 rounded-sm bg-white" style={{ width: `${prog * 100}%` }} />
            </div>
            <span className="text-[13px] font-bold leading-4 tabular-nums text-white">{fmt(job?.duration ?? dur)}</span>
          </div>
        </div>
        <div className="flex shrink-0 justify-center gap-2">
          <span className="flex h-[30px] items-center rounded-full bg-[#EAF4FF] px-3 text-[13px] font-semibold leading-4 text-[#1E6FD9]">
            {ctx.s.voice && ctx.s.job?.voiceKind !== "stock" ? "Your voice" : "Smiley's voice"}
          </span>
          <span className="flex h-[30px] items-center rounded-full bg-[#EAF4FF] px-3 text-[13px] font-semibold leading-4 text-[#1E6FD9]">
            Your kitchen
          </span>
          <span className="flex h-[30px] items-center gap-1.5 rounded-full bg-[#E7F8EE] pl-2 pr-3 text-[13px] font-semibold leading-4 text-[#15803D]">
            <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3l7 3v5.5c0 4.4-3 8.2-7 9.5-4-1.3-7-5.1-7-9.5V6z" fill="#22C55E" />
              <path d="M8.5 12l2.5 2.5 4.5-5" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Safe to post
          </span>
        </div>
        {job?.guard?.escalated ? (
          <div className="mx-2 flex items-start gap-2.5 rounded-[16px] border-[1.5px] border-[#F2B544] bg-[#FFF6E0] px-3 py-2.5">
            <span className="spin mt-0.5 block h-4 w-4 shrink-0 rounded-full border-2 border-[#B7791F] border-t-transparent" />
            <span className="flex flex-col">
              <span className="text-[14px] font-bold leading-[18px] text-[#5C4A1E]">Waiting for your OK</span>
              <span className="text-[12px] leading-4 text-[#7A6230]">
                Smiley flagged something and sent it to a human reviewer on AgenticOrg.{job.guard.approval?.status ? ` Status: ${job.guard.approval.status}.` : ""}
              </span>
            </span>
          </div>
        ) : (
          <span className="flex items-start justify-center gap-1.5 px-3 text-center text-[12px] font-semibold leading-4 text-[#15803D]">
            <img src="/3d/smile.png" alt="" className="mt-px h-4 w-4 shrink-0" />
            <span>
              Smiley checked: your face, home address and family aren&apos;t shown.
              {job?.guard?.via ? <span className="text-[#6B7280]"> On AgenticOrg{job.guard.ms ? ` · ${(job.guard.ms / 1000).toFixed(1)}s` : ""}</span> : null}
            </span>
          </span>
        )}
        <p className="line-clamp-2 px-2 text-center text-[13px] leading-[18px] text-[#6B7280]">{caption}</p>
      </div>
      <BottomBar pb={26} gap={14}>
        <BlueCta
          onClick={post}
          busy={busy}
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="5.5" fill="none" stroke="#fff" strokeWidth="2.2" />
              <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="2.2" />
              <circle cx="17.3" cy="6.7" r="1.3" fill="#fff" />
            </svg>
          }
        >
          Post it free
        </BlueCta>
        <button
          onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank")}
          className="text-center text-[15px] font-semibold leading-5 text-[#1E6FD9]"
        >
          Share to WhatsApp Status
        </button>
      </BottomBar>
    </Shell>
  );
}
