import os from "node:os";
import path from "node:path";
import { mkdirSync } from "node:fs";

export const MEDIA_DIR = path.join(os.tmpdir(), "saathi-media");
mkdirSync(MEDIA_DIR, { recursive: true });
export const mediaUrl = (file: string) => `/api/media/${encodeURIComponent(path.basename(file))}`;
