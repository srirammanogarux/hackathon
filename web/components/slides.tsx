"use client";
import type { Slide } from "@/lib/slides";

// Client-side mirror of spikes/media slideHtml (1080x1350), drawn at any width with container units.
export function SlideCard({ slide, index, total, photo, handle = "@saathi", className = "" }: { slide: Slide; index: number; total: number; photo?: string; handle?: string; className?: string }) {
  const cover = index === 0;
  const dark = cover || !!photo;
  return (
    <div
      className={`relative flex aspect-[4/5] flex-col overflow-hidden [container-type:inline-size] ${className}`}
      style={{ background: cover ? "#6A58F5" : "#FBF8F3", color: dark ? "#fff" : "#1d1d1f" }}
    >
      {photo && (
        <>
          <img src={photo} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, #17142B66 0%, #17142B33 40%, #17142BCC 100%)" }} />
        </>
      )}
      <div className="relative flex flex-1 flex-col" style={{ padding: "8.9cqw 8.1cqw 6.7cqw" }}>
        <div className="flex items-center justify-between font-semibold opacity-80" style={{ fontSize: "2.8cqw" }}>
          <span>{handle}</span>
          <span className="rounded-full text-white" style={{ background: dark ? "rgba(255,255,255,.18)" : "#6A58F5", padding: "0.7cqw 2cqw" }}>
            {index + 1}/{total}
          </span>
        </div>
        <div className={`flex flex-1 flex-col ${photo ? "justify-end" : "justify-center"}`} style={{ gap: "4cqw" }}>
          <h3 className="font-extrabold [text-wrap:balance]" style={{ fontSize: cover ? "8.4cqw" : "6.8cqw", lineHeight: 1.3 }}>{slide.headline}</h3>
          <div className="rounded" style={{ width: "11cqw", height: "1.1cqw", background: dark ? "#fff" : "#6A58F5" }} />
          {slide.body && <p className="font-medium [text-wrap:pretty]" style={{ fontSize: "4cqw", lineHeight: 1.55, opacity: 0.9 }}>{slide.body}</p>}
        </div>
        <div className="flex items-center justify-between font-bold" style={{ fontSize: "2.9cqw" }}>
          <span>{cover ? "Swipe →" : handle}</span>
          <span className="flex" style={{ gap: "1.1cqw" }}>
            {Array.from({ length: total }).map((_, i) => (
              <span key={i} className="rounded-full" style={{ height: "1.3cqw", width: i === index ? "3.7cqw" : "1.3cqw", background: i === index ? (dark ? "#fff" : "#6A58F5") : dark ? "rgba(255,255,255,.35)" : "rgba(0,0,0,.15)" }} />
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}
