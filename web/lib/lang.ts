export type Lang = "ta" | "kn" | "te" | "hi" | "en";
export type UiLang = "hinglish" | Lang;

export const PILLS: { id: UiLang; label: string; font?: string }[] = [
  { id: "hinglish", label: "Hinglish" },
  { id: "hi", label: "हिन्दी" },
  { id: "ta", label: "தமிழ்" },
  { id: "kn", label: "ಕನ್ನಡ" },
  { id: "te", label: "తెలుగు" },
  { id: "en", label: "English" },
];

// Content language for posts. Hinglish speakers get Devanagari Hindi posts.
export const contentLang = (ui: UiLang): Lang => (ui === "hinglish" ? "hi" : ui);
export const LANG_NAME: Record<Lang, string> = { ta: "Tamil", kn: "Kannada", te: "Telugu", hi: "Hindi", en: "English" };

// Smiley's tips in English, by post format. The plan's why_this_works_en stays the English mirror.
const TIPS: Record<string, string> = {
  reel: "Say how easy it is in the first line. People watch till the end.",
  carousel: "People save list-style tips. More saves, more reach.",
  single_image: "Everyday food is enough. One real photo builds trust.",
};
export function saathiTip(item: any, ui: UiLang): string | undefined {
  if (!item) return undefined;
  if (ui === "en") return item.why_this_works_en;
  if (ui === "hinglish") return TIPS[item.format] ?? item.why_this_works_en;
  return item.why_this_works ?? item.why_this_works_en;
}
