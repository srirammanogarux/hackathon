// Server-only helpers shared by the API routes.
import { readFileSync } from "node:fs";
import path from "node:path";

export const has = {
  claude: () => !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) && process.env.BRAIN_MOCK !== "1",
  eleven: () => !!process.env.ELEVENLABS_API_KEY,
  pine: () => !!(process.env.PINELABS_CLIENT_ID && process.env.PINELABS_CLIENT_SECRET),
  agenticorg: () => !!process.env.AGENTICORG_API_KEY,
  instagram: () => !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN),
};

export type Persona = "sunita" | "arjun";

// Mock persona: dentists and Kannada speakers get Arjun's fixtures, everyone else Sunita's.
export function personaOf(x: { language_in?: string | null; profession?: string | null; lang?: string } | null): Persona {
  const lang = x?.language_in ?? x?.lang;
  if (/dent|clinic|doctor/i.test(x?.profession ?? "") || lang === "kn") return "arjun";
  return "sunita";
}

export function fixture(name: string) {
  return JSON.parse(readFileSync(path.join(process.cwd(), "lib", "fixtures", name), "utf8"));
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export function errorJson(e: unknown, status = 500) {
  const message = e instanceof Error ? e.message : String(e);
  console.error("[api]", message);
  return Response.json({ error: message }, { status });
}

export function appBase(req: Request) {
  if (process.env.APP_BASE_URL) return process.env.APP_BASE_URL.replace(/\/$/, "");
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}`;
}
