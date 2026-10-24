// English UI for the brain's interview questions (ids match spikes/brain questions.mjs).
// Each option is a tap answer that fills profile fields directly.
export type Option = { label: string; icon: string; patch: Record<string, unknown> };
export type UiQuestion = { title: string; sub: string; options: Option[] };

const BG = ["#FFF6E0", "#EDE9FF", "#E5F6EC", "#FFE7EF"];
export const optionBg = (i: number) => BG[i % BG.length];

const tech = { phone: "Android phone", tripod: false, light: "window", internet: "patchy" };

export const UI_QUESTIONS: Record<string, UiQuestion> = {
  intro: {
    title: "What do you do?",
    sub: "Your work, your hobby, anything works.",
    options: [
      { label: "Cooking", icon: "pot", patch: { profession: "home cook", what_they_share: "Home cooking and traditional recipes" } },
      { label: "Clinic / doctor", icon: "plus", patch: { profession: "dentist", what_they_share: "Dental care tips for local families" } },
      { label: "Shop / business", icon: "shop", patch: { profession: "shop owner", what_they_share: "Products from my local shop" } },
      { label: "Want to be a creator", icon: "star", patch: { profession: "aspiring creator", what_they_share: "Everyday life and skills" } },
    ],
  },
  goal: {
    title: "What do you want from Instagram?",
    sub: "Tell us, and we'll plan around it!",
    options: [
      { label: "More customers", icon: "shop", patch: { goal: "customers", audience: { type: "local", radius_km: 5, description: "People nearby" } } },
      { label: "More followers", icon: "heart", patch: { goal: "followers", audience: { type: "broad", radius_km: null, description: "Anyone who speaks my language" } } },
      { label: "Side income", icon: "rupee", patch: { goal: "side_income", audience: { type: "broad", radius_km: null, description: "Buyers anywhere" } } },
      { label: "Just for fun", icon: "star", patch: { goal: "hobby", audience: { type: "broad", radius_km: null, description: "Friends and family" } } },
    ],
  },
  level: {
    title: "Have you posted before?",
    sub: "No worries. We'll start from here.",
    options: [
      { label: "No, first time", icon: "star", patch: { level: "never" } },
      { label: "I did, then stopped", icon: "redo", patch: { level: "stopped" } },
      { label: "Sometimes", icon: "calendar", patch: { level: "irregular" } },
      { label: "Almost daily", icon: "trend", patch: { level: "consistent" } },
    ],
  },
  camera: {
    title: "OK to show your face on camera?",
    sub: "We'll plan around what you're comfortable with.",
    options: [
      { label: "Face is fine", icon: "user", patch: { camera_level: 4 } },
      { label: "Hands only", icon: "hand", patch: { camera_level: 1 } },
      { label: "Voice only", icon: "wave", patch: { camera_level: 2 } },
      { label: "Try an AI avatar", icon: "star", patch: { camera_level: 3 } },
    ],
  },
  time: {
    title: "How much time do you get each week?",
    sub: "Whatever free time you have is enough.",
    options: [
      { label: "1 hour", icon: "clock", patch: { time_per_week: 60, shoot_slots: [{ day: "weekdays", start: "16:00", minutes: 20, note: "short daily gap" }] } },
      { label: "2–3 hours", icon: "clock", patch: { time_per_week: 150, shoot_slots: [{ day: "daily", start: "16:00", minutes: 60, note: "daily 4-5 pm" }] } },
      { label: "5+ hours", icon: "calendar", patch: { time_per_week: 300, shoot_slots: [{ day: "daily", start: "10:00", minutes: 90, note: "mornings free" }] } },
      { label: "Sundays only", icon: "calendar", patch: { time_per_week: 120, shoot_slots: [{ day: "sun", start: "10:00", minutes: 120, note: "Sunday only" }] } },
    ],
  },
  place_tech: {
    title: "Where can you shoot?",
    sub: "One room is enough. A phone is enough.",
    options: [
      { label: "Kitchen", icon: "pot", patch: { places: ["home kitchen"], tech, budget: 0 } },
      { label: "Clinic", icon: "plus", patch: { places: ["clinic"], tech, budget: 0 } },
      { label: "Shop", icon: "shop", patch: { places: ["shop counter"], tech, budget: 0 } },
      { label: "Home", icon: "home", patch: { places: ["home"], tech, budget: 0 } },
    ],
  },
  languages: {
    title: "Which language should posts be in?",
    sub: "The language your people speak.",
    options: [
      { label: "Hindi", icon: "star", patch: { languages_out: ["hi"] } },
      { label: "Hindi + English", icon: "star", patch: { languages_out: ["hi", "en"] } },
      { label: "Kannada + English", icon: "star", patch: { languages_out: ["kn", "en"] } },
      { label: "English", icon: "star", patch: { languages_out: ["en"] } },
    ],
  },
  boundaries: {
    title: "What should we never show?",
    sub: "Guard will check every post for this.",
    options: [
      { label: "No face", icon: "eyeoff", patch: { boundaries: { personal: ["never show face"], cultural: [], professional: [] } } },
      { label: "No family in frame", icon: "family", patch: { boundaries: { personal: ["no family members in frame"], cultural: [], professional: [] } } },
      { label: "No home address", icon: "pin", patch: { boundaries: { personal: ["never reveal home address"], cultural: [], professional: [] } } },
      { label: "Anything is fine", icon: "ok", patch: { boundaries: { personal: [], cultural: [], professional: [] } } },
    ],
  },
};
