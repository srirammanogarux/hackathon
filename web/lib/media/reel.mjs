// Reel assembler: images + audio (+ word timings or script) -> 1080x1920 H.264/AAC MP4.
// Ken Burns via zoompan (on a 2x upscale to avoid jitter), xfade crossfades,
// captions rendered by Chromium as transparent PNGs and overlaid (no libass/drawtext needed).
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { run, probeDuration } from './ffmpeg.mjs';
import { evenWordTimings, wordsToCaptionChunks, renderCaptionPngs } from './captions.mjs';

export const REEL_W = 1080;
export const REEL_H = 1920;
const SLIDE_SHIFT_UP = 140; // 'contain' mode: 4:5 slide spans y=145..1495


/** Compose any image onto a 1080x1920 frame: 'contain' over a blurred copy, or 'cover' crop. */
async function composeFrame(src, dst, fit) {
  const vf =
    fit === 'cover'
      ? `scale=${REEL_W}:${REEL_H}:force_original_aspect_ratio=increase,crop=${REEL_W}:${REEL_H}`
      : `split[a][b];[a]scale=${REEL_W}:${REEL_H}:force_original_aspect_ratio=increase,crop=${REEL_W}:${REEL_H},gblur=sigma=40,eq=brightness=-0.12[bg];` +
        `[b]scale=${REEL_W}:${REEL_H}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2-${SLIDE_SHIFT_UP}`; // slide sits high; captions use the bottom band
  await run('ffmpeg', ['-y', '-v', 'error', '-i', src, '-filter_complex', vf, '-frames:v', '1', '-q:v', '2', dst]);
  return dst;
}

/**
 * @param {{
 *   images: string[],            // slides or photos, any aspect
 *   audio: string,               // narration (mp3/m4a/wav)
 *   out: string,                 // output .mp4
 *   language: 'hi'|'kn'|'ta'|'te'|'en',
 *   words?: {text:string,start:number,end:number}[], // word timings (e.g. from ElevenLabs)
 *   script?: string,             // used for evenly-spread captions when words is absent
 *   fit?: 'contain'|'cover',     // 'contain' for carousel slides, 'cover' for photos
 *   captionBottom?: number,      // px from bottom edge to caption box (default 250 contain / 420 cover)
 *   fps?: number, crossfade?: number, zoom?: number, tail?: number, workDir?: string,
 * }} o
 * @returns {Promise<{out:string, duration:number, captions:{text:string,start:number,end:number}[], ms:number}>}
 */
export async function assembleReel(o) {
  const t0 = performance.now();
  const { images, audio, out, language, fit = 'contain', fps = 30, crossfade = 0.5, zoom = 0.08, tail = 0.6 } = o;
  const workDir = path.resolve(o.workDir ?? path.join(path.dirname(out), `.work-${path.basename(out, '.mp4')}`));
  await mkdir(workDir, { recursive: true });

  const audioDur = await probeDuration(audio);
  const total = audioDur + tail;
  const n = images.length;
  const seg = (total + (n - 1) * crossfade) / n; // each segment length incl. overlap
  const segFrames = Math.ceil(seg * fps);

  // 1. Compose frames.
  const frames = await Promise.all(images.map((img, i) => composeFrame(img, path.join(workDir, `frame-${i}.jpg`), fit)));

  // 2. Captions.
  if (!o.words && !o.script) throw new Error('assembleReel needs words or script for captions');
  const words = o.words ?? evenWordTimings(o.script, audioDur);
  const chunks = wordsToCaptionChunks(words);
  const caps = await renderCaptionPngs(chunks, { language, outDir: path.join(workDir, 'captions'), bottom: o.captionBottom ?? (fit === 'cover' ? 420 : 250) });
  const blank = path.join(workDir, 'blank.png');
  await run('ffmpeg', ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x00000000:s=${REEL_W}x${REEL_H},format=rgba`, '-frames:v', '1', blank]);
  const list = [];
  let t = 0;
  const push = (file, dur) => dur > 0.001 && list.push(`file '${file}'\nduration ${dur.toFixed(3)}`);
  for (let i = 0; i < caps.length; i++) {
    const c = caps[i];
    push(blank, c.start - t);
    const end = i < caps.length - 1 ? Math.min(c.end, caps[i + 1].start) : Math.min(c.end + 0.3, total);
    push(c.png, end - Math.max(t, c.start));
    t = end;
  }
  push(blank, total - t);
  list.push(`file '${blank}'`); // concat demuxer quirk: last entry repeated without duration
  const capList = path.join(workDir, 'captions.txt');
  await writeFile(capList, list.join('\n') + '\n');

  // 3. One ffmpeg pass.
  const args = ['-y', '-v', 'error'];
  for (const f of frames) args.push('-loop', '1', '-framerate', String(fps), '-t', seg.toFixed(3), '-i', f);
  args.push('-i', audio);
  args.push('-f', 'concat', '-safe', '0', '-i', capList);
  const aIdx = n, cIdx = n + 1;

  const g = [];
  for (let i = 0; i < n; i++) {
    const zIn = i % 2 === 0; // alternate zoom in / zoom out
    const z = zIn ? `1+${zoom}*in/${segFrames}` : `1+${zoom}-${zoom}*in/${segFrames}`;
    g.push(
      `[${i}:v]scale=${REEL_W * 2}:${REEL_H * 2},zoompan=z='${z}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${REEL_W}x${REEL_H}:fps=${fps},setsar=1,format=yuv420p[v${i}]`,
    );
  }
  let last = 'v0';
  for (let i = 1; i < n; i++) {
    const offset = (i * (seg - crossfade)).toFixed(3);
    g.push(`[${last}][v${i}]xfade=transition=fade:duration=${crossfade}:offset=${offset}[x${i}]`);
    last = `x${i}`;
  }
  g.push(`[${cIdx}:v]format=rgba[cap]`);
  g.push(`[${last}][cap]overlay=0:0:format=auto:eof_action=repeat,format=yuv420p[vout]`);
  g.push(`[${aIdx}:a]aresample=48000,apad[aout]`);

  args.push('-filter_complex', g.join(';'), '-map', '[vout]', '-map', '[aout]');
  args.push('-t', total.toFixed(3), '-r', String(fps));
  args.push('-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-profile:v', 'high');
  args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-movflags', '+faststart', out);
  await run('ffmpeg', args);

  return { out, duration: await probeDuration(out), captions: chunks, ms: Math.round(performance.now() - t0) };
}
