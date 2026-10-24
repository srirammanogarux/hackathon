"use client";
import { useEffect, useState, type ReactNode } from "react";

export type ScreenProps = {
  onNext: () => void;
  autoplay: boolean;
  hideStatusBar?: boolean;
};

export function StatusBar({ dark = false, hidden = false }: { dark?: boolean; hidden?: boolean }) {
  if (hidden) return null;
  const c = dark ? "#fff" : "#000";
  return (
    <div className="v2-ios relative z-20 flex h-[54px] shrink-0 items-center justify-between px-[34px] pt-[6px]" style={{ color: c }}>
      <span className="w-[54px] text-center text-[17px] font-semibold tracking-tight">9:41</span>
      <span className="flex items-center gap-[6px]">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden>
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={i * 4.6} y={9 - i * 3} width="3.2" height={3 + i * 3} rx="1" fill={c} />
          ))}
        </svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden fill={c}>
          <path d="M8 2.2c2.4 0 4.6.9 6.2 2.5l1.2-1.2A10.4 10.4 0 0 0 8 .5C5.1.5 2.5 1.6.6 3.5l1.2 1.2A8.7 8.7 0 0 1 8 2.2Z" />
          <path d="M8 5.6c1.5 0 2.8.6 3.8 1.5L13 5.9a7 7 0 0 0-10 0l1.2 1.2c1-.9 2.3-1.5 3.8-1.5Z" />
          <path d="M8 9c.6 0 1.1.2 1.5.6L8 11.2 6.5 9.6c.4-.4.9-.6 1.5-.6Z" />
        </svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden>
          <rect x=".5" y=".5" width="23" height="12" rx="3.8" fill="none" stroke={c} strokeOpacity=".4" />
          <rect x="2" y="2" width="20" height="9" rx="2.5" fill={c} />
          <path d="M25 4.5v4c.8-.3 1.3-1.1 1.3-2s-.5-1.7-1.3-2Z" fill={c} fillOpacity=".45" />
        </svg>
      </span>
    </div>
  );
}

export function HomeIndicator({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex h-[22px] shrink-0 items-end justify-center pb-[8px]">
      <div className={`h-[5px] w-[134px] rounded-full ${dark ? "bg-white" : "bg-black"}`} />
    </div>
  );
}

const AVATAR_COLORS = ["#F59E0B", "#10B981", "#6366F1", "#EC4899", "#0EA5E9", "#EF4444", "#8B5CF6", "#14B8A6"];

export function Avatar({ name, src, size = 32, ring = false }: { name: string; src?: string; size?: number; ring?: boolean }) {
  const color = AVATAR_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const inner = src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="h-full w-full rounded-full object-cover" />
  ) : (
    <span className="flex h-full w-full items-center justify-center rounded-full font-semibold text-white" style={{ background: color, fontSize: size * 0.4 }}>
      {name.replace(/[^A-Za-z ]/g, "").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
    </span>
  );
  if (!ring) return <span className="block shrink-0" style={{ width: size, height: size }}>{inner}</span>;
  return (
    <span
      className="block shrink-0 rounded-full p-[2px]"
      style={{ width: size + 6, height: size + 6, background: "linear-gradient(45deg,#FEDA75,#FA7E1E,#D62976,#962FBF,#4F5BD5)" }}
    >
      <span className="block h-full w-full rounded-full bg-white p-[2px]">{inner}</span>
    </span>
  );
}

export function SmileyFace({ size = 16 }: { size?: number }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src="/v2/smile.png" alt="" width={size} height={size} className="shrink-0" style={{ width: size, height: size }} />;
}

/** The small "done by Smiley" marker that appears under replies. */
export function SmileyBadge({ children = "Replied by Smiley · your tone", tone = "light" }: { children?: ReactNode; tone?: "light" | "dark" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full py-[2px] pl-[3px] pr-2 text-[11px] font-medium ${
        tone === "dark" ? "bg-white/15 text-white" : "bg-[#E8F3FF] text-[#1468C7]"
      }`}
    >
      <SmileyFace size={14} />
      {children}
    </span>
  );
}

export function TypingDots({ color = "#8E8E93" }: { color?: string }) {
  return (
    <span className="inline-flex items-center gap-[4px]">
      {[0, 1, 2].map((i) => (
        <span key={i} className="v2-dot block h-[7px] w-[7px] rounded-full" style={{ background: color, animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

/** Reveals 0..n over time following a schedule of delays (ms after mount). */
export function useReveal(delays: number[]) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const timers = delays.map((d, i) => setTimeout(() => setShown((s) => Math.max(s, i + 1)), d));
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return shown;
}

/** Wraps a tap target: stops the tap from bubbling to the tap-to-advance layer. */
export function tap(fn: () => void) {
  return (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    fn();
  };
}

