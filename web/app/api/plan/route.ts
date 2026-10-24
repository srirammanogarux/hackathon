import { planWeek } from "@/lib/brain/brain.mjs";
import { json, errorJson } from "@/lib/server";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { profile } = await req.json();
    return json({ plan: await planWeek(profile) });
  } catch (e) {
    return errorJson(e);
  }
}
