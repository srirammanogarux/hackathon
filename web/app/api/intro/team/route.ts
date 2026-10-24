import { teamRun, hasAgenticOrg } from "@/lib/agenticorg.mjs";
import { json } from "@/lib/server";

export const maxDuration = 120;

// Body: { profile } -> { team: { via, ms, runIds, angle, script, shots } | null }
// Scout -> Writer -> Editor on AgenticOrg, run in the background while the fast writer fills the screen.
export async function POST(req: Request) {
  const { profile } = await req.json().catch(() => ({}));
  if (!profile || !hasAgenticOrg()) return json({ team: null });
  const t0 = Date.now();
  try {
    const r: any = await (teamRun as any)(profile, { timeoutMs: 45_000 });
    return json({
      team: { via: !!r.viaAgenticOrg, ms: r.ms ?? {}, runIds: r.runIds ?? {}, angle: r.angle?.title ?? r.angle?.hook ?? (typeof r.angle === "string" ? r.angle : null), script: r.script ?? [], shots: r.shots ?? [], total: Date.now() - t0 },
    });
  } catch (e) {
    console.error("[intro] team", (e as Error).message);
    return json({ team: null });
  }
}
