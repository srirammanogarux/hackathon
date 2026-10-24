import { getOrder } from "@/lib/plural.mjs";
import { has, json, errorJson } from "@/lib/server";

// GET ?order_id= -> { status, paid }. PROCESSED = paid.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("order_id") ?? "";
  if (id.startsWith("mock-") || !has.pine()) return json({ status: "PROCESSED", paid: true, mock: true });
  try {
    const r = await getOrder(id);
    const status = r?.data?.status ?? "UNKNOWN";
    return json({ status, paid: status === "PROCESSED" });
  } catch (e) {
    return errorJson(e);
  }
}
