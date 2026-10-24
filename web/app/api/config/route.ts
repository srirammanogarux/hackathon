import { has, json } from "@/lib/server";

export async function GET() {
  return json({
    claude: has.claude(),
    eleven: has.eleven(),
    pine: has.pine(),
    agenticorg: has.agenticorg(),
    instagram: has.instagram(),
  });
}
