// Token encryption at rest (igAccounts.accessToken). AES-256-GCM, key = sha256(V2_ENC_KEY).
// Without V2_ENC_KEY (mock / local dev) tokens are stored as "plain:<token>" so it's obvious
// they aren't protected. decrypt() also accepts bare legacy strings (e.g. the seed's "mock-token").
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENC = "enc:v1:";
const PLAIN = "plain:";

const key = () => {
  const k = process.env.V2_ENC_KEY;
  return k ? createHash("sha256").update(k).digest() : null;
};

export const isEncrypted = (stored: string) => stored.startsWith(ENC);

export function encrypt(plain: string): string {
  const k = key();
  if (!k) return PLAIN + plain;
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", k, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ENC + [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(stored: string): string {
  if (stored.startsWith(PLAIN)) return stored.slice(PLAIN.length);
  if (!stored.startsWith(ENC)) return stored;
  const k = key();
  if (!k) throw new Error("decrypt: token is encrypted but V2_ENC_KEY is not set");
  const [iv, tag, ct] = stored.slice(ENC.length).split(".").map((s) => Buffer.from(s, "base64url"));
  const d = createDecipheriv("aes-256-gcm", k, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}
