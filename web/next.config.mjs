import { existsSync } from "node:fs";
import path from "node:path";

// Keys live in the repo-root .env (shared with spikes/). Load it if present.
for (const f of [path.resolve(process.cwd(), "..", ".env"), path.resolve(process.cwd(), ".env")]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

/** @type {import('next').NextConfig} */
export default {
  agentRules: false,
  devIndicators: false,
  serverExternalPackages: ["playwright", "@anthropic-ai/sdk"],
  outputFileTracingIncludes: { "/api/**": ["./lib/fixtures/**", "./lib/media/fonts/**"] },
};
