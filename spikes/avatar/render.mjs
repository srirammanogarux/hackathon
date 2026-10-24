// Avatar (or any photo) + our ElevenLabs audio -> 9:16 lip-synced mp4. Logs timings.
//
//   node --env-file-if-exists=../../.env render.mjs --avatar <look_id> --audio voice.mp3
//   node --env-file-if-exists=../../.env render.mjs --image face.jpg  --audio voice.mp3   # no avatar step
//
// Options:
//   --audio  <file.mp3|wav | https-url>   required. Local files go through POST /v3/assets (<=32 MB).
//   --avatar <look_id>                    from create-photo-avatar.mjs (type "avatar")
//   --image  <file.jpg|png | https-url>   skip avatar creation, animate this photo directly (type "image")
//   --engine avatar_iv|avatar_v|avatar_iii  default: HeyGen default (Avatar IV)
//   --resolution 720p|1080p               default 1080p
//   --expressiveness low|medium|high      photo avatars on Avatar IV only
//   --motion "nods, warm smile"           motion_prompt
//   --out out/name.mp4
//
// Docs: developers.heygen.com/audio-to-video, /reference/create-video, /reference/get-video
import { apiKey, heygen, uploadAsset, isUrl, pollUntil, download, parseArgs } from './heygen.mjs';

apiKey();

const args = parseArgs(process.argv.slice(2));
if (!args.audio || (!args.avatar && !args.image)) {
  console.error('usage: render.mjs (--avatar LOOK_ID | --image PHOTO) --audio AUDIO [--engine ..] [--resolution 720p|1080p] [--out file.mp4]');
  process.exit(1);
}

const T = { start: Date.now() };
const secs = (a, b) => ((b - a) / 1000).toFixed(1);

const body = {
  title: `spike ${new Date().toISOString()}`,
  aspect_ratio: '9:16',
  resolution: args.resolution ?? '1080p',
  fit: 'cover',
};

if (args.avatar) {
  body.type = 'avatar';
  body.avatar_id = args.avatar;
  if (args.engine) body.engine = { type: args.engine };
  if (args.expressiveness) body.expressiveness = args.expressiveness;
} else {
  body.type = 'image';
  body.image = isUrl(args.image)
    ? { type: 'url', url: args.image }
    : { type: 'asset_id', asset_id: await uploadAsset(args.image) };
}
if (args.motion) body.motion_prompt = args.motion;

if (isUrl(args.audio)) body.audio_url = args.audio;
else body.audio_asset_id = await uploadAsset(args.audio);
T.uploaded = Date.now();

const { video_id } = await heygen('POST', '/v3/videos', body);
T.submitted = Date.now();
console.log(`video ${video_id} submitted (upload ${secs(T.start, T.uploaded)}s, submit ${secs(T.uploaded, T.submitted)}s)`);

const video = await pollUntil(
  'video',
  () => heygen('GET', `/v3/videos/${video_id}`),
  (d) => d.status === 'completed' || d.status === 'failed',
  { intervalMs: 5000, timeoutMs: 30 * 60_000 },
);
T.rendered = Date.now();

if (video.status === 'failed') {
  console.error(`render failed: ${video.failure_code} ${video.failure_message}`);
  process.exit(1);
}

const out = args.out ?? `out/${video_id}.mp4`;
await download(video.video_url, out);
T.downloaded = Date.now();

const renderS = (T.rendered - T.submitted) / 1000;
console.log(`\nsaved ${out}`);
console.table({
  'upload (s)': secs(T.start, T.uploaded),
  'submit (s)': secs(T.uploaded, T.submitted),
  'render wait (s)': renderS.toFixed(1),
  'download (s)': secs(T.rendered, T.downloaded),
  'total (s)': secs(T.start, T.downloaded),
  'video duration (s)': video.duration,
  'render s per video s': video.duration ? (renderS / video.duration).toFixed(1) : 'n/a',
});
