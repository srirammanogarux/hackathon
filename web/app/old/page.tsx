"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, Squiggle, PrimaryButton } from "@/components/ui";
import { PILLS, type UiLang } from "@/lib/lang";
import { load, save } from "@/lib/store";

const STICKERS = [
  { text: "Kitchen?", bg: "#FFF1C9", style: { left: 44, top: 70, rotate: "-8deg" } },
  { text: "Clinic?", bg: "#DDF4E6", style: { right: 36, top: 96, rotate: "7deg" } },
  { text: "Shop?", bg: "#FFE1EC", style: { left: 66, bottom: 44, rotate: "5deg" } },
  { text: "Home?", bg: "#E3EEFF", style: { right: 60, bottom: 30, rotate: "-6deg" } },
];

export default function OldWelcome() {
  const router = useRouter();
  const [lang, setLang] = useState<UiLang>("hinglish");

  useEffect(() => {
    setLang(load<UiLang>("lang", "hinglish"));
    const q = new URLSearchParams(location.search);
    if (q.has("demo")) save("demo", q.get("demo") !== "0");
    if (q.has("reset")) {
      Object.keys(localStorage).filter((k) => k.startsWith("saathi:")).forEach((k) => localStorage.removeItem(k));
    }
  }, []);

  function start() {
    save("lang", lang);
    save("answers", {});
    save("asked", []);
    router.push("/interview");
  }

  return (
    <Screen>
      <div className="relative flex h-[330px] shrink-0 items-center justify-center">
        <div className="absolute left-1/2 top-[45px] h-[200px] w-[200px] -translate-x-1/2 rounded-full" style={{ backgroundImage: "radial-gradient(circle, #7C6CFF47 0%, #7C6CFF00 70%)" }} />
        <Orb size={148} className="float relative" />
        {STICKERS.map((s) => (
          <div key={s.text} className="font-display absolute rounded-[14px] px-3 py-2 text-[15px] font-bold leading-[18px] text-[#2A2350]" style={{ background: s.bg, ...s.style }}>
            {s.text}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-2.5 px-[30px] pt-2 text-center">
        <h1 className="font-display text-[38px] font-extrabold leading-10 tracking-[-0.03em] text-ink">Hi! I'm Smiley, your Reels Magic.</h1>
        <Squiggle />
        <p className="text-[16px] leading-[23px] text-muted">Wherever you are, whatever you do, we'll turn it into posts.</p>
      </div>

      <div className="flex-1" />

      <div className="flex flex-col gap-3 px-5 pb-9">
        <div className="flex flex-wrap justify-center gap-1.5" role="radiogroup" aria-label="Language">
          {PILLS.map((p) => {
            const on = p.id === lang;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={on}
                onClick={() => setLang(p.id)}
                className={`rounded-full px-3.5 py-2 text-[14px] leading-[18px] transition ${on ? "font-display bg-ink font-bold text-white" : "bg-chip text-ink"}`}
              >
                {p.label}
              </button>
            );
          })}
        </div>
        <PrimaryButton onClick={start}>Talk to Smiley</PrimaryButton>
      </div>
    </Screen>
  );
}
