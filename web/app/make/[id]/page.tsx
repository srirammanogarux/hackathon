"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, PrimaryButton, BackButton, Icon, Check, Spinner } from "@/components/ui";
import { load, save, api, sleep, getMade, setMade, type Made } from "@/lib/store";
import { slidesOf } from "@/lib/slides";
import { LANG_NAME, saathiTip, type Lang, type UiLang } from "@/lib/lang";

type Step = { key: string; name: string; doing: string; icon: string; bg: string; ring: string };
const STEPS: Step[] = [
  { key: "khabri", name: "Scout", doing: "checking trends", icon: "search", bg: "#E3EEFF", ring: "#7FA6E8" },
  { key: "lekhak", name: "Writer", doing: "writing", icon: "pen", bg: "#FFF6E0", ring: "#E8B84A" },
  { key: "chitrakar", name: "Designer", doing: "designing", icon: "image", bg: "#FFE7EF", ring: "#F28AB0" },
  { key: "awaaz", name: "Voice", doing: "recording the voiceover", icon: "wave", bg: "#E5F6EC", ring: "#5CC08A" },
  { key: "kaaval", name: "Guard", doing: "running a safety check", icon: "shield", bg: "#EDE9FF", ring: "#8C7DFF" },
];
const DONE_LABEL: Record<string, string> = { khabri: "trends checked", lekhak: "written", chitrakar: "design ready", awaaz: "voiceover ready", kaaval: "checked" };

// Downscale a picked photo to a small JPEG data URL so it fits in localStorage.
function shrink(file: File, max = 720): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export default function Make({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [item, setItem] = useState<any>(null);
  const [phase, setPhase] = useState<"photos" | "team">("photos");
  const [photos, setPhotos] = useState<string[]>([]);
  const [step, setStep] = useState(0);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const started = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const plan = load<any>("plan", null);
    setItem(plan?.posts?.find((p: any) => p.id === id) ?? null);
    if (new URLSearchParams(location.search).has("redo")) setPhase("team");
  }, [id]);

  useEffect(() => {
    if (phase === "team" && item && !started.current) {
      started.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, item]);

  async function addPhotos(files: FileList | null) {
    if (!files) return;
    const next = [...photos];
    for (const f of Array.from(files).slice(0, 6 - photos.length)) next.push(await shrink(f));
    setPhotos(next);
  }

  async function timed<T>(fn: () => Promise<T>, min = 1100): Promise<T> {
    const [r] = await Promise.all([fn(), sleep(min)]);
    return r;
  }

  async function run() {
    setFailed(false);
    const profile = load<any>("profile", null);
    const redo = new URLSearchParams(location.search).has("redo");
    const prev = getMade(id);
    const usedPhotos = photos.length ? photos : prev?.photos ?? [];
    const cfg = await api("/api/config").catch(() => ({ claude: false }));
    // Guard demo moment: the very first draft is a risky one (mock mode, or ?demo=1 on the welcome screen).
    const firstPost = load<string[]>("published", []).length === 0 && !redo && !prev;
    const risky = firstPost && (load<boolean>("demo", false) || !cfg.claude);
    try {
      setStep(0);
      await timed(async () => null, 1200);
      setNotes((n) => ({ ...n, khabri: saathiTip(item, load<UiLang>("lang", "hinglish")) ?? "People love saving posts like this" }));

      setStep(1);
      const { post } = await timed(() => api("/api/make", { item, profile, risky }));
      const lang = (post.languages_out?.[0] ?? "hi") as Lang;
      setNotes((n) => ({ ...n, lekhak: `Hook + ${slidesOf(post).length > 1 ? `${slidesOf(post).length} slides` : "design"} + caption, in ${LANG_NAME[lang]}` }));

      setStep(2);
      const slides = await timed(() => api("/api/render", { step: "slides", post, id }));
      setNotes((n) => ({ ...n, chitrakar: usedPhotos.length ? `From your ${usedPhotos.length} photos` : `${slidesOf(post).length} slide${slidesOf(post).length > 1 ? "s" : ""}, in ${LANG_NAME[lang]} font` }));

      setStep(3);
      const reel = await timed(() => api("/api/render", { step: "reel", post, id, slideFiles: slides.files }));
      setNotes((n) => ({ ...n, awaaz: reel.source === "elevenlabs" ? `${LANG_NAME[lang]} voiceover + captions` : `${LANG_NAME[lang]} voiceover (demo)` }));

      setStep(4);
      const check = await timed(() => api("/api/check", { post, profile }), 1400);
      const flagged = check.verdict?.verdict === "flag";
      setNotes((n) => ({ ...n, kaaval: flagged ? `${check.verdict.reasons.length} things to change` : "All safe" }));
      setStep(5);

      const made: Made = {
        post,
        verdict: check.verdict,
        agenticorg: check.agenticorg,
        slides: slides.slides,
        files: slides.files,
        reel: reel.reel,
        reelSource: reel.source,
        photos: usedPhotos,
      };
      setMade(id, made);
      save("current", id);
      await sleep(700);
      router.replace(`/post/${id}`);
    } catch (e) {
      console.error(e);
      setFailed(true);
    }
  }

  if (!item) {
    return (
      <Screen className="items-center justify-center gap-4 px-8 text-center">
        <Orb size={96} />
        <p className="text-muted">This post isn't in your plan.</p>
        <PrimaryButton href="/plan">Go to plan</PrimaryButton>
      </Screen>
    );
  }

  if (phase === "photos") {
    const isReel = item.format === "reel";
    return (
      <Screen>
        <div className="flex items-center gap-3 px-5 pt-1">
          <BackButton href="/plan" />
          <span className="font-display text-[20px] font-extrabold">Add photos</span>
        </div>
        <div className="flex items-start gap-3 px-5 pt-6">
          <Orb size={56} />
          <div className="flex flex-1 flex-col gap-1.5 rounded-[6px_22px_22px_22px] bg-chip px-4 py-3.5">
            <h1 className="font-display text-[22px] font-bold leading-[27px] tracking-[-0.02em]">{isReel ? "3–5 photos are enough" : "3 photos are enough"}</h1>
            <p className="text-[14px] leading-5 text-muted">{item.title_en}. Shoot near a window, show only your hands.</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5 px-5 pt-6">
          {Array.from({ length: 3 }).map((_, i) => {
            const p = photos[i];
            return (
              <button
                key={i}
                onClick={() => fileRef.current?.click()}
                className="relative flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[20px]"
                style={{ background: ["#FFF6E0", "#EDE9FF", "#E5F6EC"][i] }}
              >
                {p ? <img src={p} alt={`Photo ${i + 1}`} className="h-full w-full object-cover" /> : <Icon name="camera" size={26} color="#6B6880" />}
              </button>
            );
          })}
        </div>
        {photos.length > 3 && <p className="px-5 pt-2 text-[13px] text-muted">+{photos.length - 3} more</p>}
        <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />

        <div className="mx-5 mt-5 flex flex-col gap-2 rounded-[20px] bg-mist p-4">
          {["Use window light", "Rest your phone on a box", "No face, family or home address"].map((t) => (
            <div key={t} className="flex items-center gap-2.5 text-[14px] leading-[18px]">
              <Check size={22} /> {t}
            </div>
          ))}
        </div>

        <div className="flex-1" />
        <div className="flex flex-col items-center gap-3 px-5 pb-9 pt-6">
          {photos.length ? (
            <PrimaryButton onClick={() => setPhase("team")}>Send to the team</PrimaryButton>
          ) : (
            <PrimaryButton onClick={() => fileRef.current?.click()}>Pick from gallery</PrimaryButton>
          )}
          <button onClick={() => setPhase("team")} className="text-[15px] font-semibold text-primary">
            No photos, just make a design
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundImage: "radial-gradient(ellipse 90% 45% at 50% 100%, #8C7DFF47 0%, #8C7DFF00 100%)" }}>
      <div className="flex flex-col items-center gap-3 px-6 pb-[22px] pt-5 text-center">
        <div className="relative h-24 w-24">
          <div className="absolute -left-[22px] -top-[22px] h-[140px] w-[140px] rounded-full" style={{ backgroundImage: "radial-gradient(circle, #7C6CFF40 0%, #7C6CFF00 70%)" }} />
          <Orb size={96} face={step >= 5 ? "happy" : "focus"} className="relative" />
        </div>
        <h1 className="font-display text-[28px] font-extrabold leading-8 tracking-[-0.03em]">{step >= 5 ? "Ready!" : "Your team is on it…"}</h1>
        <p className="text-[14px] leading-[18px] text-muted">{item.title_en} · {item.format === "single_image" ? "Photo post" : item.format === "reel" ? "Reel" : "Carousel"}</p>
      </div>

      <div className="flex flex-col gap-2 px-5">
        {STEPS.map((s, i) => {
          const state = i < step ? "done" : i === step ? "active" : "todo";
          return (
            <div
              key={s.key}
              className="flex items-center gap-3 rounded-[20px] px-3.5 py-3 transition-all duration-300"
              style={{
                background: state === "todo" ? "#F6F5FB" : s.bg,
                opacity: state === "todo" ? 0.6 : 1,
                border: state === "active" ? `2px solid ${s.ring}` : "2px solid transparent",
              }}
            >
              <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white">
                <Icon name={s.icon} size={18} />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-display text-[16px] font-bold leading-5">
                  {s.name} · {state === "done" ? DONE_LABEL[s.key] : s.doing}
                </span>
                <span className="line-clamp-1 text-[13px] leading-4 text-muted">
                  {notes[s.key] ?? (state === "active" ? "Working…" : "Waiting")}
                </span>
              </span>
              {state === "done" && <Check color="#FFFFFF" bg="#1F9D57" size={24} />}
              {state === "active" && !failed && <Spinner color={s.ring} />}
            </div>
          );
        })}
      </div>

      <div className="flex-1" />
      <div className="flex flex-col items-center gap-1.5 px-8 pb-10 pt-6 text-center">
        {failed ? (
          <>
            <p className="text-[15px] leading-[22px]">This is taking a while. Try again?</p>
            <PrimaryButton onClick={() => run()} className="mt-2">Try again</PrimaryButton>
          </>
        ) : (
          <>
            <span className="text-[12px] font-semibold leading-4 text-primary">Smiley's tip</span>
            <p className="text-[15px] leading-[22px]">Say &quot;save this&quot; on the last slide to boost reach.</p>
          </>
        )}
      </div>
    </Screen>
  );
}
