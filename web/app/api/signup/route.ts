import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const url = process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.CONVEX_URL;

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim().slice(0, 80);
  const email = String(b.email ?? "").trim().slice(0, 120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Please enter your name and a valid email." }, { status: 400 });
  }
  if (!url) return Response.json({ ok: false, error: "Signups are not configured." }, { status: 500 });
  const client = new ConvexHttpClient(url);
  const res = await client.mutation(api.signups.add, {
    name,
    email,
    source: b.source ? String(b.source).slice(0, 60) : undefined,
    userAgent: req.headers.get("user-agent")?.slice(0, 200) ?? undefined,
  });
  return Response.json({ ok: true, ...res });
}

export async function GET() {
  if (!url) return Response.json({ count: 0 });
  const client = new ConvexHttpClient(url);
  return Response.json({ count: await client.query(api.signups.count, {}) });
}
