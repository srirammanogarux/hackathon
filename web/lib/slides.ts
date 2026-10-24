// Turn any Post (carousel | reel | single_image) into carousel slides. Shared by client preview and server render.
export type Slide = { headline: string; body?: string };

export function slidesOf(post: any): Slide[] {
  if (!post) return [];
  if (post.carousel?.slides?.length) return post.carousel.slides.map((s: any) => ({ headline: s.headline, body: s.body }));
  if (post.reel?.lines?.length) return post.reel.lines.map((l: any) => ({ headline: l.on_screen_text, body: l.voiceover }));
  if (post.single_image) return [{ headline: post.single_image.headline, body: post.single_image.sub }];
  return [];
}

export const postLang = (post: any): string => post?.languages_out?.[0] ?? "hi";

export function voiceoverOf(post: any): string {
  if (post?.reel?.lines?.length) return post.reel.lines.map((l: any) => l.voiceover).join(" ");
  return slidesOf(post).map((s) => [s.headline, s.body].filter(Boolean).join(". ")).join(" ");
}

export function captionOf(post: any): string {
  const c = post?.caption?.[0]?.text ?? "";
  const tags = (post?.hashtags ?? []).map((h: string) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return [c, tags].filter(Boolean).join("\n\n");
}

export const DEMO_REEL: Record<string, string> = {
  ta: "/demo/reel-ta.mp4", kn: "/demo/reel-kn.mp4", hi: "/demo/reel-hi.mp4", te: "/demo/reel-te.mp4", en: "/demo/reel-en.mp4",
};
