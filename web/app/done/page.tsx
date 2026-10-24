"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, Squiggle, PrimaryButton, GhostButton } from "@/components/ui";
import { SlideCard } from "@/components/slides";
import { load, getMade, type Made } from "@/lib/store";
import { slidesOf } from "@/lib/slides";

const CONFETTI = [
  { bg: "#FFD84D", s: 12, left: 60, top: 40, r: 0 },
  { bg: "#F28AB0", s: 10, left: 300, top: 250, r: 0 },
  { bg: "#8C7DFF", s: 14, left: 50, top: 240, r: 30 },
  { bg: "#1F9D57", s: 8, left: 310, top: 150, r: 0 },
];

export default function Done() {
  const router = useRouter();
  const [id, setId] = useState<string>("");
  const [made, setM] = useState<Made | null>(null);
  const [plan, setPlan] = useState<any>(null);
  const [published, setPublished] = useState<string[]>([]);
  const [permalink, setPermalink] = useState<string | null>(null);

  useEffect(() => {
    const i = new URLSearchParams(location.search).get("id") ?? load<string>("current", "");
    setId(i);
    setM(getMade(i));
    setPlan(load("plan", null));
    setPublished(load<string[]>("published", []));
    setPermalink(load<string | null>(`permalink:${i}`, null));
  }, []);

  const posts: any[] = plan?.posts ?? [];
  const total = posts.length || 5;
  const next = posts.find((p) => !published.includes(p.id));
  const slide = made ? slidesOf(made.post)[0] : null;
  const shareText = `My first Instagram post is ready! Made with Smiley on Reels Magic. ${permalink ?? ""}`.trim();

  function nextPost() {
    if (!next) return router.push("/plan");
    if (!load<boolean>("paid", false)) return router.push(`/pay?next=${next.id}`);
    router.push(`/make/${next.id}`);
  }

  return (
    <Screen style={{ backgroundImage: "radial-gradient(ellipse 100% 55% at 50% 30%, #8C7DFF40 0%, #8C7DFF00 100%)" }}>
      <div className="relative flex h-[330px] shrink-0 items-center justify-center">
        <div className="pop w-[200px] -rotate-4 overflow-hidden rounded-[22px] shadow-[0_22px_48px_#17142B33]">
          {made?.slides?.[0] && !made.photos?.length ? (
            <img src={made.slides[0]} alt="" className="aspect-[4/5] w-full object-cover" />
          ) : slide ? (
            <SlideCard slide={slide} index={0} total={slidesOf(made!.post).length} photo={made?.photos?.[0]} />
          ) : (
            <div className="aspect-[4/5] bg-lav" />
          )}
        </div>
        <Orb size={64} face="happy" className="absolute right-[70px] top-[54px]" />
        {CONFETTI.map((c, i) => (
          <span key={i} className="absolute rounded-[5px]" style={{ background: c.bg, width: c.s, height: c.s, left: c.left, top: c.top, rotate: `${c.r}deg` }} />
        ))}
      </div>

      <div className="flex flex-col items-center gap-2 px-[30px] pt-2 text-center">
        <h1 className="font-display text-[36px] font-extrabold leading-10 tracking-[-0.03em]">Posted!</h1>
        <Squiggle width={100} />
        <p className="text-[15px] leading-[22px] text-muted">
          {permalink ? "It's live on your Instagram." : "Nice! It's on your Instagram."} Next post tomorrow, I'll remind you.
        </p>
      </div>

      <div className="mx-5 mt-[22px] flex items-center justify-between rounded-[20px] bg-mist px-4 py-3.5">
        <span className="font-display text-[16px] font-bold">This week {published.length} / {total}</span>
        <span className="flex gap-1">
          {Array.from({ length: total }).map((_, i) => (
            <span key={i} className="h-2 w-[26px] rounded" style={{ background: i < published.length ? "linear-gradient(90deg,#8C7DFF,#6A58F5)" : "#E4E1F2" }} />
          ))}
        </span>
      </div>

      <div className="flex-1" />
      <div className="flex flex-col gap-2.5 px-5 pb-[34px] pt-6">
        <div className="flex gap-2.5">
          <GhostButton href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}>Share on WhatsApp</GhostButton>
          <GhostButton href={permalink ?? "https://www.instagram.com/"}>View on Instagram</GhostButton>
        </div>
        <PrimaryButton onClick={nextPost}>{next ? "Next post" : "See plan"}</PrimaryButton>
      </div>
    </Screen>
  );
}
