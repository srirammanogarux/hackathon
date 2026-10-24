"use client";
import { useEffect, useState } from "react";
import { Screen, Orb, PrimaryButton, Spinner } from "@/components/ui";
import { load, save, api, fitOf } from "@/lib/store";

const CHIP_BG = ["#EDE9FF", "#FFF6E0", "#E5F6EC", "#E3EEFF", "#FFE7EF"];
const CAMERA = ["No camera", "Hands only", "Voice + hands", "AI avatar", "Face is fine"];
const KILLED: Record<string, string> = {
  camera: "You said no camera",
  time: "Not enough time",
  place: "Can't shoot outside",
  tech: "Phone / gear not enough",
  language: "Language doesn't match",
  boundary: "Against your rules",
  professional_rule: "Not allowed by professional rules",
  budget: "Needs a budget",
  goal_fit: "Doesn't fit your goal",
};

function boundaryChip(b: string): string {
  if (/face/i.test(b)) return "No face";
  if (/family/i.test(b)) return "No family in frame";
  if (/address/i.test(b)) return "No home address";
  if (/avatar/i.test(b)) return "No AI avatar";
  return b.replace(/^never /, "No ").replace(/^no /i, "No ");
}

function chipsOf(p: any): string[] {
  if (!p) return [];
  const c: string[] = [];
  if (p.camera_level != null) c.push(CAMERA[p.camera_level] ?? "Camera");
  if (p.places?.[0]) c.push(`Only ${p.places[0].replace(/^home /, "")}`);
  const slot = p.shoot_slots?.[0];
  if (slot) {
    const h = slot.start ? Number(slot.start.slice(0, 2)) : null;
    const when = h == null ? "" : ` ${h > 12 ? h - 12 : h} ${h >= 12 ? "pm" : "am"}`;
    const day = ["daily", "weekdays", "weekends"].includes(slot.day) ? slot.day[0].toUpperCase() + slot.day.slice(1) : p.shoot_slots.length > 3 ? "Daily" : slot.day;
    c.push(`${day}${when}`);
  }
  if (p.tech?.phone) c.push(p.tech.phone.replace(/android/i, "Android"));
  if (p.budget != null) c.push(`₹${p.budget} budget`);
  for (const b of [...(p.boundaries?.personal ?? []), ...(p.boundaries?.cultural ?? [])].slice(0, 2)) c.push(boundaryChip(b));
  if ((p.boundaries?.professional ?? []).length) c.push("Dental council rules");
  if (p.audience?.type) c.push(p.audience.type === "local" ? `${p.audience.radius_km ?? 5} km local` : `${p.language_in === "hi" ? "Hindi" : "Broad"} audience`);
  return c;
}

export default function Profile() {
  const [profile, setProfile] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [error, setError] = useState(false);
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const p = load<any>("profile", null);
    setProfile(p);
    const cached = load<any>("plan", null);
    if (cached) return setPlan(cached);
    if (!p) return;
    api("/api/plan", { profile: p })
      .then(({ plan }) => {
        save("plan", plan);
        setPlan(plan);
      })
      .catch(() => setError(true));
  }, []);

  useEffect(() => {
    if (!plan) return;
    const t = setInterval(() => setShown((s) => (s >= 8 ? s : s + 1)), 140);
    return () => clearInterval(t);
  }, [plan]);

  if (!profile) {
    return (
      <Screen className="items-center justify-center gap-4 px-8 text-center">
        <Orb size={96} />
        <p className="text-muted">Talk to Smiley first.</p>
        <PrimaryButton href="/">Get started</PrimaryButton>
      </Screen>
    );
  }

  const posts = plan?.posts ?? [];
  const cut = plan?.filtered_out ?? [];
  const total = plan?.ideas_considered ?? posts.length + cut.length;

  return (
    <Screen className="bg-mist" style={{ background: "#F6F5FB" }}>
      <div className="flex items-center gap-3 px-5 pb-4 pt-1.5">
        <Orb size={56} />
        <div className="flex flex-col">
          <span className="text-[14px] leading-[18px] text-muted">This is you!</span>
          <h1 className="font-display text-[28px] font-extrabold leading-8 tracking-[-0.03em]">{profile.name ? `${profile.name}${profile.profession === "home cook" ? " ji" : ""}` : "You"}</h1>
        </div>
      </div>

      <section className="mx-4 flex flex-col gap-3 rounded-[28px] bg-white p-[18px] shadow-[0_10px_30px_#17142B0F]">
        <h2 className="font-display text-[18px] font-bold leading-[22px]">Your life, your rules</h2>
        <div className="flex flex-wrap gap-2">
          {chipsOf(profile).map((c, i) => (
            <span key={c + i} className="pop font-display rounded-[14px] px-3 py-2 text-[15px] font-semibold leading-[18px]" style={{ background: CHIP_BG[i % 5], animationDelay: `${i * 60}ms` }}>
              {c}
            </span>
          ))}
        </div>
      </section>

      <section className="mx-4 mt-2.5 flex flex-col gap-2.5 rounded-[28px] bg-white p-[18px] shadow-[0_10px_30px_#17142B0F]">
        {!plan ? (
          <div className="flex items-center gap-3 py-3">
            <Spinner color="#6A58F5" />
            <span className="text-[15px] text-muted">{error ? "The plan is taking a while. Please refresh." : `Smiley is weighing ${total || 17} ideas…`}</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[30px] font-extrabold leading-9 text-[#CFCBE6] line-through">{total}</span>
              <svg width="18" height="12" viewBox="0 0 18 12" aria-hidden><path d="M1 6h15M11 1l5 5-5 5" fill="none" stroke="#17142B" strokeWidth="2" strokeLinecap="round" /></svg>
              <span className="font-display text-[30px] font-extrabold leading-9 text-primary">{posts.length}</span>
              <span className="text-[15px] leading-[18px] text-muted">ideas fit your life</span>
            </div>
            {posts.slice(0, 2).map((p: any, i: number) =>
              shown > i ? (
                <div key={p.id} className="pop flex items-center justify-between gap-3 border-t border-[#F0EEF8] py-2">
                  <span className="font-display text-[16px] font-bold leading-5">{p.title_en}</span>
                  <span className="shrink-0 rounded-full bg-primary px-[9px] py-1 text-[12px] font-bold leading-4 text-white">{fitOf(p, i)}% fit</span>
                </div>
              ) : null,
            )}
            {cut.slice(0, 3).map((c: any, i: number) =>
              shown > i + 2 ? (
                <div key={c.idea} className="pop flex items-center justify-between gap-3 border-t border-[#F0EEF8] py-2">
                  <div className="flex flex-col">
                    <span className="font-display text-[16px] font-semibold leading-5 text-[#ACA8C2] line-through">{c.idea}</span>
                    <span className="text-[12px] leading-4 text-[#8E8AA6]">{KILLED[c.killed_by] ?? c.reason}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-chip px-[9px] py-1 text-[12px] font-bold leading-4 text-[#ACA8C2]">{12 + i * 5}% fit</span>
                </div>
              ) : null,
            )}
          </>
        )}
      </section>

      <div className="flex-1" />
      <div className="px-5 pb-[34px] pt-6">
        <PrimaryButton href="/plan" aria-disabled={!plan} className={!plan ? "pointer-events-none opacity-60" : ""}>
          See this week's plan
        </PrimaryButton>
      </div>
    </Screen>
  );
}
