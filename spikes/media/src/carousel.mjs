// Carousel renderer: JSON spec -> 1080x1350 JPEG slides via Playwright Chromium (HarfBuzz shaping).
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fontFaceCss, fontStack } from './fonts.mjs';
import { screenshotHtml } from './browser.mjs';

export const SLIDE_W = 1080;
export const SLIDE_H = 1350;

const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * @typedef {{language:'hi'|'kn'|'ta'|'te'|'en', slides:{headline:string, body?:string}[], brand:{color:string, handle:string}}} CarouselSpec
 */

/** HTML for one slide. Exported so the Next.js app can preview it in an iframe. */
export function slideHtml(spec, index) {
  const { language, slides, brand } = spec;
  const slide = slides[index];
  const isCover = index === 0;
  const total = slides.length;
  const dots = slides.map((_, i) => `<span class="dot${i === index ? ' on' : ''}"></span>`).join('');
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>
${fontFaceCss()}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${SLIDE_W}px;height:${SLIDE_H}px}
body{font-family:${fontStack(language)};background:${isCover ? brand.color : '#FBF8F3'};color:${isCover ? '#fff' : '#1d1d1f'};
  display:flex;flex-direction:column;padding:96px 88px 72px;-webkit-font-smoothing:antialiased}
.top{display:flex;justify-content:space-between;align-items:center;font-family:'NotoLatin',sans-serif;font-size:30px;font-weight:600;opacity:.8}
.num{background:${isCover ? 'rgba(255,255,255,.18)' : brand.color};color:#fff;border-radius:999px;padding:8px 22px}
.main{flex:1;display:flex;flex-direction:column;justify-content:center;gap:44px}
h1{font-size:${isCover ? 96 : 76}px;line-height:1.3;font-weight:800;text-wrap:balance}
.bar{width:120px;height:12px;border-radius:6px;background:${isCover ? '#fff' : brand.color}}
p{font-size:${isCover ? 44 : 46}px;line-height:1.55;font-weight:500;opacity:${isCover ? 0.92 : 0.85};text-wrap:pretty}
.foot{display:flex;justify-content:space-between;align-items:center;font-family:'NotoLatin',sans-serif;font-size:32px;font-weight:700}
.dots{display:flex;gap:12px}
.dot{width:14px;height:14px;border-radius:7px;background:${isCover ? 'rgba(255,255,255,.35)' : 'rgba(0,0,0,.15)'}}
.dot.on{background:${isCover ? '#fff' : brand.color};width:40px}
</style></head><body>
<div class="top"><span>${esc(brand.handle)}</span><span class="num">${index + 1}/${total}</span></div>
<div class="main"><h1>${esc(slide.headline)}</h1><div class="bar"></div>${slide.body ? `<p>${esc(slide.body)}</p>` : ''}</div>
<div class="foot"><span>${isCover ? 'Swipe →' : esc(brand.handle)}</span><div class="dots">${dots}</div></div>
</body></html>`;
}

/**
 * Render every slide of a carousel to JPEG.
 * @param {CarouselSpec} spec
 * @param {{outDir:string, prefix?:string}} opts
 * @returns {Promise<string[]>} absolute JPEG paths in slide order
 */
export async function renderCarousel(spec, { outDir, prefix = `carousel-${spec.language}` }) {
  await mkdir(outDir, { recursive: true });
  const paths = [];
  for (let i = 0; i < spec.slides.length; i++) {
    const p = path.resolve(outDir, `${prefix}-${i + 1}.jpg`);
    await screenshotHtml(slideHtml(spec, i), { width: SLIDE_W, height: SLIDE_H, path: p, type: 'jpeg', quality: 92 });
    paths.push(p);
  }
  return paths;
}
