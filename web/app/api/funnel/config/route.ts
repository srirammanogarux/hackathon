import { json } from "@/lib/server";

export async function GET() {
  return json({
    elevenlabs: !!process.env.ELEVENLABS_API_KEY,
    gemini: !!process.env.GEMINI_API_KEY,
    claude: !!process.env.ANTHROPIC_API_KEY,
    pinelabs: !!(process.env.PINELABS_CLIENT_ID && process.env.PINELABS_CLIENT_SECRET),
    instagram: !!(process.env.IG_USER_ID && process.env.IG_ACCESS_TOKEN),
  });
}
