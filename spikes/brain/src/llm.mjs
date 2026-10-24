// One structured-output call to Claude, or a fixture when running in mock mode.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";

export const MODEL = process.env.BRAIN_MODEL || "claude-sonnet-5-5";

export const isMock = () => process.env.BRAIN_MOCK === "1" || !process.env.ANTHROPIC_API_KEY;

let client;
const getClient = () => (client ??= new Anthropic());

/**
 * @param {object} o
 * @param {string} o.name      label for logs/errors
 * @param {string} o.system
 * @param {string} o.user
 * @param {import('zod').ZodType} o.schema
 * @param {"low"|"medium"|"high"} [o.effort]
 * @param {() => unknown} o.mock  returns fixture output when in mock mode
 */
export async function callStructured({ name, system, user, schema, effort = "low", mock }) {
  if (isMock()) return schema.parse(mock());

  const started = Date.now();
  const useFallback = process.env.BRAIN_NO_FALLBACK !== "1";
  const res = await getClient().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system,
    messages: [{ role: "user", content: user }],
    output_config: { effort, format: betaZodOutputFormat(schema) },
    // Server-side fallback: if Sonnet 5.5's classifiers decline (rare false
    // positive, e.g. dental/medical wording), the API reroutes inside this call.
    ...(useFallback ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {}),
  });

  if (res.stop_reason === "refusal") {
    throw new Error(`${name}: refused (${res.stop_details?.category ?? "unknown"})`);
  }
  if (res.stop_reason === "max_tokens") throw new Error(`${name}: hit max_tokens`);
  if (!res.parsed_output) throw new Error(`${name}: no parsed output`);

  const u = res.usage;
  console.error(`[brain] ${name} ${Date.now() - started}ms in=${u.input_tokens} out=${u.output_tokens}`);
  return res.parsed_output;
}
