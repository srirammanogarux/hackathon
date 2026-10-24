import { writeScript } from "@/lib/intro";
import { teamRun, hasAgenticOrg } from "@/lib/agenticorg.mjs";
import { json, errorJson } from "@/lib/server";

export const maxDuration = 120;

// Body: { texts, never, vibe, change?: "shorter"|"phone"|string, lines?, profile? } -> { lines[6], source, team? }
// First draft: Scout -> Writer -> Editor on AgenticOrg (teamRun). Changes and failures: Gemini/Claude/mock writer.
export async function POST(req: Request) {
  try {
    const b = await req.json();
    if (!b.change && !b.fast && b.profile && hasAgenticOrg()) {
      const t0 = Date.now();
      try {
        const r: any = await Promise.race([
          (teamRun as any)(b.profile, { timeoutMs: 45_000 }),
          new Promise((_, rej) => setTimeout(() => rej(new Error("teamRun timeout")), 70_000)),
        ]);
        const lines = (r?.script ?? []).map((l: unknown) => String(l).trim()).filter(Boolean);
        if (lines.length >= 6) {
          return json({
            lines: lines.slice(0, 6),
            source: "agenticorg",
            team: { via: !!r.viaAgenticOrg, ms: r.ms ?? {}, runIds: r.runIds ?? {}, angle: r.angle?.title ?? r.angle?.hook ?? (typeof r.angle === "string" ? r.angle : null), shots: r.shots ?? [], total: Date.now() - t0 },
          });
        }
        console.error("[intro] teamRun returned", lines.length, "lines", r?.errors);
      } catch (e) {
        console.error("[intro] teamRun failed", (e as Error).message);
      }
    }
    return json(await writeScript({ texts: b.texts ?? [], never: b.never ?? [], vibe: b.vibe ?? "warm", change: b.change, lines: b.lines }));
  } catch (e) {
    return errorJson(e);
  }
}
