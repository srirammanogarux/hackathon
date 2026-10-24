"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, HomeIndicator, SmileyBadge, SmileyFace, StatusBar, TypingDots, tap, useReveal, type ScreenProps } from "./shared";
import * as I from "./icons";
import { WaGlyph } from "./icons";

const SUNITA_PHOTO = "/v2/home-cook.jpg";
const HANDLE = "sunitas_kitchen";

/* ------------------------------------------------------------------ */
/* Shared IG chrome                                                    */
/* ------------------------------------------------------------------ */

function TabBar({ dark = false, active }: { dark?: boolean; active: "reels" | "dm" }) {
  const c = dark ? "text-white" : "text-black";
  return (
    <div className={`flex h-[50px] shrink-0 items-center justify-around px-2 ${dark ? "bg-black" : "border-t border-black/[0.06] bg-white"} ${c}`}>
      <I.Home size={26} strokeWidth={active === "reels" ? 1.9 : 1.9} />
      <I.ReelsTab size={26} strokeWidth={active === "reels" ? 2.4 : 1.9} />
      <span className="relative">
        <I.Send size={25} strokeWidth={active === "dm" ? 2.4 : 1.9} />
        {active !== "dm" && (
          <span className="absolute -right-[9px] -top-[6px] flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[#FF3040] px-1 text-[10px] font-bold text-white">
            9
          </span>
        )}
      </span>
      <I.Search size={26} />
      <span className={`rounded-full ${active === "dm" ? "" : ""}`}>
        <Avatar name="Sunita" src={SUNITA_PHOTO} size={26} />
      </span>
    </div>
  );
}

function ReelVideo({ dim = false }: { dim?: boolean }) {
  return (
    <>
      <video
        className="absolute inset-0 h-full w-full object-cover"
        src="/v2/reel.mp4"
        poster="/v2/reel-poster.jpg"
        autoPlay
        muted
        loop
        playsInline
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      {dim && <div className="v2-fade absolute inset-0 bg-black/45" />}
    </>
  );
}

/** iOS-style notification banner that slides in from the top. */
export function Banner({ icon, title, body, onClick, time = "now" }: { icon: ReactNode; title: string; body: ReactNode; onClick: () => void; time?: string }) {
  return (
    <button
      type="button"
      onClick={tap(onClick)}
      className="v2-banner v2-ios absolute inset-x-[10px] top-[52px] z-40 flex items-start gap-3 rounded-[22px] bg-white/85 p-3 text-left shadow-[0_12px_40px_rgba(0,0,0,0.25)] ring-1 ring-black/5 backdrop-blur-xl active:scale-[0.98]"
    >
      <span className="mt-[2px] shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-[15px] font-semibold text-black">{title}</span>
          <span className="shrink-0 text-[13px] text-black/45">{time}</span>
        </span>
        <span className="mt-[1px] block text-[14px] leading-[1.3] text-black/85">{body}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 1. Reel viewer                                                      */
/* ------------------------------------------------------------------ */

export function ReelScreen({ onNext, hideStatusBar }: ScreenProps) {
  return (
    <div className="v2-ios flex h-full flex-col bg-black text-white">
      <div className="relative flex-1 overflow-hidden">
        <ReelVideo />
        <div className="absolute inset-x-0 top-0">
          <StatusBar dark hidden={hideStatusBar} />
          <div className="flex items-center justify-between px-4 pt-1">
            <I.Plus size={26} />
            <span className="flex items-center gap-5 text-[19px] font-bold">
              Reels <span className="text-white/55">Friends</span>
            </span>
            <I.Camera size={26} />
          </div>
          <div className="mt-3 flex justify-center">
            <span className="v2-in inline-flex items-center gap-1.5 rounded-full bg-black/45 py-1 pl-1 pr-3 text-[12px] font-medium backdrop-blur-md">
              <SmileyFace size={18} />
              Smiley is replying for you · 38 sent
            </span>
          </div>
        </div>

        {/* right rail */}
        <div className="absolute bottom-5 right-3 flex flex-col items-center gap-[18px] text-[12px] font-semibold">
          <span className="flex flex-col items-center gap-1">
            <I.Heart size={29} fill="#FF3040" stroke="#FF3040" />
            1,248
          </span>
          <button type="button" onClick={tap(onNext)} className="relative flex flex-col items-center gap-1" aria-label="Open comments">
            <span className="rounded-full p-[3px]">
              <I.Comment size={28} />
            </span>
            86
          </button>
          <span className="flex flex-col items-center gap-1">
            <I.Repost size={27} />
            52
          </span>
          <span className="flex flex-col items-center gap-1">
            <I.Send size={27} />
            214
          </span>
          <I.Dots size={24} />
          <span className="h-[30px] w-[30px] overflow-hidden rounded-[8px] ring-2 ring-white">
            <Avatar name="Sunita" src={SUNITA_PHOTO} size={30} />
          </span>
        </div>

        {/* caption */}
        <div className="absolute bottom-5 left-3 right-[70px]">
          <div className="flex items-center gap-2">
            <Avatar name="Sunita" src={SUNITA_PHOTO} size={32} />
            <span className="text-[14px] font-semibold">{HANDLE}</span>
            <span className="rounded-[8px] border border-white/60 px-2.5 py-[3px] text-[13px] font-semibold">Your reel</span>
          </div>
          <p className="mt-2 text-[14px] leading-[1.35]">
            Soft till lunch. Real ghar ka khana. 🍱 Lunch tiffins across Lucknow, order by DM… <span className="text-white/60">more</span>
          </p>
          <div className="mt-2 flex items-center gap-1.5 text-[13px] text-white/90">
            <I.Music size={13} /> {HANDLE} · Original audio
          </div>
        </div>
      </div>
      <TabBar dark active="reels" />
      <div className="bg-black">
        <HomeIndicator dark />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 2. Comments sheet                                                   */
/* ------------------------------------------------------------------ */

type C = { user: string; time: string; text: string; likes: number; reply?: string };
const COMMENTS: C[] = [
  { user: "priya.eats", time: "2h", text: "How do I order?? 😍", likes: 24, reply: "Haan ji! DM karo, menu bhej deti hoon 🙏" },
  { user: "neha_foodie", time: "48m", text: "Is this made with palm oil?", likes: 3 },
  { user: "ankit_lko", time: "2h", text: "Price kitna hai?", likes: 9, reply: "₹120 per thali ji. Dal, sabzi, 4 roti, chawal sab included 😊 DM karo!" },
  { user: "meera.s", time: "1h", text: "Do you deliver to Hazratganj?", likes: 6, reply: "Haan bilkul! Hazratganj, Gomti Nagar, Aliganj sab cover karte hain 🛵" },
  { user: "rohit.v", time: "20m", text: "Looks exactly like my nani's food ❤️", likes: 11, reply: "Aww thank you ji! Nani ka aashirwaad hai 🙏" },
];

function CommentRow({ c, i }: { c: C; i: number }) {
  return (
    <div className="v2-in px-4 py-2.5" style={{ animationDelay: `${120 + i * 90}ms` }}>
      <div className="flex gap-3">
        <Avatar name={c.user.replace(/[._]/g, " ")} size={34} />
        <div className="min-w-0 flex-1">
          <div className="text-[13px]">
            <span className="font-semibold">{c.user}</span> <span className="text-black/45">{c.time}</span>
          </div>
          <div className="text-[14px] leading-[1.35]">{c.text}</div>
          <div className="mt-1 text-[12px] font-semibold text-black/45">Reply</div>
        </div>
        <div className="flex w-6 flex-col items-center pt-1 text-[11px] text-black/45">
          <I.Heart size={15} />
          {c.likes}
        </div>
      </div>
      {c.reply && (
        <div className="ml-[46px] mt-2.5 flex gap-2.5">
          <Avatar name="Sunita" src={SUNITA_PHOTO} size={26} />
          <div className="min-w-0 flex-1">
            <div className="text-[13px]">
              <span className="font-semibold">{HANDLE}</span> <span className="text-black/45">· Author · 1m</span>
            </div>
            <div className="text-[14px] leading-[1.35]">{c.reply}</div>
            <div className="mt-1.5">
              <SmileyBadge />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CommentsScreen({ onNext, hideStatusBar }: ScreenProps) {
  const shown = useReveal([1700]);
  return (
    <div className="v2-ios relative flex h-full flex-col bg-black">
      <div className="absolute inset-0">
        <ReelVideo dim />
      </div>
      <div className="relative">
        <StatusBar dark hidden={hideStatusBar} />
      </div>
      {shown > 0 && (
        <Banner
          icon={<IgGlyphBox />}
          title="Instagram"
          body={
            <>
              <b>rajesh.k_lko</b> and 4 others sent you messages. Smiley is on it.
            </>
          }
          onClick={onNext}
        />
      )}
      <div className="v2-sheet absolute inset-x-0 bottom-0 flex h-[80%] flex-col rounded-t-[18px] bg-white text-black">
        <div className="flex shrink-0 flex-col items-center pb-2 pt-2">
          <span className="h-[4px] w-9 rounded-full bg-black/20" />
          <span className="mt-3 text-[15px] font-bold">Comments</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 border-y border-black/[0.06] bg-[#F7FAFF] px-4 py-2 text-[12px] text-black/70">
          <SmileyFace size={18} />
          <span>
            <b className="text-black">38 replied</b> in your tone
          </span>
        </div>
        <div className="v2-scroll flex-1 overflow-y-auto pb-2">
          {COMMENTS.map((c, i) => (
            <CommentRow key={c.user} c={c} i={i} />
          ))}
        </div>
        <div className="shrink-0 border-t border-black/[0.06]">
          <div className="flex justify-between px-5 py-2 text-[22px]">
            {["❤️", "🙌", "🔥", "👏", "😢", "😍", "😮", "😂"].map((e) => (
              <span key={e}>{e}</span>
            ))}
          </div>
          <div className="flex items-center gap-3 px-4 pb-1">
            <Avatar name="Sunita" src={SUNITA_PHOTO} size={34} />
            <div className="flex h-10 flex-1 items-center rounded-full border border-black/10 px-4 text-[14px] text-black/40">Add a comment for {HANDLE}</div>
          </div>
          <HomeIndicator />
        </div>
      </div>
    </div>
  );
}

function IgGlyphBox() {
  return (
    <span className="block overflow-hidden rounded-[9px]">
      <I.IgGlyph size={38} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 3. DM inbox                                                         */
/* ------------------------------------------------------------------ */

type T = { name: string; preview: string; time: string; unread?: boolean; smiley?: string };
const THREADS: T[] = [
  { name: "Rajesh Kumar", preview: "Hi! Can I get 2 thalis tomorrow…", time: "now", unread: true },
  { name: "Priya Sharma", preview: "Menu bhej do please 🙏", time: "4m", unread: true, smiley: "Smiley sent the menu" },
  { name: "Meera S", preview: "Hazratganj mein deliver hoga?", time: "12m", unread: true, smiley: "Smiley replied" },
  { name: "Ankit Verma", preview: "You: ₹120 per thali ji, sab included 😊", time: "1h", smiley: "Smiley replied" },
  { name: "Kavya R", preview: "Theek hai, kal milte hain 🙏", time: "2h", smiley: "Lead saved" },
  { name: "Sanjay Office Lunch", preview: "You: Kal 12:30 tak pahuncha denge 🛵", time: "3h", smiley: "Smiley replied" },
];

export function InboxScreen({ onNext, hideStatusBar }: ScreenProps) {
  return (
    <div className="v2-ios flex h-full flex-col bg-white text-black">
      <StatusBar hidden={hideStatusBar} />
      <div className="flex h-11 shrink-0 items-center justify-between px-4">
        <I.Back size={26} />
        <span className="flex items-center gap-1 text-[19px] font-bold">
          {HANDLE} <I.Chevron size={16} strokeWidth={2.6} />
        </span>
        <I.Compose size={25} />
      </div>
      <div className="px-4 pt-1">
        <div className="flex h-9 items-center gap-2 rounded-[10px] bg-[#EFEFF0] px-3 text-[15px] text-black/45">
          <I.Search size={17} /> Search
        </div>
      </div>
      <div className="v2-scroll flex-1 overflow-y-auto">
        <div className="flex gap-4 px-4 pb-1 pt-4">
          {[
            { n: "Your note", src: SUNITA_PHOTO, note: "Kal: rajma 🍛" },
            { n: "Priya", note: "Hungry 😋" },
            { n: "Meera" },
            { n: "Rohit" },
          ].map((x) => (
            <div key={x.n} className="relative flex w-[74px] flex-col items-center pt-7">
              {x.note && (
                <span className="absolute top-0 z-10 max-w-[86px] truncate rounded-[12px] bg-white px-2 py-1 text-[11px] shadow-[0_2px_10px_rgba(0,0,0,0.12)]">
                  {x.note}
                </span>
              )}
              <Avatar name={x.n} src={x.src} size={68} />
              <span className="mt-1.5 text-[12px] text-black/60">{x.n}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-4 pb-1 pt-3">
          <span className="text-[16px] font-bold">Messages</span>
          <span className="text-[14px] font-semibold text-[#0095F6]">Requests (4)</span>
        </div>
        <div className="mx-4 mb-1 mt-1 flex items-center gap-2 rounded-[12px] bg-[#F2F8FF] px-3 py-2 text-[12.5px] text-black/75">
          <SmileyFace size={20} />
          <span>
            Smiley handled <b>12 DMs</b> today in your tone · <b>6 leads</b> saved
          </span>
        </div>
        {THREADS.map((t, i) => {
          const first = i === 0;
          const Row = first ? "button" : "div";
          return (
            <Row
              key={t.name}
              {...(first ? { type: "button" as const, onClick: tap(onNext) } : {})}
              className={`v2-in relative flex w-full items-center gap-3 px-4 py-2 text-left ${first ? "bg-[#F2F8FF] active:bg-[#E3F0FF]" : ""}`}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <span>
                <Avatar name={t.name} size={56} />
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block truncate text-[15px] ${t.unread ? "font-semibold" : ""}`}>{t.name}</span>
                <span className={`flex text-[14px] ${t.unread ? "font-semibold text-black" : "text-black/50"}`}>
                  <span className="truncate">{t.preview}</span>
                  <span className="shrink-0 whitespace-pre font-normal text-black/45"> · {t.time}</span>
                </span>
                {t.smiley && (
                  <span className="mt-[2px] flex items-center gap-1 text-[11.5px] text-[#1468C7]">
                    <SmileyFace size={13} /> {t.smiley}
                  </span>
                )}
              </span>
              {t.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-[#0095F6]" />}
              <I.Camera size={24} className="shrink-0 text-black/80" />
            </Row>
          );
        })}
      </div>
      <TabBar active="dm" />
      <HomeIndicator />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 4. DM thread                                                        */
/* ------------------------------------------------------------------ */

type Msg =
  | { at: number; typing?: number; from: "them" | "me"; text: string; badge?: boolean }
  | { at: number; from: "system"; text: string };

const SCRIPT: Msg[] = [
  { at: 250, from: "them", text: "Hi! Can I get 2 thalis tomorrow for my office in Gomti Nagar?" },
  { at: 1700, typing: 1100, from: "me", text: "Namaste ji 🙏 Haan bilkul! Kal ka menu: dal tadka, aloo gobhi, 4 roti, jeera rice aur salad. ₹120 per thali." },
  { at: 2600, from: "me", text: "Aapka naam, kitne baje chahiye, office address aur phone number bata dijiye?", badge: true },
  { at: 4400, typing: 1300, from: "them", text: "Rajesh Kumar. 1 pm please. 4B, Cyber Heights, Vibhuti Khand. 98xxx 43210" },
  { at: 5800, typing: 1000, from: "me", text: "Done ji! Sunita aapko confirm karengi 🙏", badge: true },
  { at: 6600, from: "system", text: "Lead saved by Smiley · 2 thalis · tomorrow 1 pm" },
];
const BANNER_AT = 7600;

function useElapsed(limit: number) {
  const [t, setT] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const id = setInterval(() => {
      const e = performance.now() - start;
      setT(e);
      if (e > limit) clearInterval(id);
    }, 100);
    return () => clearInterval(id);
  }, [limit]);
  return t;
}

const OUT_BUBBLE = "linear-gradient(160deg,#7A3CF5 0%,#5A5CF6 45%,#3797F0 100%)";

export function ThreadScreen({ onNext, hideStatusBar }: ScreenProps) {
  const t = useElapsed(BANNER_AT + 200);
  const visible = SCRIPT.filter((m) => m.at <= t);
  const typing = SCRIPT.find((m) => "typing" in m && m.typing && m.at - m.typing <= t && t < m.at);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [visible.length, typing]);

  return (
    <div className="v2-ios relative flex h-full flex-col bg-white text-black">
      <StatusBar hidden={hideStatusBar} />
      {t >= BANNER_AT && (
        <Banner
          icon={
            <span className="block overflow-hidden rounded-[9px]">
              <WaGlyph size={38} />
            </span>
          }
          title="Reels Magic · WhatsApp"
          body={
            <>
              New lead from Instagram 🎉 <b>Rajesh Kumar</b> · 2 thalis · tomorrow 1 pm
            </>
          }
          onClick={onNext}
        />
      )}
      <div className="flex h-[52px] shrink-0 items-center gap-3 border-b border-black/[0.06] px-3">
        <I.Back size={26} />
        <Avatar name="Rajesh Kumar" size={34} />
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-[15px] font-semibold">Rajesh Kumar</span>
          <span className="block text-[12px] text-black/50">rajesh.k_lko</span>
        </span>
        <I.Phone size={24} />
        <I.Video size={27} className="ml-3" />
      </div>
      <div ref={scroller} className="v2-scroll flex-1 overflow-y-auto px-3 pb-3">
        <div className="flex flex-col items-center pb-4 pt-5">
          <Avatar name="Rajesh Kumar" size={84} />
          <div className="mt-2 text-[17px] font-bold">Rajesh Kumar</div>
          <div className="text-[13px] text-black/50">rajesh.k_lko · Instagram</div>
          <div className="mt-1 text-[12px] text-black/45">Saw your reel &quot;Soft till lunch&quot;</div>
          <div className="mt-3 rounded-[10px] bg-[#EFEFF0] px-4 py-1.5 text-[13px] font-semibold">View profile</div>
        </div>
        <div className="py-2 text-center text-[12px] text-black/45">Today 11:42 AM</div>
        <div className="flex flex-col gap-[3px]">
          {visible.map((m, i) => {
            if (m.from === "system")
              return (
                <div key={i} className="v2-in flex justify-center py-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F7EE] py-1 pl-1 pr-3 text-[12px] font-semibold text-[#1F7A47]">
                    <SmileyFace size={18} /> {m.text}
                  </span>
                </div>
              );
            const mine = m.from === "me";
            const prev = visible[i - 1];
            const gap = prev && prev.from !== m.from ? "mt-3" : "";
            return (
              <div key={i} className={`v2-in flex flex-col ${mine ? "items-end" : "items-start"} ${gap}`}>
                <div className={`flex max-w-[78%] items-end gap-2 ${mine ? "" : ""}`}>
                  {!mine && <Avatar name="Rajesh Kumar" size={26} />}
                  <div
                    className={`rounded-[22px] px-[14px] py-[9px] text-[15px] leading-[1.32] ${mine ? "text-white" : "bg-[#EFEFF0]"}`}
                    style={mine ? { background: OUT_BUBBLE } : undefined}
                  >
                    {m.text}
                  </div>
                </div>
                {"badge" in m && m.badge && (
                  <div className="mt-1">
                    <SmileyBadge>Sent by Smiley · your tone</SmileyBadge>
                  </div>
                )}
              </div>
            );
          })}
          {typing && typing.from === "them" && (
            <div className="v2-in mt-3 flex items-end gap-2">
              <Avatar name="Rajesh Kumar" size={26} />
              <div className="rounded-[22px] bg-[#EFEFF0] px-4 py-[13px]">
                <TypingDots />
              </div>
            </div>
          )}
          {typing && typing.from === "me" && (
            <div className="v2-in mt-3 flex justify-end">
              <span className="inline-flex items-center gap-2 rounded-full bg-[#F2F8FF] py-1.5 pl-1.5 pr-3 text-[12px] font-medium text-[#1468C7]">
                <SmileyFace size={18} /> Smiley is typing in your tone <TypingDots color="#1E8BFF" />
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="shrink-0 px-3 pb-1 pt-1">
        <div className="flex h-11 items-center gap-2 rounded-full bg-[#EFEFF0] pl-1 pr-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#3797F0] text-white">
            <I.Camera size={20} />
          </span>
          <span className="flex-1 text-[15px] text-black/45">Message…</span>
          <I.Mic size={22} />
          <I.ImageIcon size={22} />
          <I.Sticker size={22} />
        </div>
      </div>
      <HomeIndicator />
    </div>
  );
}
