"use client";
// Intro Reel screens: voiceover teleprompter and the guided camera shoot.
import { useEffect, useRef, useState } from "react";
import { SHOTS, refUrl, fallbackClip, demoClip } from "@/lib/introShots";

const EST_TOTAL = 50; // seconds, for the teleprompter highlight

function useRecorder(kind: "audio" | "video") {
  const rec = useRef<MediaRecorder | null>(null);
  const start = (stream: MediaStream, onBlob: (b: Blob) => void) => {
    const mime = kind === "video" ? (MediaRecorder.isTypeSupported("video/mp4") ? "video/mp4" : "video/webm") : undefined;
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => onBlob(new Blob(chunks, { type: r.mimeType || (kind === "video" ? "video/webm" : "audio/webm") }));
    r.start(250);
    rec.current = r;
  };
  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
    rec.current = null;
  };
  return { start, stop };
}

/* ---------- Record voiceover (teleprompter) ---------- */

export function VoiceTeleprompter({
  lines,
  taken,
  onTake,
  flash,
}: {
  lines: string[];
  taken: boolean;
  onTake: (file: string | null) => void;
  flash: (s: string) => void;
}) {
  const [rec, setRec] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const { start, stop } = useRecorder("audio");

  // Which line she should be reading: cumulative share of characters vs elapsed share of ~50 s.
  const weights = lines.map((l) => l.length);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const cur = rec ? Math.min(lines.length - 1, weights.findIndex((w) => ((acc += w) / total) * EST_TOTAL > secs)) : -1;

  async function begin() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      start(stream, upload);
      setSecs(0);
      timer.current = setInterval(() => setSecs((s) => s + 0.25), 250);
      setRec(true);
    } catch {
      flash("No mic access. Smiley's voice will read it for now.");
      onTake(null);
    }
  }
  function end() {
    stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (timer.current) clearInterval(timer.current);
    setRec(false);
  }
  async function upload(blob: Blob) {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voiceover.webm");
      fd.append("idx", "9");
      const r = await fetch("/api/funnel/transcribe", { method: "POST", body: fd }).then((r) => r.json());
      onTake(r.file ?? null);
    } catch {
      onTake(null);
    }
    setBusy(false);
  }
  useEffect(() => () => end(), []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="flex flex-col gap-3 px-6 pt-4">
        {lines.map((l, i) => (
          <p
            key={i}
            className="text-[21px] font-semibold leading-[29px] transition-colors duration-300"
            style={{ color: !rec ? "#111827" : i === cur ? "#111827" : i < cur ? "#C4C9D2" : "#9CA3AF" }}
          >
            {l}
          </p>
        ))}
      </div>
      <div className="flex-1" />
      {!taken && (
        <div className="sticky bottom-0 mx-4 mb-6 mt-4 flex items-center gap-3 rounded-full bg-white p-2 pr-5 shadow-[0_12px_30px_rgba(16,24,40,0.12)]">
          <button
            onClick={rec ? end : begin}
            disabled={busy}
            aria-label={rec ? "Stop recording" : "Start recording"}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#FF3B30] disabled:opacity-50"
          >
            {busy ? (
              <span className="spin block h-5 w-5 rounded-full border-[2.5px] border-white border-t-transparent" />
            ) : rec ? (
              <span className="block h-4 w-4 rounded-[4px] bg-white" />
            ) : (
              <span className="block h-4 w-4 rounded-full bg-white" />
            )}
          </button>
          <span className="flex-1 text-[15px] font-semibold">
            {busy ? "Saving your take…" : rec ? (
              <span className="flex items-center gap-2">
                <span className="recdot h-2 w-2 rounded-full bg-[#FF3B30]" /> Recording · read slowly
              </span>
            ) : (
              "Tap and read it out, one take"
            )}
          </span>
          <span className="text-[15px] font-semibold tabular-nums text-[#6B7280]">
            {Math.floor(secs / 60)}:{String(Math.floor(secs % 60)).padStart(2, "0")}
          </span>
        </div>
      )}
    </>
  );
}

/* ---------- Guided shoot (live camera) ---------- */

// Headless browsers / no camera: an animated canvas stream so MediaRecorder still works.
function fakeStream(label: string): MediaStream {
  const c = document.createElement("canvas");
  c.width = 540;
  c.height = 960;
  const g = c.getContext("2d")!;
  let t = 0;
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
    requestAnimationFrame(draw);
  };
  draw();
  return c.captureStream(30);
}

export function ShootScreen({
  idx,
  demo,
  onSaved,
  onNext,
  onBack,
}: {
  idx: number;
  demo: boolean;
  onSaved: (idx: number, file: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const shot = SHOTS[idx];
  const TARGET = shot.seconds;
  const live = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [rec, setRec] = useState(false);
  const [secs, setSecs] = useState(0);
  const [saved, setSaved] = useState<string | null>(null); // local blob URL of her take
  const [useFallback, setUseFallback] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const { start, stop } = useRecorder("video");

  useEffect(() => {
    let cancelled = false;
    setSaved(null);
    setUseFallback(false);
    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false });
      } catch {
        stream = fakeStream("Camera preview");
      }
      if (cancelled) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      if (live.current) {
        live.current.srcObject = stream;
        live.current.play().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
      stop();
      if (timer.current) clearInterval(timer.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    if (!streamRef.current) return;
    start(streamRef.current, async (blob) => {
      setSaved(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("video", blob, `shot-${idx + 1}.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      fd.append("idx", String(idx + 1));
      const r = await fetch("/api/intro/clip", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({ file: null }));
      onSaved(idx, r.file ?? null);
    });
    setSecs(0);
    setRec(true);
    timer.current = setInterval(() => {
      setSecs((s) => {
        const n = s + 0.1;
        if (n >= TARGET) end();
        return n;
      });
    }, 100);
  }
  function end() {
    if (timer.current) clearInterval(timer.current);
    stop();
    setRec(false);
  }

  const last = idx === SHOTS.length - 1;

  if (saved) {
    // Demo swap: show the AI demo footage for this shot instead of the raw take when the demo flag is on.
    const src = demo ? (useFallback ? fallbackClip(idx) : demoClip(idx)) : saved;
    return (
      <main className="rhyme relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#0B0B0F] text-white" style={{ paddingTop: "max(env(safe-area-inset-top), var(--top-inset, 14px))" }}>
        <div className="flex items-center justify-between px-5 pt-1">
          <span className="text-[14px] font-semibold text-white/70">Shot {idx + 1} of {SHOTS.length}</span>
          <div className="flex gap-1">
            {SHOTS.map((_, i) => (
              <span key={i} className="h-1.5 w-6 rounded-full" style={{ background: i <= idx ? "#4FB3FF" : "#FFFFFF33" }} />
            ))}
          </div>
        </div>
        <div className="relative mx-auto mt-4">
          <video key={src} src={src} autoPlay muted loop playsInline onError={() => demo && setUseFallback(true)} className="h-[470px] rounded-[26px] bg-black object-cover" style={{ aspectRatio: "9/16" }} />
          <span className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-[#1F9D57] px-3 py-1 text-[13px] font-semibold">✓ Shot {idx + 1} saved</span>
        </div>
        <p className="mx-6 mt-4 text-center text-[15px] leading-[22px] text-white/75">“{shot.title}” looks good. Smiley will cut it to your voice.</p>
        <div className="flex-1" />
        <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-4">
          <button
            onClick={onNext}
            className={`flex h-14 w-full items-center justify-center gap-2 rounded-full text-[17px] font-semibold active:scale-[0.98] ${last ? "btn-blue text-white" : "bg-white text-[#111]"}`}
          >
            {last ? "Make my Reel" : `Next: shot ${idx + 2}`}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
          <button onClick={() => setSaved(null)} className="text-[15px] font-semibold text-[#4FB3FF]">Retake</button>
        </div>
      </main>
    );
  }

  const pct = Math.min(1, secs / TARGET);
  return (
    <main className="rhyme relative mx-auto flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-black text-white">
      <video ref={live} muted playsInline autoPlay className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-black/60 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/70 to-transparent" />
      <div className="relative flex items-start gap-3 px-4" style={{ paddingTop: "max(env(safe-area-inset-top), var(--top-inset, 14px))" }}>
        <div className="relative h-[136px] w-[78px] shrink-0 overflow-hidden rounded-[14px] border-2 border-white/90 shadow-lg">
          <img src={refUrl(idx)} alt="Reference" className="kenburns h-full w-full object-cover" />
          <span className="absolute bottom-1 left-1 rounded-full bg-black/55 px-1.5 text-[10px] font-semibold">Like this</span>
        </div>
        <div className="flex flex-1 flex-col items-end gap-2 pt-1">
          <button onClick={onBack} aria-label="Back to shot list" className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
          <span className="rounded-full bg-black/45 px-3 py-1 text-[13px] font-semibold">Shot {idx + 1} of {SHOTS.length}</span>
        </div>
      </div>
      <div className="relative mx-4 mt-3 rounded-[18px] bg-black/55 px-4 py-3 text-[16px] font-semibold leading-[22px] backdrop-blur">{shot.hinglish}</div>
      <div className="flex-1" />
      <div className="relative flex flex-col items-center gap-3 pb-10">
        <span className="rounded-full bg-black/45 px-3 py-1 text-[15px] font-semibold tabular-nums">
          {rec && <span className="recdot mr-1.5 inline-block h-2 w-2 rounded-full bg-[#FF3B30] align-middle" />}
          0:{String(Math.floor(secs)).padStart(2, "0")} / 0:{String(TARGET).padStart(2, "0")}
        </span>
        <button onClick={rec ? end : begin} aria-label={rec ? "Stop recording" : "Record shot"} className="relative flex h-[84px] w-[84px] items-center justify-center">
          <svg width="84" height="84" viewBox="0 0 84 84" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="42" cy="42" r="38" fill="none" stroke="#FFFFFF66" strokeWidth="5" />
            <circle cx="42" cy="42" r="38" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeDasharray={2 * Math.PI * 38} strokeDashoffset={(1 - pct) * 2 * Math.PI * 38} strokeLinecap="round" />
          </svg>
          <span className={`block bg-[#FF3B30] transition-all ${rec ? "h-7 w-7 rounded-[8px]" : "h-[62px] w-[62px] rounded-full"}`} />
        </button>
        <span className="text-[13px] text-white/70">{rec ? "Hold steady…" : "Tap to record about 8 seconds"}</span>
      </div>
    </main>
  );
}
