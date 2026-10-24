// The five brain functions. Each is one structured Claude call (or a fixture in
// mock mode) plus deterministic checks. No state: callers pass everything in.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { callStructured } from "./llm.mjs";
import { CreatorProfile, WeekPlan, Post, BoundaryVerdict, Revision } from "./schemas.mjs";
import { ruleCheck, isDental, NDC_RULES } from "./rules.mjs";
export { nextQuestion, missingFields } from "./questions.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const MOCK_DIR = path.join(here, "..", "fixtures", "mock");

// Mock mode picks a persona fixture: Tamil -> lakshmi, everything else -> arjun.
const personaOf = (profileOrText) =>
  typeof profileOrText === "string"
    ? /[஀-௿]/.test(profileOrText) ? "lakshmi" : "arjun"
    : profileOrText?.language_in === "ta" ? "lakshmi" : "arjun";
const loadMock = (persona, fn) => JSON.parse(readFileSync(path.join(MOCK_DIR, `${persona}.${fn}.json`), "utf8"));

const SYSTEM = `You are the brain of a mobile AI content team for Indian small businesses and first-time creators on Instagram.
Users speak Hindi, Kannada, Tamil, Telugu or English, often mixed (e.g. Kannada with English words).

Language rules:
- Write every language in its native script: Kannada ಕನ್ನಡ, Tamil தமிழ், Hindi देवनागरी, Telugu తెలుగు. Never romanise.
- Use the spoken register real people use on Instagram (colloquial Tamil like "பண்ணுங்க", Bengaluru Kannada that keeps everyday English loanwords such as "clinic", "reel", "brush" in Kannada script or as-is). Not textbook or newspaper language.
- Short sentences. Common words. Readable aloud by a TTS voice.
- Fields ending in _en are short plain-English mirrors for the team dashboard.

Fit rules (the product's core promise: content that fits this person's life):
- camera_level ladder: 0 = no person visible (objects, space, text only); 1 = hands and objects; 2 = their voice-over allowed; 3 = an AI avatar generated from one photo may appear (they never film their own face); 4 = they film their face.
- Only propose what this person can actually do with their time, shoot slots, places, phone, light, tripod, internet and budget.
- Respect every boundary in the profile (personal, cultural, professional). Professional rules are legal limits, not style preferences.
- Never invent facts about the person (prices, awards, years of experience, patient stories).`;

const NDC_TEXT = NDC_RULES.map((r) => `- ${r.id}: ${r.rule}`).join("\n") +
  "\n- Educational, factual oral-health content is allowed. Neutral information (clinic name, hours, location) is allowed; urging people to book is not.";

const j = (o) => JSON.stringify(o, null, 1);

// ---------------------------------------------------------------- 1. interview
/**
 * interview(transcript, profileSoFar?) -> CreatorProfile
 * transcript: raw ASR text of the spoken onboarding (Q/A turns, any of 5 languages, code-mixed OK).
 */
export async function interview(transcript, profileSoFar = null) {
  return callStructured({
    name: "interview",
    schema: CreatorProfile,
    effort: "low",
    system: SYSTEM,
    user: `Extract a CreatorProfile from this spoken onboarding transcript.
${profileSoFar ? `Merge into this profile so far (newer answers win):\n${j(profileSoFar)}\n` : ""}
Rules:
- Use null or [] for anything not said. Do not guess.
- language_in = the language they mostly speak in. languages_out = what they asked for; if they didn't say, use language_in (plus "en" only if they code-mix heavily AND want a broad audience).
- camera_level = the HIGHEST rung they are comfortable with (see ladder). "No face" but fine with hands and own voice = 2.
- time_per_week in minutes. shoot_slots = concrete free windows they mentioned.
- Descriptive fields (what_they_share, places, boundaries, inspirations, notes) in plain English.
- If they are a dentist, add to boundaries.professional: "NDC advisory 14 Oct 2026: no testimonials, before/after photos, superiority claims, soliciting patients, or recording procedures".

Transcript:
"""
${transcript}
"""`,
    mock: () => loadMock(personaOf(transcript), "profile"),
  });
}

// ---------------------------------------------------------------- 2. planWeek
/**
 * planWeek(profile, inspirations?) -> WeekPlan (+ ideas_considered computed)
 * inspirations: optional extra trend notes / reference post descriptions (strings).
 */
export async function planWeek(profile, inspirations = []) {
  const plan = await callStructured({
    name: "planWeek",
    schema: WeekPlan,
    effort: "medium",
    system: SYSTEM,
    user: `Plan this creator's next week on Instagram.

Profile:
${j(profile)}
${inspirations.length ? `\nInspirations / trends to borrow from (adapt, never copy):\n${inspirations.map((s) => `- ${s}`).join("\n")}\n` : ""}
${isDental(profile) ? `\nProfessional rules that apply (National Dental Commission):\n${NDC_TEXT}\n` : ""}
Output:
- posts: exactly 5. Mix formats: at least 1 reel, 1 carousel, 1 single_image (reels may be made from object/hand shots, voice-over, text or the AI avatar, as the camera_level allows).
  - title, hook in languages_out[0]. why_this_works: ONE line in language_in teaching a reusable content principle (e.g. why a question hook stops the scroll).
  - shot_list only when needs_filming. Every shot must be filmable in one of profile.places, with their phone and gear, inside one shoot slot. Keep total seconds small. Tips for an old phone / no tripod where relevant (lean phone on a jar, film near a window).
  - effort_minutes realistic; the 5 posts + 7 stories together must fit time_per_week.
  - scheduled_day and shoot_slot must match their shoot_slots. Spread posts across the week.
- stories: exactly 7, one per day mon..sun, each doable in under 2 minutes (polls, questions, quick tips, a photo of today's work). Text in languages_out[0], under 15 words.
- filtered_out: exactly 12 popular generic ideas for this niche that a normal AI tool would suggest, each rejected by the ONE constraint that kills it for this person (camera, time, place, tech, language, boundary, professional_rule, budget, goal_fit). reason names the concrete constraint, e.g. "needs your face on camera; you chose voice and hands only".
- ideas_considered: 17.`,
    mock: () => loadMock(personaOf(profile), "plan"),
  });
  plan.ideas_considered = plan.posts.length + plan.filtered_out.length;
  return plan;
}

// ---------------------------------------------------------------- 3. makePost
/** makePost(planItem, profile) -> Post */
export async function makePost(planItem, profile) {
  return callStructured({
    name: "makePost",
    schema: Post,
    effort: "medium",
    system: SYSTEM,
    user: `Write the finished post for this plan item.

Plan item:
${j(planItem)}

Profile:
${j(profile)}
${isDental(profile) ? `\nProfessional rules (must pass):\n${NDC_TEXT}\n` : ""}
Rules:
- Fill only the block for plan item's format (carousel | reel | single_image); set the other two to null.
- carousel: 5-7 slides. Slide 1 = the hook. Last slide = soft call to action (save / share / follow). Headline <= 8 words, body <= 30 words. Native script in languages_out[0]; if languages_out has "en" as a second language you may add a short English line in the body only where it helps.
- reel: 15-30 s, 5-8 timed lines, no gaps or overlaps, t_end of last line = duration_s. voiceover in languages_out[0], spoken register, written for TTS. on_screen_text <= 6 words. shot must respect camera_level and the plan's shot_list.
- caption: one entry per language in languages_out, native script, 40-120 words, first line = hook, line breaks allowed.
- hashtags: 8-15, mix native-script and English tags, local tags if audience is local (city / area).
- story_text in languages_out[0], under 15 words.`,
    mock: () => loadMock(personaOf(profile), "post"),
  });
}

// ---------------------------------------------------------- 4. checkBoundaries
/**
 * checkBoundaries(post, profile) -> BoundaryVerdict & { rule_hits }
 * Deterministic rules run first; any "block" hit forces verdict "flag" even if the model says pass.
 */
export async function checkBoundaries(post, profile) {
  const ruleHits = ruleCheck(post, profile);
  const persona = personaOf(profile);

  const v = await callStructured({
    name: "checkBoundaries",
    schema: BoundaryVerdict,
    effort: "medium",
    system: SYSTEM,
    user: `Check this post before it is published for this creator.

Post:
${j(post)}

Profile:
${j(profile)}
${isDental(profile) ? `\nProfessional rules (National Dental Commission advisory, 14 Oct 2026):\n${NDC_TEXT}\n` : ""}
Deterministic checker already found:
${ruleHits.length ? j(ruleHits) : "(nothing)"}

Check against: every boundary in the profile (personal, cultural, professional), camera_level (who/what may be visible), places (only where they can film), and the rules above. Include the deterministic findings unless clearly a false positive (then explain in explain).
- verdict "flag" if any reason has severity "block", else "pass" (warn-only reasons may stay with pass).
- explain: one kind line in language_in, native script.
- safe_rewrite: when flag, the full corrected post with the smallest changes that fix every reason, same languages and format. Otherwise null.`,
    mock: () => (ruleHits.length ? loadMock(persona, "boundary-flag") : { verdict: "pass", reasons: [], explain: loadMock(persona, "boundary-flag").explain_pass, safe_rewrite: null }),
  });

  // Merge: deterministic block hits always win.
  const seen = new Set(v.reasons.map((r) => `${r.rule_id}|${r.where}`));
  for (const h of ruleHits) if (!seen.has(`${h.rule_id}|${h.where}`)) v.reasons.push(h);
  if (v.reasons.some((r) => r.severity === "block")) v.verdict = "flag";
  const rewriteHits = v.safe_rewrite ? ruleCheck(v.safe_rewrite, profile) : [];
  return { ...v, rule_hits: ruleHits, rewrite_still_flags: rewriteHits };
}

// ----------------------------------------------------------- 5. reviseByVoice
/**
 * reviseByVoice(post, instruction, profile?) -> Revision & { rule_hits }
 * instruction: ASR text of the spoken change, any of the 5 languages.
 * profile is optional; when given, the revised post is re-checked by the rule engine.
 */
export async function reviseByVoice(post, instruction, profile = null) {
  const r = await callStructured({
    name: "reviseByVoice",
    schema: Revision,
    effort: "low",
    system: SYSTEM,
    user: `The creator spoke this change request (raw speech-to-text, may be Tamil, Kannada, Hindi, Telugu, English or mixed, may have ASR errors):
"""${instruction}"""

Current post:
${j(post)}
${profile ? `\nProfile (respect it):\n${j(profile)}\n` : ""}
Apply ONLY what they asked. Keep everything else word for word.
- "Shorter" = fewer slides or reel lines and tighter text; re-time reel lines so they stay contiguous and duration_s matches.
- Removing a place or thing from view = rewrite every shot and visual_hint that shows it, and any voiceover or caption line that refers to it.
- understood_en: what you understood, in English. change_summary: one line in the instruction's language, native script, addressed to the creator.`,
    mock: () => loadMock(personaOf(profile ?? (post.languages_out?.[0] === "ta" ? { language_in: "ta" } : null)), "revise"),
  });
  return { ...r, rule_hits: profile ? ruleCheck(r.post, profile) : [] };
}
