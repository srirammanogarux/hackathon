// Intro Reel: 6 script lines, one shot per line. Shared by the funnel UI, the assembler and the Veo script.
export const DEFAULT_LINES = [
  "Bored of the same office lunch every day?",
  "I'm Sunita, and every morning I make fresh, home-style tiffins right here in my kitchen in Gomti Nagar.",
  "Aloo parathas made by hand, cooked in real ghee — still soft when you open your tiffin at lunch.",
  "Fresh dal and seasonal sabzi every single day. No leftovers, no shortcuts.",
  "Everything is packed hot in steel tiffins, so it tastes just like home.",
  "WhatsApp me before 11 and your lunch reaches your office by 1. Follow for today's menu!",
];

export type Shot = { ref: string; title: string; hinglish: string; seconds: number; veo: string };

// ref = /public/demo/refs/<ref>.jpg. hinglish = shoot instruction in simple Hinglish (Latin script).
export const SHOTS: Shot[] = [
  {
    ref: "tiffin-boxes",
    title: "Open tiffin on the table",
    hinglish: "Tiffin khol ke table pe rakho. Phone upar se pakdo, bilkul seedha.",
    seconds: 8,
    veo: "Top-down shot of an open steel tiffin box with roti, dal and sabzi on an office desk, soft daylight, slow push-in.",
  },
  {
    ref: "hands-rolling",
    title: "Hands rolling dough",
    hinglish: "Atta bello, sirf haath dikhao. Phone side se, thoda neeche rakho.",
    seconds: 8,
    veo: "Close-up of a woman's hands with red and green glass bangles rolling an aloo paratha on a wooden board, flour dusted granite counter, Indian home kitchen, morning window light.",
  },
  {
    ref: "paratha-plate",
    title: "Paratha with ghee",
    hinglish: "Paratha tawe pe palto, upar ghee lagao. Close-up lo, bas sizzle dikhe.",
    seconds: 8,
    veo: "Close-up of a golden aloo paratha on an iron tawa, a spoon brushing ghee on top, steam rising, Indian home kitchen.",
  },
  {
    ref: "tadka",
    title: "Tadka sizzle",
    hinglish: "Tadka daalo, phone pan ke upar pakdo. Bas sizzle dikhna chahiye.",
    seconds: 8,
    veo: "Two pots on a gas stove in an Indian home kitchen: yellow dal with a sizzling tadka of cumin and curry leaves being poured in, and seasonal sabzi being stirred with a steel ladle by a woman's hand with bangles, steam rising.",
  },
  {
    ref: "packed-tiffin",
    title: "Packing the tiffin",
    hinglish: "Garam khana steel tiffin mein bharo, dhakkan band karo. Sirf haath dikhne chahiye.",
    seconds: 8,
    veo: "A woman's hands with glass bangles packing hot dal, sabzi and folded aloo parathas into a stacked steel tiffin carrier, steam rising, then pressing the lid shut, Indian kitchen counter, morning light.",
  },
  {
    ref: "tiffin-boxes",
    title: "All tiffins ready",
    hinglish: "Saare tiffin line mein rakho. Phone dheere se left se right ghumao.",
    seconds: 8,
    veo: "A closed, stacked steel tiffin carrier on a kitchen counter next to a smartphone lying flat showing a messaging app chat (no readable text), a hand taps the phone, warm morning light, slow push-in.",
  },
];

export const refUrl = (i: number) => `/demo/refs/${SHOTS[i].ref}.jpg`;
export const fallbackClip = (i: number) => `/demo/footage-fallback/shot-${i + 1}.mp4`;
export const demoClip = (i: number) => `/demo/footage/shot-${i + 1}.mp4`;

// Demo voiceover (ElevenLabs, natural Indian female voice): the same 6 lines, code-mixed Hinglish in Latin script.
export const HINGLISH_LINES = [
  "Roz roz wahi boring office lunch? Bas, ab nahi!",
  "Main Sunita, aur har subah Gomti Nagar mein apne kitchen se fresh, ghar jaisa tiffin banati hoon.",
  "Haath se bane aloo parathe, asli ghee mein — lunch tak bilkul soft.",
  "Roz fresh dal aur mausami sabzi. Na leftover, na shortcut.",
  "Sab kuch garam-garam steel tiffin mein pack, bilkul ghar jaisa swaad.",
  "Subah 11 baje tak WhatsApp karo, aur 1 baje tak lunch aapke office pe. Aaj ka menu dekhne ke liye follow karo!",
];
export const DEMO_VOICE_ID = "p9aflnsbBe1o0aDeQa97"; // ElevenLabs shared voice "Kanika", friendly Hindi female
