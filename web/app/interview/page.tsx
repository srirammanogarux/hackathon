"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { nextQuestion } from "@/lib/brain/questions.mjs";
import { Screen, Orb, PrimaryButton, BackButton, Icon, Check, MicIcon, Toast } from "@/components/ui";
import { UI_QUESTIONS, optionBg } from "@/lib/questions";
import { contentLang, type UiLang } from "@/lib/lang";
import { load, save, api } from "@/lib/store";

type Answer = { id: string; q: string; label?: string; voice?: string; patch?: Record<string, unknown> };
const MAX_Q = 7;

function merge(answers: Answer[], lang: string) {
  const p: Record<string, any> = { language_in: lang, languages_out: [lang] };
  for (const a of answers) Object.assign(p, a.patch ?? {});
  return p;
}

export default function Interview() {
  const router = useRouter();
  const [lang, setLang] = useState<UiLang>("hinglish");
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    setLang(load<UiLang>("lang", "hinglish"));
    setAnswers(load<Answer[]>("answers", []) instanceof Array ? load<Answer[]>("answers", []) : []);
  }, []);

  const cl = contentLang(lang);
  const profileSoFar = merge(answers, cl);
  const asked = answers.map((a) => a.id);
  const nq = (nextQuestion as any)(profileSoFar, { lang: lang === "hinglish" ? "hinglish" : cl, asked });
  const done = nq.done || answers.length >= MAX_Q;
  const q = nq.question;
  const ui = q ? UI_QUESTIONS[q.id] : null;
  const progress = Math.min(1, answers.length / MAX_Q);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  }

  function answer(a: Answer) {
    const next = [...answers, a];
    setAnswers(next);
    save("answers", next);
    setPicked(null);
  }

  function pick(i: number) {
    if (!q || !ui) return;
    setPicked(i);
    const o = ui.options[i];
    setTimeout(() => answer({ id: q.id, q: q.text_en, label: o.label, patch: o.patch }), 260);
  }

  async function startRec() {
    if (recording || busy) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunks.current = [];
      mr.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: mr.mimeType || "audio/webm" });
        if (blob.size < 2000) return flash("Hold a little longer, then speak");
        await transcribe(blob);
      };
      mr.start();
      rec.current = mr;
      setRecording(true);
    } catch {
      flash("No mic found. Just tap a card!");
    }
  }
  function stopRec() {
    if (!rec.current) return;
    rec.current.stop();
    rec.current = null;
    setRecording(false);
  }

  async function transcribe(blob: Blob) {
    if (!q) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("audio", blob, "answer.webm");
      fd.append("lang", cl);
      const r = await fetch("/api/transcribe", { method: "POST", body: fd }).then((r) => r.json());
      if (r.text) {
        flash(`You said: ${r.text.slice(0, 60)}`);
        answer({ id: q.id, q: q.text_en, voice: r.text });
      } else {
        flash("Voice saved. Tap a card too!");
        answer({ id: q.id, q: q.text_en, voice: "" });
      }
    } catch {
      flash("Couldn't catch that. Tap a card instead.");
    } finally {
      setBusy(false);
    }
  }

  async function finish() {
    setBusy(true);
    const transcript = answers
      .map((a) => `Q: ${a.q}\nA: ${[a.label, a.voice].filter(Boolean).join(". ")}`)
      .join("\n\n");
    try {
      const { profile } = await api("/api/interview", { transcript, profileSoFar, lang: cl });
      save("profile", profile);
      save("plan", null);
      router.push("/profile");
    } catch (e) {
      flash("Smiley is taking a moment. Please try again.");
      setBusy(false);
    }
  }

  useEffect(() => {
    if (done && answers.length && !busy) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  function back() {
    if (!answers.length) return router.push("/");
    const prev = answers.slice(0, -1);
    setAnswers(prev);
    save("answers", prev);
  }

  if (done || !ui || !q) {
    return (
      <Screen className="items-center justify-center gap-5 px-8 text-center">
        <Orb size={110} face="focus" className="float" />
        <h1 className="font-display text-[28px] font-extrabold leading-8 tracking-[-0.03em]">Got it! Building your profile…</h1>
        <p className="text-[15px] leading-[22px] text-muted">Your time, your space, your rules. All noted.</p>
        <Toast text={toast} />
      </Screen>
    );
  }

  const nativeSub = lang !== "hinglish" && lang !== "en" ? q.text : null;

  return (
    <Screen>
      <div className="flex items-center gap-3 px-5 pt-1">
        <BackButton onClick={back} />
        <div className="flex h-2 flex-1 rounded bg-chip" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
          <div className="rounded bg-gradient-to-r from-primary-2 to-primary transition-all duration-500" style={{ width: `${Math.max(8, progress * 100)}%` }} />
        </div>
        <button
          onClick={() => answer({ id: q.id, q: q.text_en, label: "skip" })}
          className="shrink-0 px-1 text-[14px] font-semibold text-muted"
        >
          Skip
        </button>
      </div>

      <div key={q.id} className="pop flex items-start gap-3 px-5 pt-8">
        <Orb size={64} />
        <div className="flex flex-1 flex-col gap-1.5 rounded-[6px_22px_22px_22px] bg-chip px-4 py-3.5">
          <h1 className="font-display text-[22px] font-bold leading-[27px] tracking-[-0.02em] text-ink">{ui.title}</h1>
          <p className="text-[14px] leading-5 text-muted">{nativeSub ?? ui.sub}</p>
        </div>
      </div>

      <div key={`${q.id}-opts`} className="grid grid-cols-2 gap-2.5 px-5 pt-7">
        {ui.options.map((o, i) => {
          const on = picked === i;
          return (
            <button
              key={o.label}
              onClick={() => pick(i)}
              className="pop flex flex-col gap-2.5 rounded-3xl p-4 text-left transition active:scale-[0.97]"
              style={{ background: optionBg(i), border: on ? "2.5px solid #6A58F5" : "2.5px solid transparent", animationDelay: `${i * 50}ms` }}
            >
              <span className="flex justify-between">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <Icon name={o.icon} />
                </span>
                {on && <Check color="#FFFFFF" bg="#6A58F5" size={24} />}
              </span>
              <span className="font-display text-[17px] font-bold leading-[22px] text-ink">{o.label}</span>
            </button>
          );
        })}
      </div>

      {answers.length >= 3 && (
        <button onClick={finish} disabled={busy} className="mx-auto mt-4 text-[14px] font-semibold text-primary underline-offset-4 hover:underline">
          That's enough, make my plan →
        </button>
      )}

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-2.5 px-5 pb-9 pt-6">
        <p className="text-[14px] leading-[18px] text-muted">{busy ? "Smiley is listening…" : recording ? "Speak… we'll send it when you let go" : "Or just say it"}</p>
        <button
          onPointerDown={startRec}
          onPointerUp={stopRec}
          onPointerLeave={() => recording && stopRec()}
          onContextMenu={(e) => e.preventDefault()}
          disabled={busy}
          className={`btn-primary font-display flex h-[60px] w-full select-none items-center justify-center gap-2.5 rounded-full text-[18px] font-bold text-white touch-none ${recording ? "recording" : ""}`}
        >
          <MicIcon />
          {recording ? "Listening…" : "Hold and speak"}
        </button>
      </div>
      <Toast text={toast} />
    </Screen>
  );
}
