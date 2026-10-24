# Instagram spike: publish and Business Discovery

Status: scripts are written against Meta's docs as of 24 Oct 2026 (Graph API **v26.0**). **Not run against a real account**, because `.env` had no `IG_USER_ID` or `IG_ACCESS_TOKEN`. A bad token gets the expected `OAuthException code=190` back from graph.facebook.com/v26.0. The dry-run output for all four post types checks out.

Setup click-path: **[SETUP.md](SETUP.md)**.

## Files

| File | What it does |
| - | - |
| `graph.mjs` | Fetch wrapper for graph.facebook.com, arg parser |
| `publish.mjs` | image, carousel, reel and story. **Dry run by default.** `--create` makes containers only. `--publish` posts |
| `discover.mjs` | Business Discovery for a username: recent media, then the top 5 ranked by `likes + 3*comments`. Writes `out/discover-<user>.json` |

## Run

```bash
cd spikes/instagram
E=--env-file-if-exists=../../.env
node $E discover.mjs some_creator                         # read-only

node $E publish.mjs image    https://host/p1.jpg --caption "..." --ai           # prints plan only
node $E publish.mjs carousel https://host/1.jpg https://host/2.jpg --caption "..." --ai --create
node $E publish.mjs reel     ./out/reel.mp4 --caption "..." --ai --publish    # local file -> resumable upload
node $E publish.mjs story    https://host/story.jpg --publish
```

`--ai` sets `is_ai_generated=true`. On a carousel it goes on the parent only, because Meta returns an error if it's on the children.

## API facts, verified in the docs

- **Flow:** `POST /{ig-user-id}/media` creates a container. Poll `GET /{container}?fields=status_code` until it shows `FINISHED`; other values are `IN_PROGRESS`, `ERROR`, `EXPIRED` (24h) and `PUBLISHED`. Then `POST /{ig-user-id}/media_publish?creation_id=...`.
- **Image:** `image_url`, JPEG only, up to 8 MB, aspect ratio 4:5 to 1.91:1, 320 to 1440 px wide.
- **Carousel:** up to 20 children with `is_carousel_item=true`. Images and videos can be mixed. Children have no caption. Every item is cropped to the first item's aspect ratio. The parent is `media_type=CAROUSEL&children=a,b,c`.
- **Reel:** `media_type=REELS`, `video_url`, `share_to_feed`, `cover_url` or `thumb_offset`.
  - Video: MP4 or MOV with the moov atom at the front, H.264, 23 to 60 fps, AAC audio.
  - 3 s to 15 min, up to 300 MB, 9:16.
  - When rendering with ffmpeg, use `-movflags +faststart -c:v libx264 -c:a aac -r 30`.
- **Resumable upload (Facebook Login only):** create the container with `upload_type=resumable`, then `POST https://rupload.facebook.com/ig-api-upload/v26.0/{id}` with headers `Authorization: OAuth <token>`, `offset: 0`, `file_size` and the raw bytes. This means **reels don't need public hosting**. `publish.mjs` uses it automatically for a local reel when `PUBLIC_MEDIA_BASE_URL` is unset.
- **Story:** `media_type=STORIES` with `image_url` or `video_url`. Video 3 to 60 s, up to 100 MB.
- **Rate limit:** the docs disagree, saying 50 in one place and 100 in another. Read `GET /{ig-user-id}/content_publishing_limit` at runtime; `publish.mjs` prints it. Treat 50 posts per 24h as the safe figure.
- **Business Discovery:** `GET /{ig-user-id}?fields=business_discovery.username(X){followers_count,media_count,media{caption,like_count,comments_count,media_type,permalink,timestamp,view_count}}`.
  - Only works on business or creator targets.
  - `like_count` is missing when the owner hides likes.
  - `discover.mjs` retries without `view_count` if the API rejects that field.

## Hosting media: quickest options

IG fetches `image_url` and `video_url` itself, so the URL must be public HTTPS with no auth and no interstitial page.

1. **Reels: no hosting.** Pass a local mp4 and resumable upload sends the bytes. A HeyGen `video_url` is also a public presigned URL and can be passed straight in while it's valid.
2. **Images, for the spike:** serve the output folder through a Cloudflare quick tunnel. It needs no account and shows no interstitial page. ngrok free shows a browser warning page, so avoid it.
   ```bash
   npx serve ../media/out -l 8080 &   # or: python3 -m http.server 8080 -d ../media/out
   cloudflared tunnel --url http://localhost:8080        # brew install cloudflared
   # put the printed https://xxxx.trycloudflare.com in .env as PUBLIC_MEDIA_BASE_URL
   node --env-file-if-exists=../../.env publish.mjs carousel ../media/out/carousel-hi-1.jpg ../media/out/carousel-hi-2.jpg --create
   ```
3. **In the deployed app:** don't use `/public`. On Vercel it's frozen at build time, so runtime renders can't be written there. Put renders in a **public object bucket** and pass the URL:
   - Vercel Blob: `put(name, buf, { access: 'public' })`
   - or a Supabase Storage public bucket
   - or Cloudflare R2 with its public dev URL

## Not verified

- That Business Discovery works in Development mode for app-role users. Expected yes with Standard Access, but not confirmed.
- That Graph API Explorer lists `instagram_content_publish` before the use-case permissions are added. SETUP step 3.7 adds them first to avoid the question.
- `is_ai_generated` on STORIES and REELS. The docs mention it for container creation in general. Check the "AI info" label in the app after the first post.
