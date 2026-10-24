# Avatar spike: talking video for camera-shy users

A user uploads one selfie. We lip-sync our ElevenLabs voiceover onto it and get a 9:16 mp4 for a Reel.

Status: scripts are written against the HeyGen and D-ID docs as of 24 Oct 2026. **Not run end to end**, because there was no `HEYGEN_API_KEY` or `DID_API_KEY` in `.env`. A bogus key does get a structured `401 unauthorized` back from `POST /v3/videos` and `POST /v3/avatars`, so the endpoints and auth header are right.

## Files

| File | What it does |
| - | - |
| `heygen.mjs` | Small shared helper: fetch wrapper, asset upload, polling, download |
| `create-photo-avatar.mjs` | photo -> `POST /v3/assets` -> `POST /v3/avatars {type:"photo"}` -> poll `GET /v3/avatars/looks/{id}` until `completed`. Writes `out/avatar.json` |
| `render.mjs` | avatar look id (or a raw photo) + audio -> `POST /v3/videos` (9:16, 1080p) -> poll `GET /v3/videos/{id}` -> download mp4. Prints a timing table |
| `did-fallback.mjs` | Same job on D-ID `/talks` (image + audio_url) |

## Run

```bash
cd spikes/avatar
# 10-second test audio, if ElevenLabs isn't wired yet (macOS):
mkdir -p out && say -o out/t.aiff "Namaste! Aaj hum aapko dikhayenge ki hamare naye combo mein kya khaas hai. Sirf is hafte." \
  && ffmpeg -y -loglevel error -i out/t.aiff -t 10 out/test-10s.mp3

# Path A: make a reusable avatar (once per user), then render
node --env-file-if-exists=../../.env create-photo-avatar.mjs selfie.jpg --name "Priya"
node --env-file-if-exists=../../.env render.mjs --avatar <look_id> --audio out/test-10s.mp3

# Path B: skip avatar creation and animate the photo directly (type "image")
node --env-file-if-exists=../../.env render.mjs --image selfie.jpg --audio out/test-10s.mp3

# Fallback
node --env-file-if-exists=../../.env did-fallback.mjs --image selfie.jpg --audio out/test-10s.mp3
```

For the demo, Path B is probably enough. It's one API call, with no avatar training wait. Path A pays off when the same user makes many videos, because the look is reusable and supports Avatar V.

## What the docs confirm

- **Photo avatar:** `POST /v3/avatars` with `{type:"photo", name, file:{type:"url"|"asset_id"|"base64"}}`. The response's `avatar_item.id` is the `avatar_id`. Look status goes `processing` -> `completed` | `failed` (`training_failed`, `moderation_failed`). Photo avatars have **no consent step**, so getting the subject's permission is on us. Sources: [avatar-from-photo](https://developers.heygen.com/docs/avatar-from-photo.md), [get-avatar-look](https://developers.heygen.com/reference/get-avatar-look.md).
- **Bring your own audio:** `POST /v3/videos` with `type:"avatar"` or `type:"image"`, plus `audio_url` (public HTTPS) **or** `audio_asset_id` (MP3/WAV). Audio and `script` can't both be set. Video status goes `pending` -> `processing` -> `completed` | `failed`, and a completed video has a presigned `video_url`. Source: [audio-to-video](https://developers.heygen.com/audio-to-video.md).
- **9:16:** `aspect_ratio: "9:16"` is valid, as are `16:9`, `4:5`, `5:4`, `1:1` and `auto`. `resolution` takes `720p` or `1080p`.
- **Limits:** asset upload up to 32 MB. Avatar audio input up to 10 min. Pay-as-you-go: 10 concurrent renders and 10 write requests per second. Source: [usage-limits](https://developers.heygen.com/docs/usage-limits.md).
- **Auth:** `X-Api-Key` header. A key comes from the HeyGen API dashboard.

## Pay-as-you-go or Enterprise?

**Photo avatar plus custom audio works on pay-as-you-go.** Neither feature is marked Enterprise-only in the docs. The Enterprise-only items are burst concurrency, uploading or skipping digital-twin consent, and custom rate limits. Digital twin also works on pay-as-you-go, but the subject has to record consent through a 24h webcam link.

**Cost:** the docs' pricing table loads in the dashboard and isn't public, so these figures come from HeyGen's own blog ([best-ai-avatar-talking-head-apis](https://www.heygen.com/blog/best-ai-avatar-talking-head-apis), updated 20 Oct 2026):

- Avatar IV photo avatar: **$0.05/s, about $3/min**
- Avatar III digital twin: about $1/min
- Avatar V digital twin: about $4/min
- Photo avatar creation: $1 per call

The help center says there are no free API credits since Feb 2026, and you can top up any USD amount ([help article](https://help.heygen.com/en/articles/10060327-heygen-api-pricing-explained)). A 30-second Reel costs about $1.50. **Check the price in the dashboard after topping up.** The image-to-video (Path B) price is not published.

## D-ID fallback

`POST /images` and `POST /audios` (multipart, audio up to 6 MB) return temp URLs. `POST /talks {source_url, script:{type:"audio", audio_url}, config:{stitch:true}}` starts the job, and `GET /talks/{id}` shows its status (`done` comes with `result_url`). Auth is `Authorization: Basic <key from Studio>`. Output framing follows the source image, so use a portrait photo. Self-serve plans are bundles of minutes (Build 16, Launch 45, Scale 200); per-minute price not verified. Source: [docs.d-id.com](https://docs.d-id.com/reference/createtalk.md).

## Not yet verified

- Real render time. Run Path B with a 10 s clip as soon as a key exists, and note the `render s per video s` row.
- Indian-language lip-sync quality with ElevenLabs Hindi/Kannada audio.
- Whether HeyGen moderation rejects selfies of a non-account-holder. That is likely fine, since photo avatars have no consent step.
