"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Posts the mock ORDER_PROCESSED webhook (body built server-side by mockPaidEvent).
export function PayButton({ event, label }: { event: string; label: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "paying" | "paid" | "error">("idle");

  async function pay() {
    setState("paying");
    try {
      const res = await fetch("/api/payments/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-mock-signature": "mock" },
        body: event,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; status?: string };
      if (!res.ok || !data.ok || data.status !== "paid") throw new Error();
      setState("paid");
      router.refresh();
    } catch {
      setState("error");
    }
  }

  if (state === "paid") {
    return (
      <p className="flex h-14 items-center justify-center rounded-full bg-mint font-semibold text-ok" role="status">
        Paid ✓
      </p>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={pay}
        disabled={state === "paying"}
        className="flex h-14 w-full items-center justify-center rounded-full bg-ink font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {state === "paying" ? "Paying…" : label}
      </button>
      {state === "error" ? (
        <p className="mt-3 text-center text-sm text-muted" role="alert">
          Payment didn&apos;t go through. Try again.
        </p>
      ) : null}
    </>
  );
}
