import path from "node:path";
import { stat, readFile } from "node:fs/promises";
import { has, appBase, json, errorJson } from "@/lib/server";
import { MEDIA_DIR } from "@/lib/mediaStore";

const V = process.env.GRAPH_API_VERSION ?? "v26.0";
const G = `https://graph.facebook.com/${V}`;

async function graph(method: string, p: string, params: Record<string, string | undefined> = {}) {
  const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined)) as Record<string, string>;
  const qs = new URLSearchParams({ ...clean, access_token: process.env.IG_ACCESS_TOKEN! });
  const res = await fetch(method === "GET" ? `${G}${p}?${qs}` : `${G}${p}`, method === "GET" ? {} : { method, body: qs });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || j.error) throw new Error(`IG ${p}: ${j.error?.error_user_msg ?? j.error?.message ?? res.status}`);
  return j;
}

async function waitFinished(id: string) {
  for (let i = 0; i < 40; i++) {
    const { status_code } = await graph("GET", `/${id}`, { fields: "status_code" });
    if (status_code === "FINISHED") return;
    if (status_code === "ERROR" || status_code === "EXPIRED") throw new Error(`container ${status_code}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("container not ready in time");
}

export const maxDuration = 300;

// Body: { kind: "carousel"|"reel", images: string[] (app-relative URLs), reel: string, caption, ai }
// Publishes to the IG account in IG_USER_ID (the team's demo account) with is_ai_generated when AI voice/avatar was used.
export async function POST(req: Request) {
  if (!has.instagram()) return json({ ok: false, reason: "not_connected" });
  try {
    const { kind, images = [], reel, caption, ai } = await req.json();
    const base = (process.env.PUBLIC_MEDIA_BASE_URL || appBase(req)).replace(/\/$/, "");
    const abs = (u: string) => (/^https?:/.test(u) ? u : `${base}${u}`);
    const uid = process.env.IG_USER_ID!;
    const aiFlag = ai ? "true" : undefined;
    let creationId: string;
    if (kind === "reel" && reel) {
      const local = reel.startsWith("/api/media/") ? path.join(MEDIA_DIR, path.basename(reel)) : null;
      if (local && /^http:\/\/localhost/.test(base)) {
        // Localhost isn't reachable by Meta: resumable upload of the bytes instead.
        const { id } = await graph("POST", `/${uid}/media`, { media_type: "REELS", caption, upload_type: "resumable", is_ai_generated: aiFlag, share_to_feed: "true" });
        const bytes = await readFile(local);
        const up = await fetch(`https://rupload.facebook.com/ig-api-upload/${V}/${id}`, {
          method: "POST",
          headers: { Authorization: `OAuth ${process.env.IG_ACCESS_TOKEN}`, offset: "0", file_size: String((await stat(local)).size) },
          body: bytes,
        });
        if (!up.ok) throw new Error(`rupload ${up.status}`);
        creationId = id;
      } else {
        creationId = (await graph("POST", `/${uid}/media`, { media_type: "REELS", video_url: abs(reel), caption, is_ai_generated: aiFlag, share_to_feed: "true" })).id;
      }
    } else if (images.length >= 2) {
      const kids: string[] = [];
      for (const img of images.slice(0, 10)) {
        const { id } = await graph("POST", `/${uid}/media`, { image_url: abs(img), is_carousel_item: "true" });
        await waitFinished(id);
        kids.push(id);
      }
      creationId = (await graph("POST", `/${uid}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption, is_ai_generated: aiFlag })).id;
    } else {
      creationId = (await graph("POST", `/${uid}/media`, { image_url: abs(images[0]), caption, is_ai_generated: aiFlag })).id;
    }
    await waitFinished(creationId);
    const { id } = await graph("POST", `/${uid}/media_publish`, { creation_id: creationId });
    const { permalink } = await graph("GET", `/${id}`, { fields: "permalink" }).catch(() => ({ permalink: null }));
    return json({ ok: true, id, permalink });
  } catch (e) {
    return errorJson(e);
  }
}
