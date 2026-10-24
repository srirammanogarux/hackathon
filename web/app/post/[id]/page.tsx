"use client";
import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Screen, Orb, PrimaryButton, GhostButton, BackButton, Icon, MicIcon, Spinner, Toast } from "@/components/ui";
import { SlideCard } from "@/components/slides";
import { load, api, getMade, setMade, type Made } from "@/lib/store";
import { slidesOf, postLang } from "@/lib/slides";
import { LANG_NAME, type Lang } from "@/lib/lang";

const QUICK = ["Make it shorter", "Don't show the kitchen, only hands", "Make the title catchier"];

function Media({ made, view }: { made: Made; view: "carousel" | "reel" }) {
  const [idx, setIdx] = useState(0);
  const slides = slidesOf(made.post);
  const usePhotos = (made.photos?.length ?? 0) > 0;
  const server = !usePhotos && made.slides?.length === slides.length ? made.slides : null;
  if (view === "reel") {
    return (
      <div className="flex h-[370px] items-center justify-center">
        <video key={made.reel} src={made.reel} controls playsInline loop className="h-[350px] rounded-3xl bg-ink shadow-[0_20px_44px_#17142B2E]" style={{ aspectRatio: "9/16" }} />
      </div>
    );
  }
  return (
    <div className="relative h-[370px]">
      <div
        className="no-scrollbar flex h-[346px] snap-x snap-mandatory gap-3 overflow-x-auto px-[52px] pt-2"
        onScroll={(e) => setIdx(Math.round(e.currentTarget.scrollLeft / 282))}
      >
        {slides.map((s, i) => (
          <div key={i} className="w-[270px] shrink-0 snap-center overflow-hidden rounded-3xl shadow-[0_20px_44px_#17142B2E]">
            {server ? (
              <img src={server[i]} alt={s.headline} className="aspect-[4/5] w-full object-cover" />
            ) : (
              <SlideCard slide={s} index={i} total={slides.length} photo={made.photos?.[i % (made.photos?.length || 1)]} />
            )}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-[5px]">
        {slides.map((_, i) => (
          <span key={i} className="h-1.5 rounded-[3px] transition-all" style={{ width: i === idx ? 18 : 6, background: i === idx ? "#6A58F5" : "#CFCBE6" }} />
        ))}
      </div>
    </div>
  );
}

export default function PostPreview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [made, setM] = useState<Made | null>(null);
  const [view, setView] = useState<"carousel" | "reel">("carousel");
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [recording, setRecording] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);

  useEffect(() => setM(getMade(id)), [id]);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 3200);
  }
  function update(m: Made) {
    setMade(id, m);
    setM(m);
  }

  if (!made) {
    return (
      <Screen className="items-center justify-center gap-4 px-8 text-center">
        <Orb size={96} />
        <p className="text-muted">This post isn't ready yet.</p>
        <PrimaryButton href={`/make/${id}`}>Make it now</PrimaryButton>
      </Screen>
    );
  }

  const profile = load<any>("profile", null);
  const v = made.verdict;
  const flagged = v?.verdict === "flag" && !made.rewritten;
  const lang = postLang(made.post) as Lang;

  async function refresh(post: any, extra: Partial<Made>) {
    const [slides, check] = await Promise.all([
      api("/api/render", { step: "slides", post, id }).catch(() => ({ slides: null })),
      api("/api/check", { post, profile }),
    ]);
    return { ...made!, ...extra, post, slides: slides.slides, files: slides.files, verdict: check.verdict, agenticorg: check.agenticorg ?? made!.agenticorg };
  }

  async function useRewrite() {
    if (!v?.safe_rewrite) return;
    setBusy("rewrite");
    try {
      const next = await refresh(v.safe_rewrite, { original: made!.post, rewritten: true });
      next.rewritten = true;
      next.original = made!.post;
      next.verdict = { ...next.verdict, fixed: v.reasons };
      update(next);
      flash("Changed as Guard suggested");
    } catch {
      flash("This is taking a while. Please try again.");
    }
    setBusy(null);
  }

  async function revise(text: string) {
    if (!text.trim()) return;
    setBusy("revise");
    setSheet(false);
    try {
      const r = await api("/api/revise", { post: made!.post, instruction: text, profile });
      const next = await refresh(r.post, { rewritten: true });
      update(next);
      flash(r.change_summary ?? "Changed!");
    } catch {
      flash("Couldn't change it. Please say it again.");
    }
    setInstruction("");
    setBusy(null);
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const fd = new FormData();
        fd.append("audio", new Blob(chunks, { type: mr.mimeType || "audio/webm" }), "change.webm");
        fd.append("lang", lang);
        const r = await fetch("/api/transcribe", { method: "POST", body: fd }).then((r) => r.json()).catch(() => ({}));
        if (r.text) revise(r.text);
        else flash("Couldn't hear you. Type it or tap a chip.");
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch {
      flash("No mic found. Please type it.");
    }
  }
  function stopRec() {
    rec.current?.stop();
    rec.current = null;
    setRecording(false);
  }

  const caption = made.post.caption?.[0]?.text ?? "";
  const rewriteSlide = v?.safe_rewrite ? slidesOf(v.safe_rewrite)[0] : null;
  const draftSlide = slidesOf(made.post)[0];
  const ao = made.agenticorg as any;

  return (
    <Screen style={{ background: "#F6F5FB" }}>
      <div className="flex items-center justify-between px-5 pb-3 pt-1">
        <BackButton href="/plan" bg="bg-white" />
        <span className="font-display text-[20px] font-extrabold">{flagged ? "One moment!" : "Ready!"}</span>
        <div className="flex gap-1 rounded-full bg-white p-1">
          {(["carousel", "reel"] as const).map((k) => (
            <button key={k} onClick={() => setView(k)} className={`rounded-full px-2.5 py-1.5 text-[12px] font-semibold leading-4 ${view === k ? "bg-ink text-white" : "text-muted"}`}>
              {k === "carousel" ? (made.post.format === "single_image" ? "Photo" : "Carousel") : "Reel"}
            </button>
          ))}
        </div>
      </div>

      {flagged ? (
        <div className="pop flex flex-col gap-3 px-5">
          <div className="flex items-start gap-3 rounded-[20px] border-2 border-[#F2B544] bg-[#FFF3D6] p-3.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white">
              <Icon name="shield" size={18} color="#B7791F" />
            </span>
            <div className="flex flex-1 flex-col gap-1">
              <span className="font-display text-[16px] font-bold leading-5">Guard: needs a small change</span>
              <span className="text-[14px] leading-5 text-[#5C4A1E]">{v.explain}</span>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {v.reasons.map((r: any, i: number) => (
                  <span key={i} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold leading-4 text-[#8A5A00]">
                    {r.rule_id.replace(/^NDC-/, "")}: “{r.excerpt}”
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[#B4443C]">Your draft</span>
              <div className="overflow-hidden rounded-2xl opacity-80 ring-2 ring-[#F4B4AE]">
                {draftSlide && <SlideCard slide={draftSlide} index={0} total={1} />}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-ok">Safe version</span>
              <div className="overflow-hidden rounded-2xl ring-2 ring-[#8FD4AE]">
                {rewriteSlide && <SlideCard slide={rewriteSlide} index={0} total={1} />}
              </div>
            </div>
          </div>
          {ao?.hitl && (
            <p className="rounded-2xl bg-white px-3.5 py-2.5 text-[13px] leading-[18px] text-muted">
              It's in the AgenticOrg review queue. We'll tell you once the team approves.
            </p>
          )}
        </div>
      ) : (
        <>
          <Media made={made} view={view} />
          <div className="mx-5 mt-1.5 flex items-start gap-3 rounded-[20px] bg-mint p-3.5">
            <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full bg-white">
              <Icon name="shield" size={18} color="#1F9D57" />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <span className="font-display text-[16px] font-bold leading-5">Guard: looks safe</span>
              <span className="text-[13px] leading-[19px] text-[#3D5A49]">
                {v?.fixed?.length ? `“${v.fixed[0].excerpt}” was changed. ` : ""}
                {v?.explain ?? "All your rules are respected."}
              </span>
              {ao?.run_id && <span className="text-[12px] leading-4 text-[#3D5A49]/80">Checked by the AgenticOrg Guard agent</span>}
            </div>
          </div>
        </>
      )}

      {!flagged && caption && (
        <div className="mx-5 mt-2.5 flex flex-col gap-1 rounded-[20px] bg-white px-3.5 py-3">
          <span className="text-[12px] font-semibold leading-4 text-muted">Caption · {(made.post.languages_out ?? [lang]).map((l: Lang) => LANG_NAME[l]).join(" + ")}</span>
          <p className="line-clamp-3 whitespace-pre-line text-[14px] leading-5">{caption}</p>
        </div>
      )}

      <div className="flex-1" />

      <div className="flex flex-col gap-2.5 px-5 pb-[34px] pt-5">
        {flagged ? (
          <>
            <PrimaryButton onClick={useRewrite} disabled={!!busy}>
              {busy === "rewrite" ? <Spinner color="#FFFFFF" /> : "Use the safe version"}
            </PrimaryButton>
            <GhostButton onClick={() => setSheet(true)} className="flex-none">I'll change it myself</GhostButton>
          </>
        ) : (
          <>
            <div className="flex gap-2.5">
              <GhostButton onClick={() => setSheet(true)} disabled={!!busy}>
                {busy === "revise" ? <Spinner color="#6A58F5" size={18} /> : <MicIcon color="#17142B" size={18} />}
                Change it
              </GhostButton>
              <GhostButton href={`/make/${id}?redo=1`}>
                <Icon name="redo" size={18} /> Try another
              </GhostButton>
            </div>
            <PrimaryButton onClick={() => router.push(`/publish/${id}`)} disabled={!!busy}>
              Looks good! Post it
            </PrimaryButton>
          </>
        )}
      </div>

      {sheet && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink/30" onClick={() => setSheet(false)}>
          <div className="pop mx-auto w-full max-w-[430px] rounded-t-[28px] bg-white px-5 pb-8 pt-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-[22px] font-bold">Want to change something?</h2>
            <p className="mt-1 text-[14px] text-muted">Say it or type it. No timeline editing needed.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {QUICK.map((q) => (
                <button key={q} onClick={() => revise(q)} className="rounded-full bg-lav px-3 py-2 text-[14px] font-semibold">
                  {q}
                </button>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                revise(instruction);
              }}
            >
              <input
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                placeholder="E.g. 4 slides is enough"
                className="h-12 flex-1 rounded-full border-[1.5px] border-line px-4 text-[16px] outline-none focus:border-primary"
              />
              <button type="submit" className="btn-primary h-12 rounded-full px-5 font-bold text-white">OK</button>
            </form>
            <button
              onPointerDown={startRec}
              onPointerUp={stopRec}
              onContextMenu={(e) => e.preventDefault()}
              className={`btn-primary font-display mt-3 flex h-[56px] w-full touch-none select-none items-center justify-center gap-2 rounded-full text-[17px] font-bold text-white ${recording ? "recording" : ""}`}
            >
              <MicIcon /> {recording ? "Listening…" : "Hold and speak"}
            </button>
          </div>
        </div>
      )}
      <Toast text={toast} />
    </Screen>
  );
}
