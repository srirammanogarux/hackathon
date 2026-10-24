"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { HomeIndicator, StatusBar, tap, useReveal, type ScreenProps } from "./shared";
import * as I from "./icons";
import { DoubleTick } from "./icons";

const WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23000' stroke-opacity='.045' stroke-width='1.6' stroke-linecap='round'%3E%3Ccircle cx='18' cy='20' r='7'/%3E%3Cpath d='M70 12l8 8-8 8M40 70c6-8 14-8 20 0M92 64h16M100 56v16M20 92l10 10M30 92l-10 10M78 98a8 8 0 1 0 16 0'/%3E%3Crect x='52' y='36' width='12' height='9' rx='2'/%3E%3C/g%3E%3C/svg%3E\")";

function Bubble({ out = false, time, children, buttons, className = "" }: { out?: boolean; time: string; children: ReactNode; buttons?: ReactNode; className?: string }) {
  return (
    <div className={`v2-in flex ${out ? "justify-end" : "justify-start"} ${className}`}>
      <div className="max-w-[84%]">
        <div
          className={`relative rounded-[18px] px-3 pb-[6px] pt-[7px] text-[15.5px] leading-[1.32] text-[#111B21] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] ${
            out ? "rounded-br-[6px] bg-[#D9FDD3]" : "rounded-bl-[6px] bg-white"
          } ${buttons ? "rounded-b-[8px]" : ""}`}
        >
          {children}
          <span className="float-right ml-2 mt-[6px] flex items-center gap-1 text-[11px] leading-none text-[#667781]">
            {time}
            {out && <DoubleTick className="text-[#53BDEB]" />}
          </span>
          <span className="clear-both block" />
        </div>
        {buttons}
      </div>
    </div>
  );
}

function QuickButtons({ items }: { items: { label: string; onClick?: () => void; disabled?: boolean }[] }) {
  return (
    <div className="mt-[3px] flex gap-[3px]">
      {items.map((b) => (
        <button
          key={b.label}
          type="button"
          disabled={b.disabled}
          onClick={b.onClick ? tap(b.onClick) : undefined}
          className={`relative flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-white text-[15px] font-medium text-[#027EB5] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)] disabled:text-[#8696A0] `}
        >
          {b.label}
        </button>
      ))}
    </div>
  );
}

const DRAFT = "Nahi ji, sirf desi ghee aur sunflower oil 🙏";

export function WhatsAppScreen({ onNext, autoplay, hideStatusBar }: ScreenProps) {
  const shown = useReveal([250, 1300]);
  const [approved, setApproved] = useState(false);
  const [editing, setEditing] = useState(false);
  const after = useAfterApprove(approved);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoplay) return;
    const id = setTimeout(() => setApproved(true), 3200);
    return () => clearTimeout(id);
  }, [autoplay]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [shown, after, approved]);

  const approve = () => {
    setEditing(false);
    setApproved(true);
  };

  return (
    <div className="v2-ios flex h-full flex-col bg-[#EFEAE2] text-[#111B21]">
      <div className="shrink-0 bg-[#F6F6F6]/95 backdrop-blur">
        <StatusBar hidden={hideStatusBar} />
        <div className="flex h-[52px] items-center gap-2.5 border-b border-black/[0.08] px-2">
          <span className="flex items-center text-[#007AFF]">
            <I.Back size={27} strokeWidth={2.2} />
            <span className="-ml-1 text-[16px]">12</span>
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/v2/smile.png" alt="" className="h-9 w-9 rounded-full bg-[#E3F0FF] p-[3px]" />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="flex items-center gap-1 text-[16px] font-semibold">
              Reels Magic
              <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 1.5l2.6 2 3.2-.3 1 3.1 2.8 1.6-.9 3.1.9 3.1-2.8 1.6-1 3.1-3.2-.3-2.6 2-2.6-2-3.2.3-1-3.1-2.8-1.6.9-3.1-.9-3.1 2.8-1.6 1-3.1 3.2.3 2.6-2Z" fill="#25D366" />
                <path d="m8 12.3 2.7 2.7L16.3 9.4" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <span className="block text-[12px] text-[#667781]">Business account · your AI team</span>
          </span>
          <I.Video size={26} className="text-[#007AFF]" />
          <I.Phone size={22} className="ml-3 mr-1 text-[#007AFF]" />
        </div>
      </div>

      <div ref={scroller} className="v2-scroll flex-1 overflow-y-auto px-3 pb-3 pt-3" style={{ backgroundImage: WALLPAPER }}>
        <div className="flex justify-center">
          <span className="rounded-[8px] bg-white/90 px-2.5 py-1 text-[12px] font-medium text-[#54656F] shadow-[0_1px_0.5px_rgba(11,20,26,0.13)]">Today</span>
        </div>
        <div className="mx-6 mt-2 rounded-[8px] bg-[#FFEECD] px-3 py-1.5 text-center text-[11.5px] leading-snug text-[#54656F]">
          Reels Magic sends you new leads and anything that needs your OK. Everything else, Smiley handles.
        </div>

        <div className="mt-3 flex flex-col gap-2">
          {shown >= 1 && (
            <Bubble time="11:49 AM" buttons={<QuickButtons items={[{ label: "Call him" }, { label: "WhatsApp him" }]} />}>
              <div className="font-semibold">New lead from Instagram 🎉</div>
              <div className="mt-1">
                <b>Rajesh Kumar</b> · 2 thalis · tomorrow 1 pm
              </div>
              <div>Gomti Nagar office · 98xxx 43210</div>
              <div className="text-[13.5px] text-[#54656F]">4B, Cyber Heights, Vibhuti Khand · came from your Reel</div>
            </Bubble>
          )}

          {shown >= 2 && (
            <Bubble
              time="11:52 AM"
              buttons={
                <QuickButtons
                  items={[
                    { label: approved ? "Sent ✓" : "Send", onClick: approve, disabled: approved },
                    { label: "Edit", onClick: () => setEditing(true), disabled: approved },
                  ]}
                />
              }
            >
              <div className="font-semibold">🙋 Needs your OK</div>
              <div className="mt-1">
                Someone asked <i>&quot;Is this made with palm oil?&quot;</i> on your Reel.
              </div>
              <div className="mt-2 text-[13px] font-medium text-[#54656F]">Smiley&apos;s draft:</div>
              <div className="mt-1 rounded-[8px] border-l-[4px] border-[#25D366] bg-[#F5F6F6] px-2.5 py-1.5 text-[14.5px]">{DRAFT}</div>
            </Bubble>
          )}

          {approved && (
            <Bubble out time="11:53 AM">
              Send
            </Bubble>
          )}

          {after >= 1 && (
            <Bubble time="11:53 AM">
              <div className="font-semibold text-[#1F9D57]">Sent on Instagram ✓</div>
              <div className="mt-0.5 text-[14.5px]">Replied to @neha_foodie on your Reel.</div>
              <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-[#F0F2F5] px-2 py-[3px] text-[11.5px] text-[#54656F]">
                <I.Check size={12} strokeWidth={2.6} /> Approved via AgenticOrg human-in-the-loop
              </div>
            </Bubble>
          )}

          {after >= 2 && (
            <Bubble time="11:53 AM" buttons={<QuickButtons items={[{ label: "Open Reels Magic", onClick: onNext }]} />}>
              <div>
                Today so far: <b>6 new leads</b> from Instagram
              </div>
              <div className="text-[13.5px] text-[#54656F]">5 of them came from &quot;Soft till lunch&quot;</div>
            </Bubble>
          )}
        </div>
      </div>

      <div className="shrink-0 bg-[#F6F6F6] px-2 pt-1.5">
        <div className="flex items-center gap-2.5 text-[#007AFF]">
          <I.Plus size={27} />
          <div className="flex min-h-[36px] flex-1 items-center rounded-full border border-black/10 bg-white px-3 text-[15px] text-[#111B21]">
            {editing && !approved ? <span className="py-1.5">{DRAFT}</span> : <span className="text-transparent">.</span>}
          </div>
          {editing && !approved ? (
            <button type="button" onClick={tap(approve)} className="flex h-9 w-9 items-center justify-center rounded-full bg-[#25D366] text-white" aria-label="Send edited reply">
              <I.Send size={18} />
            </button>
          ) : (
            <>
              <I.Camera size={25} />
              <I.Mic size={24} />
            </>
          )}
        </div>
        <HomeIndicator />
      </div>
    </div>
  );
}

function useAfterApprove(approved: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!approved) return;
    const a = setTimeout(() => setN(1), 800);
    const b = setTimeout(() => setN(2), 1900);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, [approved]);
  return n;
}
