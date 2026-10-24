"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, PrimaryButton } from "@/components/ui";
import { BottomNav } from "@/components/nav";
import { load, fitOf } from "@/lib/store";
import { saathiTip, type UiLang } from "@/lib/lang";

const COVERS: Record<string, string> = {
  carousel: "radial-gradient(circle farthest-corner at 60% 35%, #FFE6A8 0%, #F0A04B 45%, #C4612A 80%)",
  reel: "radial-gradient(circle farthest-corner at 40% 35%, #FFF4D6 0%, #E9C46A 50%, #9C7A1E 90%)",
  single_image: "radial-gradient(circle farthest-corner at 50% 40%, #FFE7EF 0%, #F28AB0 55%, #B0466E 95%)",
};
const FORMAT: Record<string, string> = { carousel: "Carousel", reel: "Reel", single_image: "Photo post" };
const DAYS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

function meta(p: any, camera: number | null) {
  if (!p.needs_filming) return `No shoot · ${p.effort_minutes ?? 10} min`;
  const clips = p.shot_list?.length ?? 3;
  return `${FORMAT[p.format]} · ${clips} clips${camera != null && camera < 4 ? " · hands only" : ""}`;
}

export default function Plan() {
  const router = useRouter();
  const [plan, setPlan] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [published, setPublished] = useState<string[]>([]);
  const [tab, setTab] = useState(0);
  const [lang, setLang] = useState<UiLang>("hinglish");

  useEffect(() => {
    setPlan(load("plan", null));
    setProfile(load("profile", null));
    setPublished(load<string[]>("published", []));
    setLang(load<UiLang>("lang", "hinglish"));
  }, []);

  if (!plan) {
    return (
      <Screen className="items-center justify-center gap-4 px-8 text-center">
        <Orb size={96} />
        <p className="text-muted">Your plan isn't ready yet.</p>
        <PrimaryButton href="/">Talk to Smiley</PrimaryButton>
      </Screen>
    );
  }

  function go(id: string) {
    const paid = load<boolean>("paid", false);
    if (published.length >= 1 && !paid && !published.includes(id)) return router.push(`/pay?next=${id}`);
    router.push(`/make/${id}`);
  }

  const name = profile?.name ? `${profile.name}${profile.profession === "home cook" ? " ji" : ""}` : "";
  const posts: any[] = plan.posts ?? [];
  const order = tab === 1 ? [...posts.slice(1), posts[0]] : posts;
  const tip = saathiTip(posts[0], lang);

  return (
    <Screen style={{ background: "#F6F5FB" }}>
      <div className="flex items-center justify-between px-5 pb-3.5 pt-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="text-[14px] leading-[18px] text-muted">Hi{name ? `, ${name}` : ""}</span>
          <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em]">This week</h1>
        </div>
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_18px_#17142B0F]">
          <span className="font-display text-[18px] font-extrabold text-primary">{published.length}/{posts.length}</span>
        </div>
      </div>

      <div className="flex gap-1.5 px-5 pb-3.5">
        {["Today", "Tomorrow", "Full week"].map((t, i) => (
          <button
            key={t}
            onClick={() => setTab(i)}
            className={`font-display rounded-full px-4 py-[9px] text-[15px] leading-[18px] ${tab === i ? "bg-white font-bold text-ink shadow-[0_2px_8px_#17142B0F]" : "font-semibold text-muted"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 2 ? (
        <div className="flex flex-col gap-2 px-5">
          {posts.map((p, i) => (
            <button key={p.id} onClick={() => go(p.id)} className="flex items-center gap-3 rounded-[20px] bg-white p-3 text-left shadow-[0_6px_18px_#17142B0A]">
              <span className="h-14 w-14 shrink-0 rounded-2xl" style={{ backgroundImage: COVERS[p.format] }} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[12px] text-muted">{DAYS[p.scheduled_day] ?? p.scheduled_day} · {FORMAT[p.format]}</span>
                <span className="font-display truncate text-[16px] font-bold">{p.title}</span>
              </span>
              {published.includes(p.id) ? (
                <span className="rounded-full bg-mint px-2 py-1 text-[12px] font-bold text-ok">Posted</span>
              ) : (
                <span className="rounded-full bg-primary px-2 py-1 text-[12px] font-bold text-white">{fitOf(p, i)}%</span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto pl-5 pr-5 pb-2">
          {order.map((p) => {
            const i = posts.indexOf(p);
            const done = published.includes(p.id);
            return (
              <article key={p.id} className="flex w-[250px] shrink-0 snap-start flex-col overflow-clip rounded-[28px] bg-white shadow-[0_10px_30px_#17142B12]">
                <button onClick={() => go(p.id)} className="relative h-[200px] shrink-0 text-left" style={{ backgroundImage: COVERS[p.format] }} aria-label={p.title_en}>
                  <span className="absolute left-3 top-3 rounded-full bg-primary px-2.5 py-[5px] text-[12px] font-bold leading-4 text-white">{fitOf(p, i)}% fit</span>
                  <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-[5px] text-[12px] font-semibold leading-4 text-ink">{FORMAT[p.format]}</span>
                  <span className="absolute bottom-3 left-3 rounded-full bg-black/25 px-2.5 py-1 text-[12px] font-semibold text-white">{DAYS[p.scheduled_day] ?? p.scheduled_day}</span>
                </button>
                <div className="flex flex-1 flex-col gap-1.5 px-4 pb-4 pt-3.5">
                  <span className="text-[12px] leading-4 text-muted">{meta(p, profile?.camera_level ?? null)}</span>
                  <h2 className="font-display line-clamp-3 text-[18px] font-extrabold leading-[26px] tracking-[-0.01em]">{p.title}</h2>
                  <span className="text-[13px] leading-[18px] text-muted">{p.title_en}</span>
                  <div className="flex-1" />
                  <button
                    onClick={() => go(p.id)}
                    className="font-display mt-1.5 flex h-[46px] items-center justify-center rounded-full text-[16px] font-bold leading-5 text-ink active:scale-[0.98]"
                    style={{ background: done ? "#E5F6EC" : "#FFD84D" }}
                  >
                    {done ? "Posted ✓" : "Make it now"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {tip && (
        <div className="mx-5 mt-4 flex items-start gap-2.5">
          <Orb size={40} glow={false} />
          <div className="flex flex-1 flex-col gap-[3px] rounded-[6px_20px_20px_20px] bg-white px-3.5 py-3">
            <span className="text-[12px] font-semibold leading-4 text-primary">Smiley's tip</span>
            <span className="text-[14px] leading-5">{tip}</span>
          </div>
        </div>
      )}

      {plan.stories?.length > 0 && (
        <div className="mt-4 px-5 pb-32">
          <h3 className="font-display mb-2 text-[16px] font-bold">Daily story · 2 minutes</h3>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {plan.stories.map((s: any) => (
              <div key={s.day} className="w-[150px] shrink-0 rounded-[20px] bg-white p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-faint">{DAYS[s.day] ?? s.day} · {s.type.replace(/_/g, " ")}</span>
                <p className="mt-1 line-clamp-3 text-[13px] leading-[18px]">{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <BottomNav />
    </Screen>
  );
}
