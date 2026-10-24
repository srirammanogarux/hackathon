import { getJob, publicJob, requestLang, type Lang } from "@/lib/funnel";
import { json } from "@/lib/server";

export async function POST(req: Request) {
  const { id, lang } = await req.json();
  const job = getJob(id);
  if (!job) return json({ error: "not found" }, 404);
  requestLang(job, lang as Lang);
  return json(publicJob(job));
}
