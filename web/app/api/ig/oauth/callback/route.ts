// Instagram Login, step 2: code → long-lived token → /me → igAccounts (encrypted) + creators.igUserId,
// then subscribe the account to webhooks. Mock mode links Sunita's seeded account.
import { cookies } from "next/headers";
import { ensureSeeded, getDb, logEvent } from "@/lib/v2/db";
import { exchangeCode, linkAccount, oauthConfigured, subscribeWebhooks } from "@/lib/v2/instagram";
import { getSunita } from "@/lib/v2/seed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const readState = (s: string | null): { creatorId?: string; nonce?: string } => {
  try {
    return JSON.parse(Buffer.from(s ?? "", "base64url").toString("utf8"));
  } catch {
    return {};
  }
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams;
  const done = (params: Record<string, string>) => Response.redirect(new URL(`/inbox?${new URLSearchParams(params)}`, url), 302);
  await ensureSeeded();
  const db = getDb();
  const state = readState(q.get("state"));
  const creator = (state.creatorId && (await db.get("creators", state.creatorId))) || (await getSunita(db));

  if (!oauthConfigured()) {
    const existing = await db.findOne("igAccounts", { creatorId: creator._id });
    if (!existing) {
      await linkAccount(creator._id, {
        igUserId: creator.igUserId ?? `mock_ig_${creator._id}`,
        username: creator.igUsername ?? creator.businessName.toLowerCase().replace(/\W+/g, "."),
        token: "mock-token",
        tokenExpiresAt: Date.now() + 60 * 24 * 3600_000,
        scopes: [],
      });
    }
    return done({ connected: "1", mock: "1" });
  }

  if (q.get("error")) return done({ connected: "0", error: q.get("error_description") ?? q.get("error")! });
  const jar = await cookies();
  if (!state.nonce || jar.get("ig_oauth_nonce")?.value !== state.nonce) return done({ connected: "0", error: "state_mismatch" });
  jar.delete("ig_oauth_nonce");

  try {
    const account = await exchangeCode(q.get("code") ?? "");
    await linkAccount(creator._id, account);
    const sub = await subscribeWebhooks(creator._id);
    return done({ connected: "1", ...(sub.ok ? {} : { webhooks: "0" }) });
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    await logEvent(creator._id, "error", { op: "ig_oauth", error });
    return done({ connected: "0", error });
  }
}
