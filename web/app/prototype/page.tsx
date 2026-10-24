"use client";
import { useEffect, useState } from "react";

// Stage shell: the whole Reels Magic demo as ONE continuous flow inside an iPhone mockup.
// Advanced only by tapping inside the app (the app shows "Tap here" hints in embed mode).

const SERVICES = [
  { key: "elevenlabs", label: "ElevenLabs" },
  { key: "gemini", label: "Gemini" },
  { key: "instagram", label: "Instagram" },
];

function StatusBar() {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex h-[54px] items-center justify-between px-8 pt-1.5 text-[16px] font-semibold text-black">
      <span className="w-[54px] text-center">9:41</span>
      <span className="flex items-center gap-1.5">
        <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden><g fill="#000"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="6" width="3" height="6" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></g></svg>
        <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden><path d="M8 2.5c2.3 0 4.4.9 6 2.4l1-1A10 10 0 0 0 8 1 10 10 0 0 0 1 3.9l1 1a8.6 8.6 0 0 1 6-2.4Zm0 3.2c1.4 0 2.7.5 3.7 1.4l1-1A7 7 0 0 0 8 4.3 7 7 0 0 0 3.3 6.1l1 1c1-.9 2.3-1.4 3.7-1.4Zm0 3.1c.6 0 1.2.2 1.6.6L8 11 6.4 9.4c.4-.4 1-.6 1.6-.6Z" fill="#000" /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13" aria-hidden><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke="#000" opacity=".35" /><rect x="2" y="2" width="20" height="9" rx="2.2" fill="#000" /><path d="M25 4.5v4a2 2 0 0 0 0-4Z" fill="#000" opacity=".4" /></svg>
      </span>
    </div>
  );
}

function IPhone({ src }: { src: string }) {
  return (
    <div className="relative" style={{ width: 434, height: 888 }}>
      {/* side buttons */}
      <span className="absolute -left-[3px] top-[150px] h-8 w-[4px] rounded-l bg-[#3a3a3e]" />
      <span className="absolute -left-[3px] top-[205px] h-14 w-[4px] rounded-l bg-[#3a3a3e]" />
      <span className="absolute -left-[3px] top-[275px] h-14 w-[4px] rounded-l bg-[#3a3a3e]" />
      <span className="absolute -right-[3px] top-[230px] h-24 w-[4px] rounded-r bg-[#3a3a3e]" />
      {/* titanium frame */}
      <div
        className="absolute inset-0 rounded-[68px] p-[4px]"
        style={{
          background: "linear-gradient(145deg, #8e8a96 0%, #4a4752 22%, #2b2930 50%, #5a5662 78%, #9c98a4 100%)",
          boxShadow: "0 50px 100px -20px #2A235066, 0 30px 60px -30px #00000080, inset 0 0 0 1px #ffffff22",
        }}
      >
        {/* black bezel */}
        <div className="h-full w-full rounded-[64px] bg-[#0b0b0d] p-[18px]">
          {/* screen */}
          <div className="relative h-[844px] w-[390px] overflow-hidden rounded-[48px] bg-white">
            <iframe key={src} src={src} title="Reels Magic" className="absolute inset-0 h-[844px] w-[390px] border-0" allow="microphone; autoplay; clipboard-write" />
            <StatusBar />
            {/* dynamic island */}
            <div className="pointer-events-none absolute left-1/2 top-[11px] z-30 h-[37px] w-[125px] -translate-x-1/2 rounded-full bg-black">
              <span className="absolute right-[18px] top-1/2 h-[11px] w-[11px] -translate-y-1/2 rounded-full bg-[#1a1a2e] ring-1 ring-[#2a2a40]" />
            </div>
            {/* home indicator */}
            <div className="pointer-events-none absolute bottom-[8px] left-1/2 z-30 h-[5px] w-[134px] -translate-x-1/2 rounded-full bg-black/80" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Prototype() {
  const [src, setSrc] = useState("/?reset=1&embed=1&demo=1");
  const [cfg, setCfg] = useState<Record<string, boolean> | null>(null);
  const [ao, setAo] = useState<{ connected: boolean } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/funnel/config").then((r) => r.json()).then(setCfg).catch(() => setCfg({}));
    fetch("/api/agenticorg/status").then((r) => r.json()).then(setAo).catch(() => setAo({ connected: false }));
  }, []);

  const services = [...SERVICES.map((x) => ({ label: x.label, on: !!cfg?.[x.key] })), { label: "AgenticOrg", on: !!ao?.connected }];
  const live = services.filter((x) => x.on).length;

  return (
    <div className="rhyme relative flex h-dvh items-center justify-center overflow-hidden" style={{ background: "radial-gradient(ellipse 70% 60% at 50% 45%, #FFFFFF 0%, #DCEEFF 45%, #B9DDFF 100%)" }}>
      <img src="/3d/cloud.png" alt="" className="bob pointer-events-none absolute left-[12%] top-[10%] w-[160px] opacity-90" />
      <img src="/3d/cloud.png" alt="" className="bob pointer-events-none absolute right-[10%] top-[16%] w-[200px] opacity-80" style={{ animationDelay: "1.2s" }} />
      <img src="/3d/cloud.png" alt="" className="bob pointer-events-none absolute bottom-[10%] right-[18%] w-[130px] opacity-70" style={{ animationDelay: "2.1s" }} />
      <img src="/3d/cloud.png" alt="" className="bob pointer-events-none absolute bottom-[16%] left-[16%] w-[110px] opacity-60" style={{ animationDelay: ".6s" }} />

      <div className="relative z-10 origin-center" style={{ transform: "scale(min(1, calc((100vh - 24px) / 888px)))" }}>
        <IPhone src={src} />
      </div>

      <div className="absolute right-5 top-5 z-20 flex items-center gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] shadow-[0_4px_14px_#17142B0F] backdrop-blur"
          aria-expanded={open}
        >
          <span className="h-2 w-2 rounded-full" style={{ background: live ? "#22C55E" : "#D1D5DB" }} />
          {cfg ? (live ? `${live} live` : "Mock") : "…"}
        </button>
        <button
          onClick={() => setSrc(`/?reset=1&embed=1&demo=1&t=${Date.now()}`)}
          className="rounded-full bg-white/80 px-3 py-1.5 text-[12px] font-semibold text-[#4B5563] shadow-[0_4px_14px_#17142B0F] backdrop-blur hover:text-[#111]"
        >
          Restart
        </button>
        {open && (
          <ul className="absolute right-0 top-9 flex w-[180px] flex-col gap-1.5 rounded-2xl bg-white/95 p-3 text-[12px] shadow-[0_10px_30px_#17142B1A]">
            {services.map((x) => (
              <li key={x.label} className="flex items-center justify-between">
                <span className="font-semibold">{x.label}</span>
                <span className="flex items-center gap-1.5" style={{ color: x.on ? "#15803D" : "#9CA3AF" }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: x.on ? "#22C55E" : "#D1D5DB" }} />
                  {x.on ? "Live" : "Mock"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
