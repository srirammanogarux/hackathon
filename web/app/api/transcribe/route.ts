import { has, json, errorJson } from "@/lib/server";

const ISO3: Record<string, string> = { ta: "tam", kn: "kan", te: "tel", hi: "hin", en: "eng" };

// Multipart: audio (Blob), lang. ElevenLabs Speech-to-Text when keyed; otherwise {text: null}.
export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");
    const lang = String(form.get("lang") ?? "");
    if (!has.eleven() || !(audio instanceof Blob)) return json({ text: null, source: "none" });
    const body = new FormData();
    body.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v1");
    body.append("file", audio, "answer.webm");
    if (ISO3[lang]) body.append("language_code", ISO3[lang]);
    const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY! },
      body,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`ElevenLabs STT ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
    return json({ text: data.text ?? "", source: "elevenlabs" });
  } catch (e) {
    return errorJson(e);
  }
}
