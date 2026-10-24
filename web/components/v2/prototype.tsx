"use client";
import "./v2.css";
import { useCallback, useEffect, useState, type ComponentType, type ReactNode } from "react";
import { ReelScreen, CommentsScreen, InboxScreen, ThreadScreen } from "./instagram";
import { WhatsAppScreen } from "./whatsapp";
import { DashboardScreen } from "./dashboard";
import { Avatar, SmileyFace, type ScreenProps } from "./shared";
import { IgGlyph, WaGlyph, Pause, Play } from "./icons";

type App = "ig" | "wa" | "rm";
type Step = { title: string; desc: string; app: App; ms: number; Screen: ComponentType<ScreenProps> };

const STEPS: Step[] = [
  { title: "Her Reel is live", desc: "1,248 likes and 86 comments by lunchtime. Smiley is already replying.", app: "ig", ms: 4000, Screen: ReelScreen },
  { title: "Comments, answered", desc: "Every reply in Sunita's own tone, marked as sent by Smiley.", app: "ig", ms: 5000, Screen: CommentsScreen },
  { title: "DMs pile up", desc: "Order questions land in her inbox. Smiley picks them up.", app: "ig", ms: 4000, Screen: InboxScreen },
  { title: "Smiley captures the lead", desc: "Menu and price in her tone, then name, time, address and phone. Lead saved.", app: "ig", ms: 9500, Screen: ThreadScreen },
  { title: "Sunita gets a WhatsApp", desc: "New lead alert with his number, plus one-tap approval for the palm oil question.", app: "wa", ms: 7500, Screen: WhatsAppScreen },
  { title: "Leads dashboard", desc: "6 leads from Instagram today, and which Reel brought them.", app: "rm", ms: 6000, Screen: DashboardScreen },
];

const APP_LABEL: Record<App, string> = { ig: "Instagram (simulated)", wa: "WhatsApp (simulated)", rm: "Reels Magic" };

function AppGlyph({ app, size = 18 }: { app: App; size?: number }) {
  if (app === "ig") return <IgGlyph size={size} />;
  if (app === "wa") return <WaGlyph size={size} />;
  return <SmileyFace size={size} />;
}

const FRAME_W = 417;
const FRAME_H = 876;

export function V2Prototype({ embed = false, initialStep = 0, hideStatusBar = false, startAutoplay = false }: { embed?: boolean; initialStep?: number; hideStatusBar?: boolean; startAutoplay?: boolean }) {
  const [step, setStep] = useState(initialStep);
  const [run, setRun] = useState(0); // bump to remount the current screen
  const [autoplay, setAutoplay] = useState(startAutoplay);
  const [desktop, setDesktop] = useState(false);
  const [scale, setScale] = useState(1);

  const go = useCallback((n: number) => {
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
    setRun((r) => r + 1);
  }, []);
  const advance = useCallback(() => {
    setStep((s) => (s + 1) % STEPS.length);
    setRun((r) => r + 1);
  }, []);
  // Tap targets inside the screens. In the embed, the last one hands control back to the parent.
  const next = useCallback(() => {
    if (embed && step === STEPS.length - 1) {
      if (window.parent !== window) window.parent.postMessage({ type: "reels-magic-v2-done" }, "*");
      return;
    }
    advance();
  }, [embed, step, advance]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setDesktop(mq.matches);
      setScale(Math.min(1, (window.innerHeight - 96) / FRAME_H));
    };
    update();
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  useEffect(() => {
    if (!autoplay) return;
    const id = setTimeout(() => {
      if (step === STEPS.length - 1) setAutoplay(false);
      else advance();
    }, STEPS[step].ms);
    return () => clearTimeout(id);
  }, [autoplay, step, run, advance]);

  useEffect(() => {
    if (embed && window.parent !== window) window.parent.postMessage({ type: "reels-magic-v2-step", step: step + 1 }, "*");
  }, [embed, step]);

  useEffect(() => {
    if (embed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") advance();
      if (e.key === "ArrowLeft") go(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [embed, step, advance, go]);

  const toggleAutoplay = () => {
    if (!autoplay && step === STEPS.length - 1) go(0);
    setAutoplay((a) => !a);
  };

  const { Screen } = STEPS[step];
  const screen = <Screen key={`${step}-${run}`} onNext={next} autoplay={autoplay} hideStatusBar={hideStatusBar} />;
  // Standalone on a phone advances on any tap; desktop and the embed rely on the in-screen tap targets.
  const tapAnywhere = !embed && !desktop;

  if (embed) {
    return <div className="h-dvh w-full overflow-hidden bg-white">{screen}</div>;
  }

  return (
    <div className="v2-rm min-h-dvh bg-[#EEF3FA] lg:flex">
      <Sidebar step={step} go={go} autoplay={autoplay} toggleAutoplay={toggleAutoplay} run={run} />

      <main className="flex flex-1 flex-col items-center justify-center lg:min-h-dvh lg:py-6">
        {/* Phone: full-screen below lg, device mockup at lg */}
        <div className="lg:relative" style={desktop ? { width: FRAME_W * scale, height: FRAME_H * scale } : undefined}>
          <div
            className="fixed inset-0 z-0 lg:absolute lg:left-0 lg:top-0 lg:h-[876px] lg:w-[417px] lg:rounded-[64px] lg:bg-[#0C0C0E] lg:p-[12px] lg:shadow-[0_0_0_2px_#3A3A40,0_0_0_4px_#1A1A1D,0_40px_80px_-20px_rgba(15,30,60,0.45)]"
            style={desktop ? { transform: `scale(${scale})`, transformOrigin: "top left" } : undefined}
          >
            {desktop && <SideButtons />}
            <div className="relative h-full w-full overflow-hidden bg-white lg:rounded-[52px]" onClick={tapAnywhere ? advance : undefined}>
              {screen}
              {desktop && <div className="pointer-events-none absolute left-1/2 top-[11px] z-50 h-[36px] w-[124px] -translate-x-1/2 rounded-full bg-black" />}
              {!desktop && <MobileProgress step={step} />}
            </div>
          </div>
        </div>
        <div className="mt-6 hidden items-center gap-3 lg:flex">
          <NavButton onClick={() => go(step - 1)} disabled={step === 0}>
            ← Back
          </NavButton>
          <span className="min-w-[64px] text-center text-[13px] font-semibold text-[#6B7280]">
            {step + 1} / {STEPS.length}
          </span>
          <NavButton onClick={advance}>{step === STEPS.length - 1 ? "Start over" : "Next →"}</NavButton>
        </div>
      </main>
    </div>
  );
}

function NavButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-[#111827] shadow-[0_4px_14px_rgba(16,24,40,0.08)] transition-transform active:scale-[0.97] disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SideButtons() {
  const b = "absolute w-[4px] rounded-full bg-[#2A2A2F]";
  return (
    <>
      <span className={`${b} -left-[5px] top-[150px] h-[30px]`} />
      <span className={`${b} -left-[5px] top-[205px] h-[58px]`} />
      <span className={`${b} -left-[5px] top-[275px] h-[58px]`} />
      <span className={`${b} -right-[5px] top-[230px] h-[92px]`} />
    </>
  );
}

function MobileProgress({ step }: { step: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-2 top-[3px] z-50 flex gap-1">
      {STEPS.map((_, i) => (
        <span key={i} className={`h-[3px] flex-1 rounded-full ${i <= step ? "bg-[#1E8BFF]" : "bg-black/15"}`} />
      ))}
    </div>
  );
}

function Sidebar({ step, go, autoplay, toggleAutoplay, run }: { step: number; go: (n: number) => void; autoplay: boolean; toggleAutoplay: () => void; run: number }) {
  return (
    <aside className="hidden w-[380px] shrink-0 flex-col border-r border-[#E3E9F2] bg-white px-6 py-7 lg:flex">
      <div className="flex items-center gap-3">
        <SmileyFace size={44} />
        <div>
          <div className="text-[19px] font-bold tracking-[-0.02em]">Reels Magic</div>
          <div className="text-[13px] text-[#6B7280]">V2 · after the first Reel is posted</div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3 rounded-[18px] bg-[#F4F7FB] p-3">
        <Avatar name="Sunita" src="/v2/home-cook.jpg" size={42} />
        <div className="min-w-0">
          <div className="text-[14px] font-semibold">Sunita · @sunitas_kitchen</div>
          <div className="text-[12.5px] text-[#6B7280]">Home cook in Lucknow, sells lunch tiffins</div>
        </div>
      </div>

      <ol className="mt-5 flex flex-col gap-1.5">
        {STEPS.map((s, i) => {
          const on = i === step;
          return (
            <li key={s.title}>
              <button
                type="button"
                onClick={() => go(i)}
                className={`relative w-full overflow-hidden rounded-[16px] px-3 py-2.5 text-left transition-colors ${
                  on ? "bg-[#EEF6FF] ring-1 ring-[#1E8BFF]/40" : "hover:bg-[#F6F8FB]"
                }`}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold ${
                      on ? "bg-[#1E8BFF] text-white" : i < step ? "bg-[#DCEBFF] text-[#1E8BFF]" : "bg-[#F0F2F5] text-[#6B7280]"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-semibold leading-tight">{s.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-[#6B7280]">
                      <AppGlyph app={s.app} size={13} /> {APP_LABEL[s.app]}
                    </span>
                  </span>
                </span>
                {on && <span className="mt-1.5 block pl-10 text-[12.5px] leading-snug text-[#374151]">{s.desc}</span>}
                {on && autoplay && (
                  <span key={run} className="v2-progress absolute inset-x-0 bottom-0 h-[3px] bg-[#1E8BFF]" style={{ animationDuration: `${s.ms}ms` }} />
                )}
              </button>
            </li>
          );
        })}
      </ol>

      <button
        type="button"
        onClick={toggleAutoplay}
        className="btn-blue mt-5 flex h-12 items-center justify-center gap-2 rounded-full text-[15px] font-semibold text-white active:scale-[0.98]"
      >
        {autoplay ? <Pause size={18} strokeWidth={2.6} /> : <Play size={16} />}
        {autoplay ? "Pause demo" : "Autoplay demo"}
      </button>

      <p className="mt-auto pt-6 text-[12px] leading-relaxed text-[#6B7280]">
        Tap inside the phone (comments, the banner, the chat, the buttons) to move through the story, or use ← → keys. Instagram and WhatsApp screens are simulations.
      </p>
    </aside>
  );
}
