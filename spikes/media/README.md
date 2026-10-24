# Media pipeline spike

Plain Node ESM (`.mjs`), one dependency (`playwright`). Needs `ffmpeg`/`ffprobe` on PATH. Run everything from `spikes/media/`.

```bash
cd spikes/media
npm install                       # playwright 1.64; Chromium already cached on this Mac (else: npx playwright install chromium)
node src/render-all-carousels.mjs [hi kn ta te en]   # -> out/carousel-<lang>-<1..4>.jpg
node src/make-reel-demo.mjs [hi kn ta te en]         # -> out/reel-<lang>.mp4 (default: hi)
node --env-file-if-exists=../../.env src/tts-demo.mjs [--model eleven_v3] [--voice <id>] [hi kn ta te en]
node --env-file-if-exists=../../.env src/voice-clone.mjs "<name>" sample.mp3 [more.m4a]
```

`make-reel-demo` uses ElevenLabs audio and word timings automatically if `out/tts-<lang>.mp3` and `out/tts-<lang>.words.json` exist (run `tts-demo` first). Otherwise it falls back to macOS `say` plus evenly spread captions.

## Status (24 Oct, MacBook, Apple Silicon)

| Piece | Status | Timing |
|---|---|---|
| Carousel 1080x1350 JPEG, hi/kn/ta/te/en | **Verified.** Viewed the output. Conjuncts shape correctly: Devanagari प्रि, र्मा (reph), त्स, स्थ; Kannada ನ್ನಾ, ಕ್ಷ, ಯ್ಯ, ದ್ಧ; Tamil கொ (split vowel), க்கு, ஸ்ரீ; Telugu ప్మా, డ్డిం, ద్భు, స్వా, ష్ట | Chromium launch 0.9 s; 4 slides 0.46 to 1.2 s (about 120 to 300 ms per slide) |
| Reel 1080x1920 H.264/AAC 48k, 30 fps | **Verified** for all 5 languages plus a photo reel (`fit:'cover'`). Checked with ffprobe, full decode to null, and frames grabbed and viewed (Ken Burns, crossfade, captions) | 22 to 31 s reel builds in 10.6 to 15.3 s; 5 s reel in about 3 to 4 s |
| Captions from word timings | **Verified** with mock ElevenLabs char alignment -> words -> chunks -> burned in | |
| Captions with no timings | **Verified.** Words spread across the audio duration, weighted by length | |
| macOS `say` placeholder audio | **Verified.** Voices: Lekha hi, Soumya kn, Vani ta, Geeta te, Rishi en | 0.7 to 1.9 s |
| ElevenLabs TTS `/with-timestamps`, IVC, forced alignment | **Code written, never hit the real API.** There is no `.env` in the repo yet. Request and response handling ran against `src/mock-elevenlabs.mjs` only. Latency numbers come once a key exists | n/a |

Not verified against the real API:
- Whether the account has `eleven_v4`. `pickModel()` checks `/v1/models` and falls back to `eleven_v3`.
- Whether `eleven_v3` accepts `language_code`. The code retries without it on a 400 or 422.
- Whether `eleven_v3` supports `/with-timestamps`. `tts-demo` falls back to plain TTS plus `/v1/forced-alignment`.

## Design notes / gotchas

- **This ffmpeg build has no `drawtext`, `subtitles`, or libass.** Captions are rendered by Chromium as transparent full-frame PNGs, using the same fonts and HarfBuzz shaping as the slides. The concat demuxer then turns them into one timed overlay stream. This approach also avoids libass Indic shaping bugs.
- Fonts are Google Fonts variable woff2 files (weights 400 to 800) in `fonts/`, inlined as base64 so `page.setContent()` works with no server. The script font comes first in the stack and Noto Sans Latin covers digits, English and punctuation.
- Ken Burns uses `zoompan` on a 2x upscale, which cuts jitter. Zoom alternates in and out per image. Crossfades use `xfade` (0.5 s). Segment length is `(audio + 0.6 s tail + (n-1)*xfade) / n`.
- In `fit:'contain'` mode (carousel slides), the slide sits 140 px above centre over a blurred copy of itself. Captions go in the bottom band (`captionBottom` 250 px). In `fit:'cover'` mode (photos), captions sit at 420 px from the bottom, inside the Instagram safe area.
- Caption chunks hold at most 4 words or 26 chars, and they break at `. ! ? । , ; :`.
- Deploy: CPU-bound, about 0.4 to 0.5x realtime on an M-series Mac. Put it in a long-running Node worker, not a default 10 s serverless function. Instagram needs public JPEG and MP4 URLs, and the output already meets the Reels spec (H.264 High, yuv420p, AAC 48 kHz, faststart).

## Reusable API

```js
// src/carousel.mjs
renderCarousel(spec: {language:'hi'|'kn'|'ta'|'te'|'en', slides:{headline, body?}[], brand:{color, handle}},
               {outDir, prefix?}) => Promise<string[]>        // absolute JPEG paths
slideHtml(spec, index) => string                               // same HTML, e.g. for an <iframe srcdoc> preview

// src/reel.mjs
assembleReel({images, audio, out, language, words?, script?, fit?:'contain'|'cover',
              captionBottom?, fps?=30, crossfade?=0.5, zoom?=0.08, tail?=0.6, workDir?})
  => Promise<{out, duration, captions:{text,start,end}[], ms}>

// src/captions.mjs
evenWordTimings(script, durationSec) => {text,start,end}[]
charAlignmentToWords(elevenLabsAlignment) => {text,start,end}[]
wordsToCaptionChunks(words, {maxWords?=4, maxChars?=26}) => {text,start,end}[]
renderCaptionPngs(chunks, {language, outDir, bottom?}) => Promise<(chunk & {png})[]>

// src/elevenlabs.mjs (env ELEVENLABS_API_KEY, optional ELEVENLABS_VOICE_ID, ELEVENLABS_BASE_URL)
pickModel() => Promise<'eleven_v4'|'eleven_v3'|...>
ttsWithTimestamps({text, voiceId?, modelId?='eleven_v3', languageCode?, outputFormat?='mp3_44100_128'})
  => Promise<{audio:Buffer, words, alignment, modelId, latencyMs}>
tts({...same}) => Promise<{audio:Buffer, latencyMs}>
forcedAlignment({audio:Buffer, text, filename?}) => Promise<{words, latencyMs}>
createInstantVoiceClone({name, files:string[], description?, removeBackgroundNoise?=true})
  => Promise<{voice_id, requires_verification, latencyMs}>

// src/audio.mjs, src/ffmpeg.mjs, src/browser.mjs
sayToFile(text, outPath, {language?, voice?, rate?}) => Promise<string>   // macOS only
probeDuration(file) => Promise<number>
getBrowser() / closeBrowser() / screenshotHtml(html, {width, height, path, type?, quality?, transparent?})
```

Call `closeBrowser()` at the end of a script. A server should keep a single browser alive.

## Files

- `samples/carousels.json`: 4-slide test carousels. Dental tips in hi, ta and en; cooking tips in kn and te.
- `out/carousel-<lang>-<n>.jpg`, `out/reel-<lang>.mp4`, `out/reel-photos-cover.mp4`. `out/` is gitignored.
- `src/mock-elevenlabs.mjs`: offline mock for exercising the ElevenLabs code (`ELEVENLABS_BASE_URL=http://localhost:8787`).
