import path from "node:path";
import { writeFile } from "node:fs/promises";
import { MEDIA_DIR } from "@/lib/mediaStore";
import { json, errorJson } from "@/lib/server";

// Multipart: video (Blob), idx. Saves one recorded shot; returns its file name for /api/intro/build.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const video = form.get("video");
    const idx = String(form.get("idx") ?? "0").replace(/\D/g, "");
    if (!(video instanceof Blob) || video.size < 1000) return json({ file: null });
    const ext = /mp4/.test(video.type) ? "mp4" : "webm";
    const name = `shot-${Date.now()}-${idx}.${ext}`;
    await writeFile(path.join(MEDIA_DIR, name), Buffer.from(await video.arrayBuffer()));
    return json({ file: name });
  } catch (e) {
    return errorJson(e);
  }
}
