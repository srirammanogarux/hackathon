import path from "node:path";
import { transcribeBlob } from "@/lib/funnel";
import { json, errorJson } from "@/lib/server";

// Multipart: audio (Blob), idx. Saves her answer (also used for the voice clone) and returns STT text if keyed.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const idx = String(form.get("idx") ?? "0").replace(/\D/g, "");
    if (!(audio instanceof Blob)) return json({ text: null, file: null, source: "none" });
    const { text, file } = await transcribeBlob(audio, `talk-${Date.now()}-${idx}`);
    return json({ text, file: path.basename(file), source: text ? "elevenlabs" : "none" });
  } catch (e) {
    return errorJson(e);
  }
}
