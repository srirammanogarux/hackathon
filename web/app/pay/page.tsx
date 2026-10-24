"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Screen, Orb, PrimaryButton, Check, Spinner, Squiggle } from "@/components/ui";
import { load, save, api, sleep } from "@/lib/store";

const PERKS = ["5 posts + daily stories every week", "Reels in your voice, 5 languages", "Auto post to Instagram, after your yes", "Guard safety check on every post"];

export default function Pay() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "paying" | "checking" | "paid" | "failed">("idle");
  const [next, setNext] = useState<string | null>(null);
  const [left, setLeft] = useState(4);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const n = q.get("next") ?? load<string | null>("payNext", null);
    setNext(n);
    const plan = load<any>("plan", null);
    setLeft(Math.max(0, (plan?.posts?.length ?? 5) - load<string[]>("published", []).length));
    const orderId = q.get("order_id") ?? (q.has("back") ? load<string | null>("orderId", null) : null);
    if (orderId) verify(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function verify(orderId: string) {
    setState("checking");
    for (let i = 0; i < 5; i++) {
      const r = await api(`/api/pay/status?order_id=${encodeURIComponent(orderId)}`).catch(() => null);
      if (r?.paid) {
        save("paid", true);
        save("paidAt", new Date().toISOString());
        setState("paid");
        return;
      }
      if (r && ["FAILED", "CANCELLED"].includes(r.status)) break;
      await sleep(2000);
    }
    setState("failed");
  }

  async function pay() {
    setState("paying");
    save("payNext", next);
    try {
      const r = await api("/api/pay/create", { plan: "trial", name: load<any>("profile", null)?.name ?? "Reels Magic" });
      save("orderId", r.order_id);
      if (r.redirect_url) {
        window.location.href = r.redirect_url;
        return;
      }
      await sleep(1200); // mock checkout
      await verify(r.order_id);
    } catch {
      setState("failed");
    }
  }

  if (state === "paid") {
    return (
      <Screen className="items-center justify-center gap-4 px-8 text-center" style={{ backgroundImage: "radial-gradient(ellipse 100% 55% at 50% 30%, #8C7DFF40 0%, #8C7DFF00 100%)" }}>
        <Orb size={110} face="happy" className="pop" />
        <h1 className="font-display text-[34px] font-extrabold leading-[38px] tracking-[-0.03em]">Payment done!</h1>
        <Squiggle width={100} />
        <p className="text-[15px] leading-[22px] text-muted">Your 7-day trial has started. We'll remind you 2 days before we charge.</p>
        <PrimaryButton onClick={() => router.push(next ? `/make/${next}` : "/plan")} className="mt-6">Next post</PrimaryButton>
      </Screen>
    );
  }

  return (
    <Screen style={{ backgroundImage: "radial-gradient(ellipse 110% 50% at 50% 0%, #8C7DFF38 0%, #8C7DFF00 100%)" }}>
      <div className="flex justify-end px-5">
        <Link href="/plan" aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full bg-chip">
          <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden><path d="M18 6 6 18M6 6l12 12" fill="none" stroke="#17142B" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </Link>
      </div>
      <div className="flex flex-col items-center gap-3 px-7 pt-2 text-center">
        <Orb size={80} />
        <h1 className="font-display text-[30px] font-extrabold leading-[34px] tracking-[-0.03em]">
          Unlock your week. {left} more posts to go.
        </h1>
      </div>

      <div className="mx-5 mt-[22px] flex flex-col gap-2.5 rounded-3xl bg-mist p-4">
        {PERKS.map((t) => (
          <div key={t} className="flex items-center gap-2.5 text-[15px] leading-[18px]">
            <Check /> {t}
          </div>
        ))}
      </div>

      <div className="mx-5 mt-3 flex items-center justify-between rounded-3xl border-[2.5px] border-primary bg-lav px-[18px] py-4">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[18px] font-extrabold leading-[22px]">₹1 for 7 days</span>
          <span className="text-[13px] leading-4 text-muted">then ₹299/month · cancel anytime</span>
        </div>
        <span className="shrink-0 rounded-full bg-primary px-2.5 py-[5px] text-[12px] font-bold text-white">UPI</span>
      </div>

      {state === "failed" && (
        <div className="mx-5 mt-3 rounded-2xl bg-blush px-4 py-3 text-[14px] leading-5">
          Payment didn't go through. Please try again. Your post is safe.
          <Link href="/plan" className="ml-1 font-semibold text-primary">Maybe tomorrow</Link>
        </div>
      )}

      <div className="flex-1" />
      <div className="flex flex-col items-center gap-2.5 px-5 pb-[30px] pt-6">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1F9D57" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" />
          </svg>
          <span className="text-[13px] font-medium leading-4 text-[#1F7A47]">We'll remind you 2 days before we charge</span>
        </div>
        <PrimaryButton onClick={pay} disabled={state === "paying" || state === "checking"}>
          {state === "paying" || state === "checking" ? <Spinner color="#FFFFFF" /> : "Unlock for ₹1"}
        </PrimaryButton>
        <span className="text-[12px] leading-4 text-faint">Secured by Pine Labs</span>
      </div>
    </Screen>
  );
}
