// Zod schemas for every brain function. These double as the structured-output
// contract sent to Claude (via betaZodOutputFormat) and as runtime validators.
import { z } from "zod";

export const Lang = z.enum(["hi", "kn", "ta", "te", "en"]);
export const Day = z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);

// ---------- 1. CreatorProfile ----------
// Every field is nullable / may be empty so the same schema holds a partial
// profile mid-interview. `missingFields(profile)` in questions.mjs decides completeness.
export const ShootSlot = z.object({
  day: z.enum(["mon", "tue", "wed", "thu", "fri", "sat", "sun", "daily", "weekdays", "weekends"]),
  start: z.string().nullable().describe("24h HH:MM if known, else null"),
  minutes: z.number().int().describe("length of the free window in minutes"),
  note: z.string().describe("short English note, e.g. 'gap between patients'"),
});

export const CreatorProfile = z.object({
  name: z.string().nullable(),
  profession: z.string().nullable().describe("e.g. 'dentist', 'home cook'. Drives professional rule packs."),
  city: z.string().nullable(),
  language_in: Lang.nullable().describe("primary language the person speaks to us in"),
  languages_out: z.array(Lang).describe("languages posts should be written in, most important first"),
  goal: z.enum(["customers", "followers", "side_income", "hobby"]).nullable(),
  level: z.enum(["never", "stopped", "irregular", "consistent"]).nullable(),
  what_they_share: z.string().nullable().describe("one English sentence: topics / offer"),
  audience: z
    .object({
      type: z.enum(["local", "broad"]),
      radius_km: z.number().nullable().describe("only for local"),
      description: z.string().describe("short English description of who should see the posts"),
    })
    .nullable(),
  camera_level: z
    .number()
    .int()
    .min(0)
    .max(4)
    .nullable()
    .describe("0 nothing on camera, 1 hands/objects only, 2 voice only, 3 AI avatar from photo, 4 face on camera. Highest level they are OK with."),
  time_per_week: z.number().int().nullable().describe("minutes per week they can give to content"),
  shoot_slots: z.array(ShootSlot),
  places: z.array(z.string()).describe("places they can film, English, e.g. 'clinic chair room', 'home kitchen'"),
  tech: z
    .object({
      phone: z.string().describe("e.g. 'old Android, ~2018', 'iPhone 13'"),
      tripod: z.boolean(),
      light: z.enum(["none", "window", "ring_light", "studio"]),
      internet: z.enum(["good", "patchy", "poor"]),
    })
    .nullable(),
  budget: z.number().int().nullable().describe("INR per month they can spend on content (0 if none)"),
  boundaries: z.object({
    personal: z.array(z.string()),
    cultural: z.array(z.string()),
    professional: z.array(z.string()),
  }),
  inspirations: z.array(z.string()).describe("accounts, shows or styles they like"),
});

// ---------- 2. Week plan ----------
export const Shot = z.object({
  shot: z.string().describe("what to film, in the creator's language_in"),
  shot_en: z.string(),
  seconds: z.number().int(),
  where: z.string().describe("must be one of profile.places"),
  how: z.string().describe("phone position / framing tip, creator's language"),
});

export const PlanItem = z.object({
  id: z.string().describe("p1..p5"),
  format: z.enum(["reel", "carousel", "single_image"]),
  title: z.string().describe("in languages_out[0], native script"),
  title_en: z.string(),
  hook: z.string().describe("first line / first 2 seconds, languages_out[0], native script"),
  why_this_works: z.string().describe("ONE teaching line in language_in, native script"),
  why_this_works_en: z.string(),
  needs_filming: z.boolean(),
  shot_list: z.array(Shot).describe("empty when needs_filming is false"),
  effort_minutes: z.number().int().describe("creator's total time for this post"),
  scheduled_day: Day,
  shoot_slot: z.string().nullable().describe("which shoot slot (e.g. 'tue 13:15, 15 min'), null if no filming"),
});

export const StoryItem = z.object({
  day: Day,
  type: z.enum(["poll", "question", "quiz", "tip", "behind_the_scenes", "reminder", "countdown"]),
  text: z.string().describe("languages_out[0], native script, under 15 words"),
  text_en: z.string(),
  needs_photo: z.boolean(),
  photo_hint: z.string().nullable().describe("English, only if needs_photo"),
});

export const FilteredIdea = z.object({
  idea: z.string().describe("generic idea, English, short"),
  killed_by: z.enum(["camera", "time", "place", "tech", "language", "boundary", "professional_rule", "budget", "goal_fit"]),
  reason: z.string().describe("English, one line, names the specific constraint"),
});

export const WeekPlan = z.object({
  ideas_considered: z.number().int().describe("total generic ideas considered = 5 + filtered_out.length + any others"),
  posts: z.array(PlanItem).describe("exactly 5"),
  stories: z.array(StoryItem).describe("exactly 7, one per day mon..sun"),
  filtered_out: z.array(FilteredIdea).describe("8-14 rejected generic ideas"),
});

// ---------- 3. Post ----------
export const LocalText = z.object({ lang: Lang, text: z.string() });

export const Post = z.object({
  plan_id: z.string(),
  format: z.enum(["reel", "carousel", "single_image"]),
  languages_out: z.array(Lang),
  carousel: z
    .object({
      slides: z.array(
        z.object({
          headline: z.string().describe("native script, max ~8 words"),
          body: z.string().describe("native script, max ~30 words"),
          visual_hint: z.string().describe("English note for the renderer / photo"),
        }),
      ),
    })
    .nullable(),
  reel: z
    .object({
      duration_s: z.number().int(),
      voiceover_lang: Lang,
      lines: z.array(
        z.object({
          t_start: z.number().describe("seconds"),
          t_end: z.number(),
          voiceover: z.string().describe("spoken line, native script, natural spoken register"),
          on_screen_text: z.string().describe("short caption burned on video, native script"),
          shot: z.string().describe("English: what is on screen; must respect camera_level and places"),
        }),
      ),
    })
    .nullable(),
  single_image: z
    .object({ headline: z.string(), sub: z.string(), visual_hint: z.string() })
    .nullable(),
  caption: z.array(LocalText).describe("one caption per output language, native script"),
  hashtags: z.array(z.string()).describe("8-15, mix of native-script and English tags, no '#' duplicates"),
  story_text: LocalText.describe("one-line story to promote this post"),
});

// ---------- 4. Boundary check ----------
export const BoundaryReason = z.object({
  rule_id: z.string().describe("e.g. NDC-TESTIMONIAL, PERSONAL, CULTURAL, CAMERA"),
  rule: z.string().describe("English, short"),
  where: z.string().describe("field path, e.g. 'carousel.slides[2].body' or 'caption[0]'"),
  excerpt: z.string().describe("offending text, verbatim"),
  severity: z.enum(["block", "warn"]),
});

export const BoundaryVerdict = z.object({
  verdict: z.enum(["pass", "flag"]),
  reasons: z.array(BoundaryReason),
  explain: z.string().describe("one line in the creator's language_in, native script, kind tone"),
  safe_rewrite: Post.nullable().describe("full corrected post when verdict is flag, else null"),
});

// ---------- 5. Revise by voice ----------
export const Revision = z.object({
  understood_en: z.string().describe("English paraphrase of the spoken instruction"),
  change_summary: z.string().describe("one line in the instruction's language, native script"),
  post: Post,
});
