"use client";
import { Avatar, HomeIndicator, SmileyFace, StatusBar, tap, type ScreenProps } from "./shared";
import * as I from "./icons";

type Source = "IG DM" | "IG comment";
type Status = "New" | "Contacted";
type Lead = { name: string; ask: string; where: string; source: Source; status: Status; time: string };

const LEADS: Lead[] = [
  { name: "Rajesh Kumar", ask: "2 thalis · tomorrow 1 pm", where: "Gomti Nagar office", source: "IG DM", status: "New", time: "now" },
  { name: "Neha", ask: "Asked about palm oil · wants to try", where: "Indira Nagar", source: "IG comment", status: "New", time: "6m" },
  { name: "Meera S", ask: "3 thalis daily · weekdays", where: "Hazratganj", source: "IG DM", status: "New", time: "12m" },
  { name: "Priya Sharma", ask: "1 thali · wants the menu", where: "Aliganj", source: "IG comment", status: "New", time: "40m" },
  { name: "Ankit Verma", ask: "2 thalis · trial order", where: "Mahanagar", source: "IG DM", status: "Contacted", time: "1h" },
  { name: "Kavya R", ask: "2 thalis · tomorrow 1:30 pm", where: "Indira Nagar", source: "IG DM", status: "Contacted", time: "2h" },
];

function SourceBadge({ s }: { s: Source }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#FDEBF4] px-2 py-[2px] text-[11px] font-semibold text-[#B4236E]">
      <I.IgGlyph size={12} /> {s}
    </span>
  );
}

function StatusChip({ s }: { s: Status }) {
  return s === "New" ? (
    <span className="rounded-full bg-[#E3F0FF] px-2 py-[2px] text-[11px] font-semibold text-[#1468C7]">New</span>
  ) : (
    <span className="rounded-full bg-[#EEF1F5] px-2 py-[2px] text-[11px] font-semibold text-[#4B5563]">Contacted</span>
  );
}

export function DashboardScreen({ onNext, hideStatusBar }: ScreenProps) {
  const fresh = LEADS.filter((l) => l.status === "New").length;
  return (
    <div className="v2-rm flex h-full flex-col bg-[#F4F7FB] text-[#111827]">
      <StatusBar hidden={hideStatusBar} />
      <div className="v2-scroll flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex items-center justify-between pb-3 pt-1">
          <div>
            <div className="text-[13px] font-medium text-[#6B7280]">Namaste, Sunita</div>
            <div className="text-[26px] font-bold leading-tight tracking-[-0.025em]">Leads</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1E8BFF] shadow-[0_2px_8px_rgba(16,24,40,0.06)]">Today</span>
            <SmileyFace size={38} />
          </div>
        </div>

        {/* today */}
        <div className="v2-in rounded-[22px] p-4 text-white shadow-[0_12px_28px_rgba(30,139,255,0.3)]" style={{ background: "linear-gradient(120deg,#1E8BFF 0%,#4FB3FF 100%)" }}>
          <div className="text-[13px] font-medium text-white/85">Today</div>
          <div className="mt-1 flex items-end gap-2">
            <span className="text-[34px] font-bold leading-none tracking-[-0.03em]">{LEADS.length} leads</span>
            <span className="pb-1 text-[13px] text-white/85">from Instagram</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { k: "New", v: String(fresh) },
              { k: "Contacted", v: String(LEADS.length - fresh) },
              { k: "From DMs", v: String(LEADS.filter((l) => l.source === "IG DM").length) },
            ].map((x) => (
              <div key={x.k} className="rounded-[14px] py-2" style={{ background: "rgba(255,255,255,0.18)" }}>
                <div className="text-[19px] font-bold leading-tight">{x.v}</div>
                <div className="text-[11.5px] text-white/85">{x.k}</div>
              </div>
            ))}
          </div>
        </div>

        {/* top reel */}
        <div className="v2-in mt-3 flex items-center gap-3 rounded-[22px] bg-white p-3 shadow-[0_8px_24px_rgba(16,24,40,0.06)]" style={{ animationDelay: "80ms" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/v2/reel-poster.jpg" alt="" className="h-[74px] w-[48px] rounded-[10px] object-cover" />
          <div className="min-w-0 flex-1">
            <div className="text-[11.5px] font-semibold uppercase tracking-wide text-[#1E8BFF]">Top Reel</div>
            <div className="text-[15px] font-bold leading-snug">&quot;Soft till lunch&quot; brought 5 leads</div>
            <div className="mt-0.5 text-[12.5px] text-[#6B7280]">1,248 likes · 86 comments</div>
          </div>
        </div>

        {/* smiley */}
        <div className="v2-in mt-3 rounded-[22px] bg-white p-3.5 shadow-[0_8px_24px_rgba(16,24,40,0.06)]" style={{ animationDelay: "160ms" }}>
          <div className="flex items-center gap-2">
            <SmileyFace size={24} />
            <span className="text-[14.5px] font-bold">Smiley replied for you</span>
            <span className="ml-auto text-[11.5px] text-[#6B7280]">in your tone</span>
          </div>
          <div className="mt-2.5 grid grid-cols-3 gap-2">
            {[
              { v: "38", k: "comments replied", c: "text-[#111827]", bg: "bg-[#F4F7FB]" },
              { v: "12", k: "DMs handled", c: "text-[#111827]", bg: "bg-[#F4F7FB]" },
              { v: "1", k: "sent after your OK", c: "text-[#1F9D57]", bg: "bg-[#E7F7EE]" },
            ].map((x) => (
              <div key={x.k} className={`rounded-[14px] ${x.bg} px-2 py-2`}>
                <div className={`text-[20px] font-bold leading-tight ${x.c}`}>{x.v}</div>
                <div className="text-[11.5px] leading-tight text-[#6B7280]">{x.k}</div>
              </div>
            ))}
          </div>
        </div>

        {/* leads */}
        <div className="mb-2 mt-5 flex items-baseline justify-between">
          <span className="text-[16px] font-bold">New people to call</span>
          <span className="text-[12.5px] font-semibold text-[#1E8BFF]">{fresh} new</span>
        </div>
        <div className="rounded-[22px] bg-white shadow-[0_8px_24px_rgba(16,24,40,0.06)]">
          {LEADS.map((l, i) => {
            const first = i === 0;
            const Row = first ? "button" : "div";
            return (
              <Row
                key={l.name}
                {...(first ? { type: "button" as const, onClick: tap(onNext) } : {})}
                className={`v2-in relative flex w-full items-center gap-3 px-3.5 py-3 text-left ${i ? "border-t border-[#EEF1F5]" : "rounded-t-[22px]"} ${first ? "bg-[#F2F8FF]" : ""}`}
                style={{ animationDelay: `${220 + i * 60}ms` }}
              >
                <Avatar name={l.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[14.5px] font-semibold">{l.name}</span>
                    <span className="text-[11.5px] text-[#9CA3AF]">{l.time}</span>
                  </span>
                  <span className="block truncate text-[12.5px] text-[#6B7280]">
                    {l.ask} · {l.where}
                  </span>
                  <span className="mt-1 flex items-center gap-1.5">
                    <SourceBadge s={l.source} />
                    <StatusChip s={l.status} />
                  </span>
                </span>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${first ? "bg-[#1E8BFF] text-white" : "bg-[#F0F4F9] text-[#1E8BFF]"}`}>
                  <I.Phone size={17} />
                </span>
              </Row>
            );
          })}
        </div>
      </div>

      <div className="flex h-[58px] shrink-0 items-center justify-around border-t border-[#E9EDF3] bg-white text-[10.5px] font-semibold text-[#9CA3AF]">
        {[
          { k: "Home", icon: <I.Home size={22} /> },
          { k: "Create", icon: <I.Plus size={22} /> },
          { k: "Leads", icon: <I.Bag size={22} />, on: true },
          { k: "Me", icon: <I.Profile size={22} /> },
        ].map((t) => (
          <span key={t.k} className={`flex flex-col items-center gap-0.5 ${t.on ? "text-[#1E8BFF]" : ""}`}>
            {t.icon}
            {t.k}
          </span>
        ))}
      </div>
      <div className="bg-white">
        <HomeIndicator />
      </div>
    </div>
  );
}
