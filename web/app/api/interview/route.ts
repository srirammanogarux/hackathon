import { interview } from "@/lib/brain/brain.mjs";
import { has, personaOf, fixture, json, errorJson } from "@/lib/server";

// Body: { transcript, profileSoFar, lang }. profileSoFar comes from the tapped option cards.
export async function POST(req: Request) {
  try {
    const { transcript = "", profileSoFar = {}, lang = "hi" } = await req.json();
    if (has.claude() && transcript.trim()) {
      const profile = await interview(transcript, profileSoFar);
      return json({ profile, source: "claude" });
    }
    // Mock: persona fixture, with the creator's own card answers on top.
    const base = fixture(`mock/${personaOf({ ...profileSoFar, lang })}.profile.json`);
    const keep = Object.fromEntries(Object.entries(profileSoFar).filter(([, v]) => v !== null && v !== undefined));
    return json({ profile: { ...base, ...keep, boundaries: base.boundaries, name: base.name }, source: "mock" });
  } catch (e) {
    return errorJson(e);
  }
}
