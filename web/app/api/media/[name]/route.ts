import { readFile } from "node:fs/promises";
import path from "node:path";
import { MEDIA_DIR } from "@/lib/mediaStore";

const TYPES: Record<string, string> = { ".jpg": "image/jpeg", ".mp4": "video/mp4", ".mp3": "audio/mpeg" };

export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const name = path.basename((await params).name);
  try {
    const buf = await readFile(path.join(MEDIA_DIR, name));
    return new Response(buf, { headers: { "content-type": TYPES[path.extname(name)] ?? "application/octet-stream", "cache-control": "public, max-age=86400" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
