// Deterministic guardrails that run before (and regardless of) the LLM check.
// A hit here always forces verdict "flag", so a model slip can't let a
// before/after post through for a dentist.

export const NDC_RULES = [
  {
    id: "NDC-TESTIMONIAL",
    rule: "No patient testimonials, reviews or ratings (NDC advisory, 14 Oct 2026)",
    re: /testimonial|\breview(s)?\b|happy patients?|patient (says|said|feedback|story)|5[- ]?star|⭐|\brated\b|ರೋಗಿಗಳ ಅನುಭವ|ರಿವ್ಯೂ|मरीज़ों की राय|रिव्यू|நோயாளிகளின் அனுபவம்|ரிவ்யூ|రివ్యూ/i,
    severity: "block",
  },
  {
    id: "NDC-BEFORE-AFTER",
    rule: "No before/after photos or transformation reveals",
    re: /before\s*(&|and|\/|vs\.?)\s*after|transformation|ಮೊದಲು.{0,6}ನಂತರ|पहले.{0,6}बाद|முன்னும்.{0,4}பின்னும்|ముందు.{0,6}తర్వాత/i,
    severity: "block",
  },
  {
    id: "NDC-SUPERIORITY",
    rule: "No superiority or guarantee claims (best, No.1, cheapest, 100% painless)",
    re: /\bbest (dentist|dental|clinic|doctor|treatment|results?|smile)|no\.?\s?1\b|number one|\btop (dentist|clinic)|cheapest|guarantee|100\s?%|painless|ಅತ್ಯುತ್ತಮ|ನಂ\.? ?1|सबसे अच्छा|बेस्ट|சிறந்த பல் மருத்துவர்|உத்தரவாதம்|ఉత్తమ/i,
    severity: "block",
  },
  {
    id: "NDC-SOLICIT",
    rule: "No soliciting patients or inducements (book now, offers, free check-up)",
    re: /book (now|today|your)|call now|dm (us |me )?(to|for) book|\bdiscount|\boffer\b|% ?off|free (check-?up|consultation|cleaning)|limited slots|ಬುಕ್ ಮಾಡಿ|ಆಫರ್|ಉಚಿತ ತಪಾಸಣೆ|अभी बुक|ऑफ़र|मुफ़्त जांच|தள்ளுபடி|இலவச பரிசோதனை|బుక్ చేయండి|ఆఫర్/i,
    severity: "block",
  },
  {
    id: "NDC-PROCEDURE",
    rule: "No recording or broadcasting of procedures or patients in the chair",
    re: /during (the )?(procedure|treatment|root canal|extraction)|patient in (the )?chair|inside (the |a )?(patient'?s )?mouth|(film|record|shoot)(ing)? (the |a )?(procedure|treatment|patient)|live (root canal|extraction|procedure)/i,
    severity: "block",
  },
];

export const isDental = (profile) =>
  /dent/i.test(`${profile?.profession ?? ""} ${profile?.what_they_share ?? ""}`) ||
  (profile?.boundaries?.professional ?? []).some((b) => /NDC|dental/i.test(b));

// Collect every user-visible / shoot-relevant string with its path.
function strings(post) {
  const out = [];
  const add = (where, text) => text && out.push({ where, text });
  post.carousel?.slides.forEach((s, i) => {
    add(`carousel.slides[${i}].headline`, s.headline);
    add(`carousel.slides[${i}].body`, s.body);
    add(`carousel.slides[${i}].visual_hint`, s.visual_hint);
  });
  post.reel?.lines.forEach((l, i) => {
    add(`reel.lines[${i}].voiceover`, l.voiceover);
    add(`reel.lines[${i}].on_screen_text`, l.on_screen_text);
    add(`reel.lines[${i}].shot`, l.shot);
  });
  if (post.single_image) {
    add("single_image.headline", post.single_image.headline);
    add("single_image.sub", post.single_image.sub);
    add("single_image.visual_hint", post.single_image.visual_hint);
  }
  post.caption?.forEach((c, i) => add(`caption[${i}]`, c.text));
  post.hashtags?.forEach((h, i) => add(`hashtags[${i}]`, h));
  add("story_text", post.story_text?.text);
  return out;
}

const FACE = /\b(face|selfie|talking head|to camera|on camera)\b/i;
const NO_FACE = /\b(no|without|never|don'?t show|not showing|hide|hidden)\b[^.]{0,20}\bface\b|face (not|never) (shown|visible)|\bfaceless\b/i;

/** Returns BoundaryReason[] (see schemas.mjs). */
export function ruleCheck(post, profile) {
  const reasons = [];
  const all = strings(post);
  if (isDental(profile)) {
    for (const r of NDC_RULES) {
      for (const s of all) {
        const m = s.text.match(r.re);
        if (m) reasons.push({ rule_id: r.id, rule: r.rule, where: s.where, excerpt: m[0], severity: r.severity });
      }
    }
  }
  if ((profile?.camera_level ?? 4) < 4) {
    for (const s of all.filter((s) => /shot|visual_hint/.test(s.where))) {
      if (FACE.test(s.text) && !NO_FACE.test(s.text)) {
        reasons.push({
          rule_id: "CAMERA",
          rule: `Creator's camera level is ${profile.camera_level}; their face must not appear`,
          where: s.where,
          excerpt: s.text.match(FACE)[0],
          severity: "block",
        });
      }
    }
  }
  return reasons;
}
