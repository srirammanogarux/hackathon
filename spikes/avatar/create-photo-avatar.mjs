// Photo -> HeyGen photo avatar look. Prints the look id to pass as avatar_id to render.mjs.
//
//   node --env-file-if-exists=../../.env create-photo-avatar.mjs <photo.jpg|https://...> [--name "Priya"]
//
// Flow (docs: developers.heygen.com/docs/avatar-from-photo):
//   local file -> POST /v3/assets (multipart) -> asset_id
//   POST /v3/avatars { type: "photo", name, file: {type:"asset_id"|"url", ...} } -> data.avatar_item.id (look id)
//   poll GET /v3/avatars/looks/{look_id} until status leaves "processing" (completed | failed)
import { writeFile, mkdir } from 'node:fs/promises';
import { apiKey, heygen, uploadAsset, isUrl, pollUntil, parseArgs } from './heygen.mjs';

apiKey();

const args = parseArgs(process.argv.slice(2));
const photo = args._[0];
if (!photo) {
  console.error('usage: create-photo-avatar.mjs <photo.jpg|png|https-url> [--name NAME]');
  process.exit(1);
}
const name = args.name ?? `studio-${Date.now()}`;

const t0 = Date.now();
const lap = () => `${((Date.now() - t0) / 1000).toFixed(1)}s`;

let file;
if (isUrl(photo)) {
  file = { type: 'url', url: photo };
} else {
  const assetId = await uploadAsset(photo);
  console.log(`uploaded photo -> asset ${assetId} (${lap()})`);
  file = { type: 'asset_id', asset_id: assetId };
}

const created = await heygen('POST', '/v3/avatars', { type: 'photo', name, file });
const lookId = created.avatar_item?.id;
const groupId = created.avatar_group?.id ?? created.avatar_item?.group_id;
if (!lookId) throw new Error(`no avatar_item.id in response: ${JSON.stringify(created)}`);
console.log(`created look ${lookId} (group ${groupId}) (${lap()})`);

const look = await pollUntil(
  'avatar look',
  () => heygen('GET', `/v3/avatars/looks/${lookId}`),
  (d) => d.status !== 'processing' && d.status !== 'pending' && d.status != null,
  { intervalMs: 5000, timeoutMs: 15 * 60_000 },
);

if (look.status !== 'completed') {
  console.error(`avatar ${look.status}:`, JSON.stringify(look.error ?? look));
  process.exit(1);
}

const result = {
  avatar_id: look.id,
  group_id: look.group_id ?? groupId,
  preview_image_url: look.preview_image_url,
  supported_api_engines: look.supported_api_engines,
  preferred_orientation: look.preferred_orientation,
  seconds_to_ready: (Date.now() - t0) / 1000,
};
await mkdir('out', { recursive: true });
await writeFile('out/avatar.json', JSON.stringify(result, null, 2));
console.log(`ready in ${lap()}`);
console.log(JSON.stringify(result, null, 2));
console.log(`\nnext: node --env-file-if-exists=../../.env render.mjs --avatar ${look.id} --audio <file.mp3>`);
