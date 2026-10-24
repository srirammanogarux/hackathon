"use client";
import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, PrimaryButton, GhostButton, BackButton, Check, Spinner, Toast } from "@/components/ui";
import { load, save, api, getMade, type Made } from "@/lib/store";
import { captionOf, slidesOf, DEMO_REEL, postLang } from "@/lib/slides";

function markPublished(id: string, permalink?: string | null) {
  const pub = load<string[]>("published", []);
  if (!pub.includes(id)) save("published", [...pub, id]);
  if (permalink) save(`permalink:${id}`, permalink);
}

export default function Publish({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [made, setM] = useState<Made | null>(null);
  const [ig, setIg] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"choose" | "manual">("choose");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setM(getMade(id));
    api("/api/config").then((c) => setIg(!!c.instagram)).catch(() => setIg(false));
  }, [id]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 3000);
  }

  if (!made) return <Screen className="items-center justify-center"><Spinner color="#6A58F5" /></Screen>;

  const caption = captionOf(made.post);
  const usesAiVoice = made.reelSource === "elevenlabs";
  const hasSlides = (made.slides?.length ?? 0) > 0;

  async function publishIG() {
    setBusy(true);
    try {
      const kind = hasSlides ? "carousel" : "reel";
      const r = await api("/api/publish", { kind, images: made!.slides ?? [], reel: made!.reel, caption, ai: usesAiVoice || kind === "reel" });
      if (!r.ok) {
        setMode("manual");
        flash("Couldn't connect to Instagram. Download it instead.");
      } else {
        markPublished(id, r.permalink);
        router.push(`/done?id=${id}`);
      }
    } catch (e) {
      flash("Couldn't post. Download and post it yourself.");
      setMode("manual");
    }
    setBusy(false);
  }

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      flash("Caption copied!");
    } catch {
      flash("Couldn't copy. Long-press to copy.");
    }
  }

  const downloads: { href: string; label: string }[] = [
    ...(made.slides ?? []).map((s, i) => ({ href: s, label: `Slide ${i + 1}` })),
    { href: made.reel ?? DEMO_REEL[postLang(made.post)] ?? DEMO_REEL.hi, label: "Reel (9:16)" },
  ];

  return (
    <Screen style={{ backgroundImage: "radial-gradient(ellipse 110% 50% at 50% 0%, #8C7DFF38 0%, #8C7DFF00 100%)" }}>
      <div className="flex items-center gap-3 px-5 pt-1">
        <BackButton href={`/post/${id}`} />
      </div>
      <div className="flex flex-col items-center gap-3 px-7 pt-2 text-center">
        <Orb size={80} />
        <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em]">
          {mode === "manual" ? "Post it yourself, it's easy!" : "Let's post to Instagram"}
        </h1>
        <p className="text-[15px] leading-[22px] text-muted">
          {mode === "manual" ? "Download, copy the caption, paste it on Instagram." : "Your first post is free. Nothing gets posted without your yes."}
        </p>
      </div>

      {mode === "choose" ? (
        <div className="mx-5 mt-6 flex flex-col gap-2.5 rounded-3xl bg-mist p-4">
          {["Your Instagram Professional account", "AI info label added automatically", "Carousel + caption + hashtags"].map((t) => (
            <div key={t} className="flex items-center gap-2.5 text-[15px] leading-[18px]">
              <Check /> {t}
            </div>
          ))}
        </div>
      ) : (
        <div className="mx-5 mt-6 flex flex-col gap-2.5">
          <div className="flex flex-col gap-1 rounded-[20px] bg-white p-3.5 shadow-[0_6px_18px_#17142B0A]">
            <span className="text-[12px] font-semibold text-muted">Caption</span>
            <p className="line-clamp-4 whitespace-pre-line text-[14px] leading-5">{caption}</p>
            <button onClick={copyCaption} className="mt-1 self-start rounded-full bg-lav px-3 py-1.5 text-[13px] font-bold text-primary">Copy caption</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {downloads.map((d) => (
              <a key={d.href} href={d.href} download className="rounded-full border-[1.5px] border-line bg-white px-3.5 py-2 text-[14px] font-semibold">
                ↓ {d.label}
              </a>
            ))}
          </div>
          {!hasSlides && slidesOf(made.post).length > 0 && (
            <p className="text-[12px] text-muted">Screenshot the slides and post them (server render failed).</p>
          )}
          <a href="https://www.instagram.com/" target="_blank" rel="noreferrer" className="rounded-full bg-ink py-3 text-center text-[15px] font-bold text-white">
            Open Instagram
          </a>
        </div>
      )}

      <div className="flex-1" />
      <div className="flex flex-col items-center gap-3 px-5 pb-[34px] pt-6">
        {mode === "choose" ? (
          <>
            <PrimaryButton onClick={ig ? publishIG : () => setMode("manual")} disabled={busy || ig === null}>
              {busy ? <Spinner color="#FFFFFF" /> : ig ? "Post now" : "Connect Instagram"}
            </PrimaryButton>
            <button onClick={() => setMode("manual")} className="text-[15px] font-semibold text-primary">Download and post it yourself</button>
          </>
        ) : (
          <>
            <PrimaryButton
              onClick={() => {
                markPublished(id);
                router.push(`/done?id=${id}`);
              }}
            >
              I posted it!
            </PrimaryButton>
            {ig && <GhostButton onClick={() => setMode("choose")} className="w-full flex-none">Try auto post</GhostButton>}
          </>
        )}
      </div>
      <Toast text={toast} />
    </Screen>
  );
}
