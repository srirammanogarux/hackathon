# brain spike

The content brain is five pure functions: interview, plan the week, write the post, check boundaries, and revise by voice. Each one makes a single structured Claude call (`claude-sonnet-5-5`, JSON schema output via zod) and adds deterministic checks on top. None of them keeps state, so the caller passes everything in.

```bash
cd spikes/brain && npm i
npm test            # 9 tests, mock mode, no key needed
npm run demo:mock   # Arjun + Lakshmi end to end from fixtures -> out/<persona>/
npm run demo        # same, live (reads ANTHROPIC_API_KEY from ../../.env)
npm run demo -- lakshmi   # one persona
```

Mock mode is on when `BRAIN_MOCK=1` or no `ANTHROPIC_API_KEY` is set. In mock mode every function returns the hand-written fixture for its persona (any Tamil input or `language_in: "ta"` gets Lakshmi, anything else gets Arjun). The rule engine still runs for real. The frontend can build against mock mode today, and the fixtures double as a demo fallback if the API is slow on stage.

Env: `BRAIN_MODEL` (default `claude-sonnet-5-5`), `BRAIN_NO_FALLBACK=1` turns off the server-side refusal fallback (`fallbacks: "default"`, beta `server-side-fallback-2026-07-01`), which is on by default in case a dental or medical prompt trips a classifier.

## Functions (`src/brain.mjs`)

```js
import { interview, nextQuestion, missingFields, planWeek, makePost, checkBoundaries, reviseByVoice } from "./src/brain.mjs";

interview(transcript: string, profileSoFar?: CreatorProfile) -> Promise<CreatorProfile>
nextQuestion(profileSoFar: CreatorProfile|null, { lang?: Lang, asked?: string[] })
  -> { done: boolean, question: { id, lang, text, text_en, fields[] } | null, missing: string[] }   // sync, no LLM
planWeek(profile, inspirations?: string[]) -> Promise<WeekPlan>
makePost(planItem: PlanItem, profile) -> Promise<Post>
checkBoundaries(post, profile) -> Promise<BoundaryVerdict & { rule_hits: BoundaryReason[], rewrite_still_flags: BoundaryReason[] }>
reviseByVoice(post, instruction: string, profile?) -> Promise<Revision & { rule_hits: BoundaryReason[] }>
```

| Function | Effort | Notes |
|---|---|---|
| `interview` | low | Use null or [] for anything not said. Pass `profileSoFar` to merge turn by turn, or send the whole transcript once at the end. For a dentist it adds the NDC rule to `boundaries.professional`. |
| `nextQuestion` | none | Eight questions are written in advance in hi, kn, ta, te and en (`src/questions.mjs`). It skips questions whose fields are already filled and never repeats one, so an interview is at most 8 turns. `lang` defaults to `profile.language_in`. |
| `planWeek` | medium | Returns 5 posts (at least one reel, one carousel and one single image), 7 stories (mon to sun) and 12 `filtered_out` ideas. `ideas_considered` is computed (5 + 12 = 17) to drive the "17 ideas -> 5 that fit your life" animation. |
| `makePost` | medium | Fills only the block for the post's format and sets the other two to null. Writes one caption per output language. |
| `checkBoundaries` | medium | The rule engine runs first. Any `block` hit forces `flag`, whatever the model says. `safe_rewrite` is re-checked, and anything still wrong shows up in `rewrite_still_flags`. |
| `reviseByVoice` | low | The instruction can be in any of the 5 languages. When a profile is passed, the revised post is re-checked by the rule engine. |

## Schemas (`src/schemas.mjs`, zod v4)

`Lang` = `hi|kn|ta|te|en`. `Day` = `mon..sun`.

**CreatorProfile** (all nullable, so the same shape also holds a partial profile)
```
name, profession, city
language_in: Lang                 languages_out: Lang[]
goal: customers|followers|side_income|hobby
level: never|stopped|irregular|consistent
what_they_share: string (English)
audience: { type: local|broad, radius_km, description }
camera_level: 0 nothing | 1 hands/objects | 2 voice | 3 AI avatar from photo | 4 face   (highest rung they accept)
time_per_week: minutes
shoot_slots: [{ day: mon..sun|daily|weekdays|weekends, start "HH:MM"|null, minutes, note }]
places: string[]
tech: { phone, tripod: bool, light: none|window|ring_light|studio, internet: good|patchy|poor }
budget: INR/month
boundaries: { personal[], cultural[], professional[] }
inspirations: string[]
```

**WeekPlan**
```
ideas_considered: int
posts[5]: { id, format: reel|carousel|single_image, title, title_en, hook, why_this_works, why_this_works_en,
            needs_filming, shot_list: [{ shot, shot_en, seconds, where (one of places), how }],
            effort_minutes, scheduled_day, shoot_slot }
stories[7]: { day, type: poll|question|quiz|tip|behind_the_scenes|reminder|countdown, text, text_en, needs_photo, photo_hint }
filtered_out[12]: { idea, killed_by: camera|time|place|tech|language|boundary|professional_rule|budget|goal_fit, reason }
```
`title` and `hook` are in `languages_out[0]`, and `why_this_works` is in `language_in`, all in native script.

**Post**
```
plan_id, format, languages_out
carousel: { slides: [{ headline, body, visual_hint }] } | null
reel: { duration_s, voiceover_lang, lines: [{ t_start, t_end, voiceover, on_screen_text, shot }] } | null
single_image: { headline, sub, visual_hint } | null
caption: [{ lang, text }]      hashtags: string[]      story_text: { lang, text }
```
The reel `lines` run back to back with no gaps, so they can go straight to ElevenLabs TTS and the caption burner. `visual_hint` and `shot` are English notes for the renderer.

**BoundaryVerdict**: `{ verdict: pass|flag, reasons: [{ rule_id, rule, where (field path), excerpt, severity: block|warn }], explain (language_in), safe_rewrite: Post|null }`

**Revision**: `{ understood_en, change_summary (instruction language), post: Post }`

## Rule engine (`src/rules.mjs`)

These checks are regex-based and run in every language. NDC rules (National Dental Commission advisory, 14 Oct 2026) apply only when the profile is a dentist:

- `NDC-TESTIMONIAL`: reviews, "happy patients", star ratings
- `NDC-BEFORE-AFTER`: before/after and "transformation", in en, kn, hi, ta and te
- `NDC-SUPERIORITY`: "best dentist", No.1, guarantees, "100%", "painless"
- `NDC-SOLICIT`: book now, offers, discounts, free check-ups
- `NDC-PROCEDURE`: filming procedures, a patient in the chair

`CAMERA` applies to every creator. If `camera_level < 4` and a shot or visual hint shows a face, it is flagged (phrases like "no face" or "face not shown" are allowed). Personal and cultural boundaries such as "no non-veg on Friday" are judged by the model only.

## Fixtures

- `fixtures/arjun.transcript.txt`: an 8-turn onboarding in Kannada-English code-mix. Dentist, camera level 3, 90 min a week, clinic only, kn + en output.
- `fixtures/lakshmi.transcript.txt`: an 8-turn onboarding in colloquial Tamil. Home cook, camera level 2 (hands and voice, no face, no avatar), kitchen only, old Redmi, patchy internet, ₹0 budget, no non-veg on Fridays, no pooja room.
- `fixtures/*.unsafe-post.json`: posts built to break the rules. Arjun's has best dentist, before/after, a free check-up offer and testimonials. Lakshmi's shows her face and a chicken dish on a Friday.
- `fixtures/*.revise.txt`: spoken edits. Kannada: "make it shorter, four slides are enough". Tamil: "make it a bit shorter, don't show the whole kitchen, only hands".
- `fixtures/mock/*.json`: hand-written outputs for each function, in native script. They are the mock responses and the reference for checking live quality.

## Status and limits

- No `.env` existed in any worktree, so the live path has not run against the model. A dummy-key run shows that all five calls build valid requests and reach the API (401). Once a key is added, `npm run demo` writes `out/` and prints a one-line summary per persona.
- `out/` is gitignored, so outputs stay local.
- The native-script text in the fixtures was written by hand in a spoken register. Have a native speaker read the Tamil and Kannada before the demo.
- Mock persona routing is a demo shortcut. Any non-Tamil input returns Arjun's fixtures.
