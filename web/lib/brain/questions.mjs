// Deterministic interview driver. No LLM call: questions are pre-written in all
// five languages (plus Hinglish, the default UI language) so the next question
// appears instantly between voice turns.

const Q = [
  {
    id: "intro",
    fields: ["name", "profession", "what_they_share"],
    text: {
      en: "Hi! I'm your content team. What's your name, and what do you do or love to share?",
      hinglish: "Namaste! Main Saathi hoon, aapka content buddy. Aapka naam kya hai, aur aap kya karte ho ya logon ko kya dikhana pasand hai?",
      hi: "नमस्ते! मैं आपकी कंटेंट टीम हूँ। आपका नाम क्या है, और आप क्या करते हैं या लोगों को क्या दिखाना पसंद करते हैं?",
      kn: "ನಮಸ್ಕಾರ! ನಾನು ನಿಮ್ಮ ಕಂಟೆಂಟ್ ಟೀಮ್. ನಿಮ್ಮ ಹೆಸರೇನು? ನೀವು ಏನು ಮಾಡ್ತೀರಾ, ಜನರಿಗೆ ಏನು ತೋರಿಸೋಕೆ ಇಷ್ಟ?",
      ta: "வணக்கம்! நான் உங்க Instagram உதவியாளர். உங்க பெயர் என்ன? நீங்க என்ன செய்றீங்க, மக்களுக்கு எதைக் காட்ட ஆசைப்படுறீங்க?",
      te: "నమస్కారం! నేను మీ Instagram సహాయకుడిని. మీ పేరు ఏమిటి? మీరు ఏం చేస్తారు, ప్రజలకు ఏం చూపించాలనుకుంటున్నారు?",
    },
  },
  {
    id: "goal",
    fields: ["goal", "audience"],
    text: {
      en: "What do you want from Instagram: more customers, more followers, some side income, or just for joy? And who should see your posts: people near you, or anyone?",
      hinglish: "Instagram se aapko kya chahiye: zyada customers, zyada followers, thodi side income, ya bas shauk ke liye? Aur aapki post kaun dekhe: aas-paas ke log, ya koi bhi?",
      hi: "Instagram से आपको क्या चाहिए: ज़्यादा ग्राहक, ज़्यादा फ़ॉलोअर्स, थोड़ी extra कमाई, या बस शौक़ के लिए? और आपकी पोस्ट कौन देखे: आपके आस-पास के लोग, या कोई भी?",
      kn: "Instagram ಇಂದ ನಿಮಗೆ ಏನು ಬೇಕು: ಹೆಚ್ಚು ಗ್ರಾಹಕರು, ಹೆಚ್ಚು ಫಾಲೋವರ್ಸ್, ಸ್ವಲ್ಪ ಎಕ್ಸ್ಟ್ರಾ ಆದಾಯ, ಅಥವಾ ಸುಮ್ಮನೆ ಖುಷಿಗೆ? ನಿಮ್ಮ ಪೋಸ್ಟ್ ಯಾರು ನೋಡಬೇಕು: ಹತ್ತಿರದ ಜನ, ಅಥವಾ ಯಾರಾದರೂ?",
      ta: "Instagram மூலமா உங்களுக்கு என்ன வேணும்: நிறைய வாடிக்கையாளர்கள், நிறைய பேர் பின்தொடரணும், கொஞ்சம் கூடுதல் வருமானம், இல்ல சும்மா சந்தோஷத்துக்கா? உங்க பதிவுகளை யார் பார்க்கணும்: பக்கத்துல இருக்கிறவங்களா, இல்ல எல்லாருமா?",
      te: "Instagram నుండి మీకు ఏం కావాలి: ఎక్కువ కస్టమర్లు, ఎక్కువ ఫాలోవర్లు, కొంచెం అదనపు ఆదాయం, లేదా సరదాకి? మీ పోస్టులు ఎవరు చూడాలి: మీ దగ్గర ఉన్నవాళ్ళా, లేక ఎవరైనా?",
    },
  },
  {
    id: "level",
    fields: ["level", "inspirations"],
    text: {
      en: "Have you posted before? Is there any account or show you love watching?",
      hinglish: "Pehle kabhi post kiya hai? Koi account ya show jo aapko dekhna achha lagta hai?",
      hi: "क्या आपने पहले कभी पोस्ट किया है? कोई अकाउंट या शो जो आपको देखना अच्छा लगता है?",
      kn: "ಮೊದಲು ಯಾವತ್ತಾದರೂ ಪೋಸ್ಟ್ ಮಾಡಿದ್ದೀರಾ? ನೀವು ಇಷ್ಟಪಟ್ಟು ನೋಡೋ ಯಾವುದಾದರೂ ಅಕೌಂಟ್ ಅಥವಾ ಶೋ ಇದೆಯಾ?",
      ta: "இதுக்கு முன்னாடி எப்பவாவது பதிவு போட்டிருக்கீங்களா? நீங்க விரும்பிப் பார்க்கிற ஏதாவது பக்கம் அல்லது நிகழ்ச்சி இருக்கா?",
      te: "ఇంతకు ముందు ఎప్పుడైనా పోస్ట్ చేశారా? మీకు నచ్చిన ఏదైనా అకౌంట్ లేదా షో ఉందా?",
    },
  },
  {
    id: "camera",
    fields: ["camera_level"],
    text: {
      en: "How do you feel about the camera? Showing your face, only your voice, only your hands, or should we make an AI version of you from one photo?",
      hinglish: "Camera pe face dikhana theek hai? Ya sirf aawaz, sirf haath, ya ek photo se aapka AI avatar bana dein?",
      hi: "कैमरे के बारे में क्या सोचते हैं? चेहरा दिखाना ठीक है, सिर्फ़ आवाज़, सिर्फ़ हाथ, या आपकी एक फ़ोटो से AI वाला रूप बना दें?",
      kn: "ಕ್ಯಾಮೆರಾ ಬಗ್ಗೆ ಹೇಗನಿಸುತ್ತೆ? ಮುಖ ತೋರಿಸೋದು ಓಕೆನಾ, ಬರೀ ಧ್ವನಿ, ಬರೀ ಕೈಗಳು, ಅಥವಾ ನಿಮ್ಮ ಒಂದು ಫೋಟೋದಿಂದ AI ರೂಪ ಮಾಡೋಣವಾ?",
      ta: "கேமரா பத்தி எப்படி உணர்றீங்க? முகம் காட்டலாமா, குரல் மட்டும், கைகள் மட்டும், இல்ல உங்க ஒரு போட்டோவிலிருந்து AI உருவம் செய்யலாமா?",
      te: "కెమెరా గురించి మీకు ఎలా అనిపిస్తుంది? ముఖం చూపించడం ఓకేనా, గొంతు మాత్రమే, చేతులు మాత్రమే, లేదా మీ ఒక ఫోటో నుండి AI రూపం చేద్దామా?",
    },
  },
  {
    id: "time",
    fields: ["time_per_week", "shoot_slots"],
    text: {
      en: "How much time can you give in a week, and when are you usually free?",
      hinglish: "Hafte mein kitna time de sakte ho, aur aam taur pe kab free hote ho?",
      hi: "हफ़्ते में कितना समय दे सकते हैं, और आमतौर पर कब फ़्री होते हैं?",
      kn: "ವಾರಕ್ಕೆ ಎಷ್ಟು ಸಮಯ ಕೊಡಬಹುದು, ಸಾಮಾನ್ಯವಾಗಿ ಯಾವಾಗ ಫ್ರೀ ಇರ್ತೀರಾ?",
      ta: "வாரத்துல எவ்வளவு நேரம் கொடுக்க முடியும்? பொதுவா எப்போ நேரம் கிடைக்கும்?",
      te: "వారానికి ఎంత సమయం ఇవ్వగలరు, సాధారణంగా ఎప్పుడు ఖాళీగా ఉంటారు?",
    },
  },
  {
    id: "place_tech",
    fields: ["places", "tech", "budget"],
    text: {
      en: "Where can you film, and which phone do you have? Do you have a stand or a light? Any budget for this?",
      hinglish: "Shoot kahan kar sakte ho, aur kaunsa phone hai? Stand ya light hai? Iske liye koi budget hai?",
      hi: "आप कहाँ शूट कर सकते हैं, और कौन सा फ़ोन है? स्टैंड या लाइट है? इसके लिए कोई बजट है?",
      kn: "ಎಲ್ಲಿ ಶೂಟ್ ಮಾಡಬಹುದು, ಯಾವ ಫೋನ್ ಇದೆ? ಸ್ಟ್ಯಾಂಡ್ ಅಥವಾ ಲೈಟ್ ಇದೆಯಾ? ಇದಕ್ಕೆ ಏನಾದರೂ ಬಜೆಟ್ ಇದೆಯಾ?",
      ta: "எங்கே வீடியோ எடுக்க முடியும்? எந்த போன் வச்சிருக்கீங்க? ஸ்டாண்ட் அல்லது லைட் இருக்கா? இதுக்கு ஏதாவது செலவு பண்ண முடியுமா?",
      te: "ఎక్కడ షూట్ చేయగలరు, ఏ ఫోన్ ఉంది? స్టాండ్ లేదా లైట్ ఉందా? దీనికి ఏదైనా బడ్జెట్ ఉందా?",
    },
  },
  {
    id: "languages",
    fields: ["languages_out"],
    text: {
      en: "Which languages should your posts be in?",
      hinglish: "Aapki post kis bhasha mein ho?",
      hi: "आपकी पोस्ट किन भाषाओं में हों?",
      kn: "ನಿಮ್ಮ ಪೋಸ್ಟ್‌ಗಳು ಯಾವ ಭಾಷೆಗಳಲ್ಲಿ ಇರಬೇಕು?",
      ta: "உங்க பதிவுகள் எந்த மொழியில இருக்கணும்?",
      te: "మీ పోస్టులు ఏ భాషల్లో ఉండాలి?",
    },
  },
  {
    id: "boundaries",
    fields: ["boundaries"],
    text: {
      en: "Is there anything you never want to show or say? Family, religion, work rules, anything.",
      hinglish: "Kuch aisa hai jo aap kabhi dikhana ya bolna nahi chahte? Family, dharm, kaam ke rules, kuch bhi.",
      hi: "कुछ ऐसा है जो आप कभी दिखाना या कहना नहीं चाहते? परिवार, धर्म, काम के नियम, कुछ भी।",
      kn: "ನೀವು ಯಾವತ್ತೂ ತೋರಿಸಬಾರದು ಅಥವಾ ಹೇಳಬಾರದು ಅನ್ನೋದು ಏನಾದರೂ ಇದೆಯಾ? ಮನೆಯವರು, ಧರ್ಮ, ಕೆಲಸದ ನಿಯಮಗಳು, ಏನಾದರೂ.",
      ta: "எப்பவுமே காட்டக்கூடாத, சொல்லக்கூடாத விஷயம் ஏதாவது இருக்கா? குடும்பம், மதம், வேலை விதிகள், எதுவானாலும் சொல்லுங்க.",
      te: "మీరు ఎప్పుడూ చూపించకూడని, చెప్పకూడని విషయం ఏదైనా ఉందా? కుటుంబం, మతం, పని నియమాలు, ఏదైనా సరే.",
    },
  },
];

export const MAX_QUESTIONS = Q.length; // 8

// A field counts as answered when it has a value. Lists that can legitimately
// be empty (boundaries, inspirations) count as answered once their question was asked.
const filled = (p, f, asked) => {
  const v = p?.[f];
  switch (f) {
    case "boundaries":
      return asked.has("boundaries") || (v && Object.values(v).some((a) => a.length));
    case "inspirations":
      return true; // nice to have, never blocks
    case "profession":
      return true; // folded into what_they_share
    case "languages_out":
    case "shoot_slots":
    case "places":
      return Array.isArray(v) && v.length > 0;
    default:
      return v !== null && v !== undefined && v !== "";
  }
};

/** Fields still missing from a (partial) profile. */
export function missingFields(profile, asked = []) {
  const set = new Set(asked);
  return Q.flatMap((q) => q.fields).filter((f) => !filled(profile, f, set));
}

/**
 * nextQuestion(profileSoFar, { lang, asked }) -> { done, question?, missing }
 * - lang: UI language picked before the first answer ("hinglish" or a content language);
 *   defaults to profile.language_in, else "hinglish".
 * - asked: ids already asked. A question is never repeated, so the interview ends in <= 8 turns.
 */
export function nextQuestion(profileSoFar = null, { lang, asked = [] } = {}) {
  const l = lang || profileSoFar?.language_in || "hinglish";
  const set = new Set(asked);
  const missing = missingFields(profileSoFar, asked);
  const q = Q.find((q) => !set.has(q.id) && q.fields.some((f) => missing.includes(f)));
  if (!q || set.size >= MAX_QUESTIONS) return { done: true, question: null, missing };
  return {
    done: false,
    question: { id: q.id, lang: l, text: q.text[l] ?? q.text.en, text_en: q.text.en, fields: q.fields },
    missing,
  };
}

export const QUESTION_BANK = Q;
