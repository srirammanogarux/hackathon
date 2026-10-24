// V2 feature flags and mock detection. Every integration asks here, never reads env directly,
// so "no keys → fixtures" behaves the same everywhere.

const on = (v: string | undefined) => v === "1" || v === "true";

export const v2 = {
  /** Global kill switch (§11). Real outbound sends (IG reply/DM, WhatsApp, email) only when V2_SENDS_ENABLED=1.
   *  Off → sends are recorded in the outbox as mock and logged as send_blocked. Default off until A6 sign-off. */
  sendsEnabled: () => on(process.env.V2_SENDS_ENABLED),

  instagram: () => !!process.env.IG_ACCESS_TOKEN && process.env.IG_MOCK !== "1",
  igAppSecret: () => process.env.IG_APP_SECRET ?? "",
  igVerifyToken: () => process.env.IG_VERIFY_TOKEN ?? "reels-magic-verify",

  brain: () => !!(process.env.ANTHROPIC_API_KEY || process.env.GEMINI_API_KEY) && process.env.BRAIN_MOCK !== "1",

  pinelabs: () => !!(process.env.PINELABS_CLIENT_ID && process.env.PINELABS_CLIENT_SECRET) && process.env.PAY_MOCK !== "1",

  whatsapp: () => !!(process.env.WA_TOKEN && process.env.WA_PHONE_NUMBER_ID) && process.env.WA_MOCK !== "1",
  email: () => !!process.env.RESEND_API_KEY && process.env.EMAIL_MOCK !== "1",
  agenticorg: () => !!process.env.AGENTICORG_API_KEY && process.env.AGENTICORG_MOCK !== "1",

  /** Approval threshold (§6). */
  minConfidence: 0.7,
  /** First N replies on a new account always need approval (§6). */
  trustWarmup: 20,

  appBaseUrl: () => (process.env.APP_BASE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
};
