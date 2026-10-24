// Instagram Login, step 1: send the creator to instagram.com/oauth/authorize.
// Without IG_APP_ID / IG_APP_SECRET we go straight to the callback in mock mode.
import { cookies } from "next/headers";
import { oauthAuthorizeUrl, oauthConfigured } from "@/lib/v2/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const creatorId = url.searchParams.get("creatorId") ?? "";
  const nonce = crypto.randomUUID();
  const state = Buffer.from(JSON.stringify({ creatorId, nonce })).toString("base64url");

  if (!oauthConfigured()) {
    const cb = new URL("/api/ig/oauth/callback", url);
    cb.searchParams.set("mock", "1");
    cb.searchParams.set("state", state);
    return Response.redirect(cb, 302);
  }
  (await cookies()).set("ig_oauth_nonce", nonce, { httpOnly: true, sameSite: "lax", secure: url.protocol === "https:", maxAge: 600, path: "/" });
  return Response.redirect(oauthAuthorizeUrl(state), 302);
}
