"use client";
import Link from "next/link";
import { Orb, Icon } from "@/components/ui";

export function BottomNav() {
  const item = (label: string, icon: string, on = false, href = "#") => (
    <Link href={href} className="flex flex-col items-center gap-[3px]">
      <Icon name={icon} color={on ? "#6A58F5" : "#9A97AD"} />
      <span className={`text-[11px] leading-[14px] ${on ? "font-semibold text-primary" : "font-medium text-faint"}`}>{label}</span>
    </Link>
  );
  return (
    <nav className="fixed inset-x-0 bottom-7 z-30 mx-auto flex h-16 w-[calc(100%-40px)] max-w-[390px] items-center justify-around rounded-full bg-white shadow-[0_10px_30px_#17142B1A]">
      {item("Plan", "calendar", true, "/plan")}
      {item("Posts", "image", false, "/plan")}
      <Link href="/profile" aria-label="Smiley">
        <Orb size={52} />
      </Link>
      {item("Growth", "trend")}
      {item("Me", "user", false, "/profile")}
    </nav>
  );
}
