import { reviseByVoice } from "@/lib/brain/brain.mjs";
import { json, errorJson } from "@/lib/server";

export const maxDuration = 120;

export async function POST(req: Request) {
  try {
    const { post, instruction, profile } = await req.json();
    return json(await reviseByVoice(post, instruction, profile));
  } catch (e) {
    return errorJson(e);
  }
}
