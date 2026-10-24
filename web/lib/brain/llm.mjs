// One structured-output call to Claude or Gemini, or a fixture when running in mock mode.
// Provider: Claude if ANTHROPIC_API_KEY is set, else Gemini if GEMINI_API_KEY is set.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";

export const MODEL = process.env.BRAIN_MODEL || "claude-sonnet-5-5";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

const provider = () =>
  process.env.ANTHROPIC_API_KEY ? "claude" : process.env.GEMINI_API_KEY ? "gemini" : null;

export const isMock = () => process.env.BRAIN_MOCK === "1" || !provider();

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
  return provider() === "gemini"
    ? callGemini({ name, system, user, schema })
    : callClaude({ name, system, user, schema, effort });
}

async function callClaude({ name, system, user, schema, effort }) {
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

async function callGemini({ name, system, user, schema }) {
  const started = Date.now();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(schema, { target: "draft-7" }),
        maxOutputTokens: 16000,
      },
    }),
  });
  if (!res.ok) throw new Error(`${name}: gemini ${res.status} ${(await res.text()).slice(0, 300)}`);

  const data = await res.json();
  const cand = data.candidates?.[0];
  const text = cand?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error(`${name}: gemini returned no text (${cand?.finishReason ?? data.promptFeedback?.blockReason})`);

  const u = data.usageMetadata ?? {};
  console.error(`[brain] ${name} gemini ${Date.now() - started}ms in=${u.promptTokenCount} out=${u.candidatesTokenCount}`);
  return schema.parse(JSON.parse(text));
}
