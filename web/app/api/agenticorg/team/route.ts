import { teamRun } from "@/lib/agenticorg.mjs";

export const maxDuration = 120;

// Body: creator profile {name, profession, city, what_they_make, audience, never[], tone, language}.
// Returns {ok, angles, angle, script, shots, runIds, ms, viaAgenticOrg, errors}.
export async function POST(req: Request) {
  const profile = await req.json().catch(() => ({}));
  return Response.json(await teamRun(profile));
}
