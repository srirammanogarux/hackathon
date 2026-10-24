import type { Metadata } from "next";
import { V2Prototype } from "@/components/v2/prototype";

export const metadata: Metadata = {
  title: "Reels Magic V2 · after the first Reel",
};

type Search = { embed?: string; step?: string; statusbar?: string; autoplay?: string };

export default async function V2Page({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const n = Number.parseInt(sp.step ?? "1", 10);
  const step = Number.isFinite(n) ? Math.min(6, Math.max(1, n)) - 1 : 0;
  return (
    <V2Prototype
      embed={sp.embed === "1"}
      initialStep={step}
      hideStatusBar={sp.statusbar === "0"}
      startAutoplay={sp.autoplay === "1"}
    />
  );
}
