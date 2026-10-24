// Publish to our own IG professional account via the Content Publishing API (Facebook Login variant).
//
//   node --env-file-if-exists=../../.env publish.mjs <kind> <media...> [--caption "..."] [--ai] [--create | --publish]
//
//   kind: image    <jpeg>                     single feed image (JPEG only)
//         carousel <jpeg|mp4> <jpeg|mp4> ... 2-20 items, parent gets caption + is_ai_generated
//         reel     <mp4>  [--cover <jpeg>] [--no-feed]
//         story    <jpeg|mp4>
//
//   media: public https URL, or a local path. Local paths become ${PUBLIC_MEDIA_BASE_URL}/<filename>
//          (you must have uploaded the file there). A local reel with no PUBLIC_MEDIA_BASE_URL is sent
//          with resumable upload to rupload.facebook.com, so no hosting is needed.
//   --ai       sets is_ai_generated=true on the top-level container (carousel: parent only; children error)
//
// Safety: default is a DRY RUN that prints the requests and touches nothing.
//   --create   creates containers and waits for status_code FINISHED, but does NOT publish
//              (unpublished containers expire after 24h).
//   --publish  creates + publishes. This posts publicly on the account in IG_USER_ID.
import { readFile, stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { graph, env, requireEnv, parseArgs, VERSION } from './graph.mjs';

const args = parseArgs(process.argv.slice(2));
const [kind, ...media] = args._;
const KINDS = ['image', 'carousel', 'reel', 'story'];
if (!KINDS.includes(kind) || media.length === 0) {
  console.error(`usage: publish.mjs ${KINDS.join('|')} <media...> [--caption ".."] [--ai] [--create|--publish]`);
  process.exit(1);
}
if (kind === 'carousel' && (media.length < 2 || media.length > 20)) {
  console.error('carousel needs 2-20 items');
  process.exit(1);
}

const mode = args.publish ? 'publish' : args.create ? 'create' : 'dry-run';
const caption = args.caption;
const ai = args.ai ? 'true' : undefined;
const isVideo = (m) => /\.(mp4|mov)(\?|$)/i.test(m);
const isUrl = (m) => /^https?:\/\//.test(m);

function publicUrl(m) {
  if (isUrl(m)) return m;
  const base = process.env.PUBLIC_MEDIA_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, '')}/${encodeURIComponent(basename(m))}`;
}
function mustUrl(m) {
  const u = publicUrl(m);
  if (!u) {
    console.error(`"${m}" is a local file. Upload it somewhere public and pass the URL, or set PUBLIC_MEDIA_BASE_URL (see README).`);
    process.exit(1);
  }
  if (!isVideo(m) && !/\.jpe?g(\?|$)/i.test(m)) console.warn(`warning: ${m} is not .jpg. IG accepts JPEG only for images.`);
  return u;
}

// ---- plan: list of container-creation calls, in order ----
const plan = [];
if (kind === 'image') {
  plan.push({ role: 'single', params: { image_url: mustUrl(media[0]), caption, is_ai_generated: ai } });
} else if (kind === 'story') {
  const m = media[0];
  plan.push({ role: 'single', params: { media_type: 'STORIES', [isVideo(m) ? 'video_url' : 'image_url']: mustUrl(m), is_ai_generated: ai } });
} else if (kind === 'reel') {
  const m = media[0];
  const url = publicUrl(m);
  const params = {
    media_type: 'REELS',
    caption,
    share_to_feed: args['no-feed'] ? 'false' : 'true',
    cover_url: args.cover ? mustUrl(args.cover) : undefined,
    is_ai_generated: ai,
  };
  if (url) params.video_url = url;
  else params.upload_type = 'resumable';
  plan.push({ role: 'single', params, localFile: url ? null : m });
} else {
  for (const m of media) {
    const p = { is_carousel_item: 'true' };
    if (isVideo(m)) Object.assign(p, { media_type: 'VIDEO', video_url: mustUrl(m) });
    else p.image_url = mustUrl(m);
    plan.push({ role: 'child', params: p });
  }
  plan.push({ role: 'parent', params: { media_type: 'CAROUSEL', caption, is_ai_generated: ai } });
}

const clean = (p) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== undefined));

if (mode === 'dry-run') {
  const uid = env()?.userId ?? '{IG_USER_ID}';
  console.log(`DRY RUN (${kind}). Nothing sent. Add --create to make containers, --publish to post.\n`);
  for (const step of plan) {
    const p = clean(step.params);
    if (step.role === 'parent') p.children = '<child ids>';
    console.log(`POST /${VERSION}/${uid}/media  ${JSON.stringify(p)}`);
    if (step.localFile) console.log(`POST https://rupload.facebook.com/ig-api-upload/${VERSION}/<container id>  (bytes of ${step.localFile})`);
  }
  console.log(`GET  /<container id>?fields=status_code,status   until FINISHED`);
  console.log(`POST /${VERSION}/${uid}/media_publish  {"creation_id":"<container id>"}`);
  process.exit(0);
}

const { userId, token } = requireEnv();
const t0 = Date.now();
const lap = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

async function waitFinished(id) {
  for (let i = 0; ; i++) {
    const { status_code, status } = await graph('GET', `/${id}`, { fields: 'status_code,status' });
    console.log(`  [${lap()}] ${id}: ${status_code}${status && status !== status_code ? ` (${status})` : ''}`);
    if (status_code === 'FINISHED') return;
    if (status_code === 'ERROR' || status_code === 'EXPIRED') throw new Error(`container ${id} ${status_code}: ${status}`);
    if (i > 60) throw new Error(`container ${id} not FINISHED after ${lap()}`);
    await new Promise((r) => setTimeout(r, 5000));
  }
}

async function resumableUpload(containerId, file) {
  const bytes = await readFile(file);
  const res = await fetch(`https://rupload.facebook.com/ig-api-upload/${VERSION}/${containerId}`, {
    method: 'POST',
    headers: { Authorization: `OAuth ${token}`, offset: '0', file_size: String((await stat(file)).size) },
    body: bytes,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(`rupload -> ${res.status} ${JSON.stringify(json)}`);
  console.log(`  uploaded ${file} (${(bytes.length / 1e6).toFixed(1)} MB) ${lap()}`);
}

const children = [];
let creationId;
for (const step of plan) {
  const params = clean(step.params);
  if (step.role === 'parent') params.children = children.join(',');
  const { id } = await graph('POST', `/${userId}/media`, params);
  console.log(`container ${step.role} ${id} (${lap()})`);
  if (step.localFile) await resumableUpload(id, step.localFile);
  await waitFinished(id);
  if (step.role === 'child') children.push(id);
  else creationId = id;
}

if (mode === 'create') {
  console.log(`\ncontainer ${creationId} is FINISHED and unpublished (expires in 24h). Re-run with --publish to post.`);
  process.exit(0);
}

const limit = await graph('GET', `/${userId}/content_publishing_limit`, { fields: 'config,quota_usage' }).catch(() => null);
if (limit?.data?.[0]) {
  const { quota_usage, config } = limit.data[0];
  console.log(`quota: ${quota_usage}/${config?.quota_total} posts in last 24h`);
}

const { id: mediaId } = await graph('POST', `/${userId}/media_publish`, { creation_id: creationId });
const { permalink } = await graph('GET', `/${mediaId}`, { fields: 'permalink' }).catch(() => ({}));
console.log(`\nPUBLISHED ${kind} media ${mediaId} in ${lap()}  ${permalink ?? ''}`);
