"use client";
// After posting (Paper core funnel board 3R8-0): "It's live + week drafted" (62G-0) and the
// first-week checklist (6A9-0). No paywall: the week is simply ready.
import type { CSSProperties } from "react";
import type { RMCtx } from "./types";

const font = { fontFamily: '"DM Sans", var(--font-dmsans), system-ui, sans-serif' };
const I = ({ n, s, style }: { n: string; s: number; style?: CSSProperties }) => (
  <img src={`/3d/${n}.png`} alt="" width={s} height={s} style={style} draggable={false} />
);
const Tick = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const Lock = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden>
    <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="#0B0F19" strokeWidth="2.6" strokeLinecap="round" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="#0B0F19" strokeWidth="2.6" strokeLinecap="round" />
  </svg>
);
const CONFETTI: [string, number, number, number, number, number][] = [
  ["#FFD43B", 40, 80, 25, 10, 18],
  ["#FF6B9A", 90, 130, -30, 8, 14],
  ["#22C55E", 300, 96, -20, 10, 18],
  ["#FFD43B", 330, 200, 40, 8, 14],
  ["#FFFFFF", 60, 250, -15, 10, 16],
  ["#FF8A3D", 350, 290, 18, 10, 16],
];

const THUMBS = [
  { bg: "url(/demo/refs/hands-rolling.jpg) center/cover" },
  { bg: "radial-gradient(circle farthest-corner at 60% 35%, #FFE6A8 0%, #F0A04B 45%, #C4612A 80%)" },
  { bg: "url(/demo/refs/tiffin-boxes.jpg) center/cover" },
  { bg: "radial-gradient(circle farthest-corner at 40% 40%, #FFF1C9 0%, #F7B84B 40%, #D9582B 85%)" },
];
const SHORT_DAY = (d: string) => d.slice(0, 3);

export function LiveScreen({ ctx }: { ctx: RMCtx }) {
  const { s } = ctx;
  const handle = s.name ? `@${s.name.toLowerCase().split(" ")[0]}s_kitchen` : "@sunitas_kitchen";
  const week = s.job?.week?.length
    ? s.job.week.slice(0, 4).map((d) => `${SHORT_DAY(d.day)} · ${d.title}`)
    : ["Tue · Paratha Reel", "Wed · Dal tadka carousel", "Fri · Tiffin menu", "Sat · Diwali gujiya"];
  return (
    <main
      className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col overflow-hidden"
      style={{ ...font, backgroundImage: "linear-gradient(180deg, #3FA4FF 0%, #7CC4FF 40%, #DCEFFF 60%)", paddingTop: "max(env(safe-area-inset-top), var(--top-inset, 14px))" }}
    >
      <I n="cloud" s={200} style={{ position: "absolute", left: -70, top: 150, opacity: 0.95 }} />
      <I n="cloud" s={190} style={{ position: "absolute", left: 270, top: 40, opacity: 0.9 }} />
      <div className="pointer-events-none absolute left-0 top-0 h-[380px] w-[390px]">
        {CONFETTI.map(([c, l, t, r, w, h], i) => (
          <span key={i} className="absolute rounded-[3px]" style={{ background: c, left: l, top: t, width: w, height: h, rotate: `${r}deg` }} />
        ))}
      </div>
      <div className="relative flex h-[300px] shrink-0 flex-col items-center gap-1.5 px-6 pt-1">
        <div className="relative h-[196px] w-[200px] shrink-0">
          <div
            className="absolute overflow-hidden rounded-[18px] border-[3px] border-white"
            style={{ left: 52, top: 4, width: 104, height: 184, rotate: "6deg", boxShadow: "0 18px 36px #103C784D", background: "url(/demo/photos/paratha-plate.jpg) center/cover" }}
          >
            {s.job?.reels?.en && <video src={s.job.reels.en} autoPlay muted loop playsInline className="h-full w-full object-cover" />}
            <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#22C55E]">
              <Tick />
            </span>
          </div>
          <I n="party" s={88} style={{ position: "absolute", left: -6, top: 96, rotate: "-8deg" }} />
        </div>
        <h1 className="text-[40px] font-extrabold leading-[44px] tracking-[-0.03em] text-white" style={{ textShadow: "0 4px 16px #103C7840" }}>
          {s.posted?.live ? "It's live!" : "Ready to post!"}
        </h1>
        <span className="flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1.5 text-[14px] font-semibold text-[#0B2A55]">
          <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="#0B2A55" strokeWidth="2.4" />
            <circle cx="12" cy="12" r="4" fill="none" stroke="#0B2A55" strokeWidth="2.4" />
          </svg>
          {s.posted?.live ? `${handle} · just now` : "Reel saved · caption copied"}
        </span>
      </div>
      <section className="relative flex flex-1 flex-col gap-3.5 rounded-t-[32px] bg-white px-5 pb-[34px] pt-[22px] shadow-[0_-10px_30px_#103C781A]">
        <div className="flex items-end justify-between">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-[24px] font-bold leading-[30px] tracking-[-0.02em] text-[#0B0F19]">Your week is ready</h2>
            <p className="text-[14px] leading-[19px] text-[#6B7280]">4 posts drafted from what you told me</p>
          </div>
          <I n="calendar" s={40} />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {week.map((t, i) => (
            <div key={i} className="flex flex-col overflow-clip rounded-[18px] border border-[#EEF0F3] bg-[#F7F8FA]">
              <div className="relative h-[74px] shrink-0 overflow-clip">
                <div className="absolute -left-2.5 -top-2.5 h-[94px] w-[190px]" style={{ background: THUMBS[i].bg, filter: "blur(7px)" }} />
                <span className="absolute right-2 top-2 flex h-[26px] w-[26px] items-center justify-center rounded-full bg-white/90">
                  <Lock />
                </span>
              </div>
              <p className="px-2.5 pb-2.5 pt-2 text-[13px] font-semibold leading-[17px] text-[#0B0F19]">{t}</p>
            </div>
          ))}
        </div>
        <div className="flex-1" />
        <button
          onClick={() => ctx.go("v2")}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full text-[17px] font-bold text-white active:scale-[0.98]"
          style={{ backgroundImage: "linear-gradient(180deg, #4FB3FF 0%, #1E8BFF 100%)", boxShadow: "0 12px 28px #1E8BFF59" }}
        >
          See who&apos;s watching
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>
    </main>
  );
}

export function WeekScreen({ ctx }: { ctx: RMCtx }) {
  const { s } = ctx;
  const next = s.job?.week?.[0] ?? { day: "Tuesday", time: "4 pm", title: "Paratha Reel", format: "Reel" };
  const rows = [
    { icon: "camera", text: "Add 3 kitchen photos" },
    { icon: "phone", text: "Connect Instagram" },
    { icon: "speaking", text: "Share to WhatsApp Status" },
  ];
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-[430px] flex-col bg-[#F7F8FA]" style={{ ...font, paddingTop: "max(env(safe-area-inset-top), var(--top-inset, 14px))" }}>
      <div className="pointer-events-none absolute left-0 top-0 h-[200px] w-[390px]">
        {[
          ["#FFD43B", 300, 70, 25, 8, 14],
          ["#FF6B9A", 200, 52, -30, 7, 12],
          ["#4FB3FF", 270, 112, 40, 8, 14],
        ].map(([c, l, t, r, w, h], i) => (
          <span key={i} className="absolute rounded-[3px]" style={{ background: c as string, left: l as number, top: t as number, width: w as number, height: h as number, rotate: `${r}deg` }} />
        ))}
      </div>
      <div className="relative flex flex-col gap-1.5 px-5 pt-3.5">
        <span className="flex items-center gap-1.5 self-start rounded-full bg-[#E8F8EE] py-[5px] pl-1.5 pr-2.5">
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[#22C55E]">
            <Tick size={10} />
          </span>
          <span className="text-[13px] font-bold leading-4 text-[#15803D]">First Reel posted · week drafted</span>
        </span>
        <div className="flex items-center justify-between pt-1.5">
          <h1 className="text-[32px] font-bold leading-[38px] tracking-[-0.02em] text-[#0B0F19]">Your first week</h1>
          <span className="rounded-full bg-[#111] px-3 py-1.5 text-[14px] font-bold leading-[18px] text-white">1/5</span>
        </div>
        <div className="h-1.5 rounded-[3px] bg-[#E5E7EB]">
          <div className="h-1.5 w-1/5 rounded-[3px]" style={{ backgroundImage: "linear-gradient(90deg, #1E8BFF 0%, #4FB3FF 100%)" }} />
        </div>
      </div>
      <div className="relative flex flex-1 flex-col gap-2.5 px-5 pt-5">
        <div className="flex flex-col gap-3 rounded-[20px] bg-white p-3.5 shadow-[0_6px_18px_#1018280F]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#E8F8EE]">
              <I n="check" s={30} />
            </span>
            <span className="flex flex-1 flex-col gap-px">
              <span className="text-[16px] font-semibold leading-[21px] text-[#9CA3AF] line-through">Post your first Reel</span>
              <span className="text-[13px] font-semibold leading-[17px] text-[#15803D]">Done · {s.posted?.live ? "212 views so far" : "ready to share"}</span>
            </span>
            <span className="flex h-[26px] w-[26px] items-center justify-center rounded-full bg-[#22C55E]">
              <Tick size={14} />
            </span>
          </div>
          {s.claimed ? (
            <span className="flex h-9 items-center justify-center rounded-full bg-[#E8F8EE] text-[14px] font-bold text-[#15803D]">+1 free post added</span>
          ) : (
            <button
              onClick={() => {
                ctx.set({ claimed: true });
                ctx.flash("+1 free post added to your week");
              }}
              className="flex h-9 items-center justify-center gap-1.5 rounded-full text-[14px] font-bold text-white"
              style={{ backgroundImage: "linear-gradient(180deg, #4FB3FF 0%, #1E8BFF 100%)" }}
            >
              <I n="sparkles" s={18} /> Claim +1 free post
            </button>
          )}
        </div>
        <div className="flex items-center gap-3 rounded-[20px] border-[1.5px] border-[#1E8BFF] bg-[#EAF4FF] p-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white">
            <I n="flatbread" s={30} />
          </span>
          <span className="flex flex-1 flex-col gap-px">
            <span className="text-[12px] font-bold leading-4 tracking-[0.06em] text-[#1E6FD9]">UP NEXT</span>
            <span className="text-[16px] font-semibold leading-[21px] text-[#0B0F19]">
              {next.day} {next.time} · {next.title}
            </span>
          </span>
          <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-[#1E8BFF]" />
        </div>
        {rows.map((r) => (
          <div key={r.text} className="flex items-center gap-3 rounded-[20px] bg-white px-3.5 py-3 shadow-[0_6px_18px_#1018280F]">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F3F4F6]">
              <I n={r.icon} s={26} />
            </span>
            <span className="flex-1 text-[16px] font-semibold leading-[21px] text-[#0B0F19]">{r.text}</span>
            <span className="h-[26px] w-[26px] shrink-0 rounded-full border-2 border-[#D1D5DB]" />
          </div>
        ))}
        <div className="flex items-start gap-2.5 pt-1.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_18px_#1E8BFF47]">
            <I n="smile" s={30} />
          </span>
          <p className="flex-1 rounded-[6px_18px_18px_18px] bg-white px-3.5 py-2.5 text-[14px] leading-5 text-[#374151] shadow-[0_6px_18px_#1018280F]">
            Office lunch orders peak at 4 pm in Gomti Nagar — so I scheduled {next.day} then.
          </p>
        </div>
      </div>
      <div className="relative flex flex-col items-center px-6 pb-9 pt-5">
        <button
          onClick={() => ctx.flash(`Smiley will remind you ${next.day} at ${next.time}. Your draft is ready.`)}
          className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-[#111] text-[17px] font-semibold text-white active:scale-[0.98]"
        >
          Make {next.day}&apos;s post
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </main>
  );
}
