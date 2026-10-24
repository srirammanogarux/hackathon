import { getJob, publicJob } from "@/lib/funnel";
import { json } from "@/lib/server";

export async function GET(req: Request) {
  const job = getJob(new URL(req.url).searchParams.get("id") ?? "");
  return job ? json(publicJob(job)) : json({ error: "not found" }, 404);
}
