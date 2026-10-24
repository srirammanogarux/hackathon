"use client";
import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes, CSSProperties } from "react";

export function Screen({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <main
      className={`relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-x-clip bg-white ${className}`}
      style={{ paddingTop: "max(env(safe-area-inset-top), 12px)", ...style }}
    >
      {children}
    </main>
  );
}

type Face = "smile" | "focus" | "happy";
const FACES: Record<Face, string[]> = {
  smile: ["M14 10v6", "M60 10v6", "M14 28c10 12 36 12 46 0"],
  focus: ["M12 12h8", "M54 12h8", "M22 30c8 6 22 6 30 0"],
  happy: ["M10 14c3-5 7-5 10 0", "M54 14c3-5 7-5 10 0", "M14 26c10 14 36 14 46 0"],
};

export function Orb({ size = 64, face = "smile", glow = true, className = "" }: { size?: number; face?: Face; glow?: boolean; className?: string }) {
  const w = Math.round(size * 0.5);
  const sw = size >= 120 ? 5 : size >= 60 ? 6 : 7;
  return (
    <div
      className={`orb flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        boxShadow: glow ? (size >= 120 ? "inset 0 -10px 20px #5A46DC33, 0 24px 50px #7C6CFF59" : `0 ${Math.round(size / 6)}px ${Math.round(size / 2.6)}px #7C6CFF4D`) : undefined,
      }}
      aria-hidden
    >
      <svg width={w} height={Math.round((w * 44) / 74)} viewBox="0 0 74 44" fill="none" stroke="#2A2350" strokeWidth={sw} strokeLinecap="round">
        {FACES[face].map((d) => (
          <path key={d} d={d} />
        ))}
      </svg>
    </div>
  );
}

export function Squiggle({ width = 120 }: { width?: number }) {
  return (
    <svg width={width} height={12} viewBox="0 0 120 12" aria-hidden>
      <path d="M2 8c8-6 14-6 20 0s12 6 20 0 14-6 20 0 12 6 20 0 14-6 20 0 12 6 18 0" fill="none" stroke="#7C6CFF" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { href?: string; children: ReactNode };

export function PrimaryButton({ href, children, className = "", ...rest }: BtnProps) {
  const cls = `btn-primary font-display flex h-[60px] w-full items-center justify-center gap-2.5 rounded-full text-[18px] font-bold leading-[22px] text-white transition active:scale-[0.98] disabled:opacity-60 ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export function GhostButton({ href, children, className = "", ...rest }: BtnProps) {
  const cls = `font-display flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-white text-[16px] font-bold leading-5 text-ink transition active:scale-[0.98] disabled:opacity-50 ${className}`;
  if (href) return <Link href={href} className={cls}>{children}</Link>;
  return <button className={cls} {...rest}>{children}</button>;
}

export function BackButton({ href, onClick, bg = "bg-chip" }: { href?: string; onClick?: () => void; bg?: string }) {
  const inner = (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="m15 18-6-6 6-6" fill="none" stroke="#17142B" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
  const cls = `flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg}`;
  if (href) return <Link href={href} aria-label="Back" className={cls}>{inner}</Link>;
  return <button aria-label="Back" onClick={onClick ?? (() => history.back())} className={cls}>{inner}</button>;
}

export function Check({ color = "#6A58F5", bg = "#EDE9FF", size = 26 }: { color?: string; bg?: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: size, height: size, background: bg }}>
      <svg width={size / 2} height={size / 2} viewBox="0 0 24 24" aria-hidden>
        <path d="m5 12 5 5 9-10" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Spinner({ color = "#F28AB0", size = 22 }: { color?: string; size?: number }) {
  return (
    <span
      className="spin block shrink-0 rounded-full"
      style={{ width: size, height: size, border: `3px solid ${color}`, borderTopColor: "transparent" }}
      aria-label="Loading"
    />
  );
}

export function MicIcon({ color = "#FFFFFF", size = 20 }: { color?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <path d="M12 17v4" />
    </svg>
  );
}

// Small stroke icons used on option cards and agent rows.
export const ICONS: Record<string, ReactNode> = {
  user: (<><circle cx="12" cy="8" r="4" /><path d="M5 21a7 7 0 0 1 14 0" /></>),
  hand: <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8a8 8 0 0 0 16 0v-3a2 2 0 0 0-4 0" />,
  wave: (<><path d="M2 10v3" /><path d="M6 6v11" /><path d="M10 3v18" /><path d="M14 8v7" /><path d="M18 5v13" /><path d="M22 10v3" /></>),
  star: <path d="M12 3l1.9 5.8H20l-4.9 3.6 1.9 5.8L12 14.6l-5 3.6 1.9-5.8L4 8.8h6.1z" />,
  pot: (<><path d="M4 10h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" /><path d="M2 10h20" /><path d="M9 6c0-1 1-1 1-2M14 6c0-1 1-1 1-2" /></>),
  plus: (<><rect x="3" y="3" width="18" height="18" rx="4" /><path d="M12 8v8M8 12h8" /></>),
  shop: (<><path d="M3 9l1.5-5h15L21 9" /><path d="M4 9v11h16V9" /><path d="M3 9h18" /><path d="M10 20v-6h4v6" /></>),
  home: (<><path d="M3 11l9-7 9 7" /><path d="M5 10v10h14V10" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  calendar: (<><rect x="3" y="4" width="18" height="17" rx="3" /><path d="M3 9h18M8 2v4M16 2v4" /></>),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10" />,
  rupee: (<><path d="M6 4h12M6 9h12M6 4h3a5 5 0 0 1 0 10H6l9 7" /></>),
  trend: (<><path d="M3 3v18h18" /><path d="m7 15 4-4 3 3 5-6" /></>),
  eyeoff: (<><path d="M3 3l18 18" /><path d="M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-3.2 3.7M6.6 6.6C4.3 8.2 3 12 3 12s4 6 9 6a9 9 0 0 0 4.4-1.1" /></>),
  family: (<><circle cx="8" cy="7" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M2 20a6 6 0 0 1 12 0M14 20a4 4 0 0 1 8 0" /></>),
  pin: (<><path d="M12 21s7-6 7-12a7 7 0 0 0-14 0c0 6 7 12 7 12" /><circle cx="12" cy="9" r="2.5" /></>),
  ok: <path d="m5 12 5 5 9-10" />,
  search: (<><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>),
  pen: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>),
  image: (<><rect x="3" y="3" width="18" height="18" rx="3" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" /></>),
  shield: (<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" /><path d="m9 12 2 2 4-4" /></>),
  redo: (<><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" /></>),
  camera: (<><path d="M4 7h3l2-3h6l2 3h3v13H4z" /><circle cx="12" cy="13" r="4" /></>),
};

export function Icon({ name, size = 22, color = "#17142B" }: { name: string; size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name] ?? ICONS.star}
    </svg>
  );
}

export function Toast({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <div className="pop fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[340px] rounded-full bg-ink px-4 py-2.5 text-center text-[14px] leading-5 text-white shadow-lg">
      {text}
    </div>
  );
}
