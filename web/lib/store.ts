"use client";
// Client state lives in localStorage so the flow survives reloads and redirects (Pine Labs).
const K = "saathi:";

export function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(K + key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(K + key, JSON.stringify(value));
  } catch (e) {
    console.warn("localStorage full?", e);
  }
}

export type Made = {
  post: any;
  original?: any; // flagged draft, kept for the side-by-side
  verdict?: any;
  agenticorg?: any;
  slides?: string[] | null; // server-rendered JPEG URLs
  files?: string[] | null;
  reel?: string;
  reelSource?: string;
  photos?: string[];
  rewritten?: boolean;
};

export const getMade = (id: string): Made | null => load<Record<string, Made>>("made", {})[id] ?? null;
export function setMade(id: string, m: Made) {
  const all = load<Record<string, Made>>("made", {});
  all[id] = m;
  save("made", all);
}

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) throw new Error(data?.error ?? `HTTP ${res.status}`);
  return data;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Deterministic "fit %" per plan item (plan has no score; this keeps the badge stable).
export function fitOf(item: { id?: string; title_en?: string } | null, i = 0) {
  const s = `${item?.id ?? ""}${item?.title_en ?? ""}`;
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997;
  return 98 - (i % 3) - (h % 5);
}
