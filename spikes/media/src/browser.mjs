import { chromium } from 'playwright';

let browserPromise;
/** Shared headless Chromium. Call closeBrowser() when the process is done. */
export function getBrowser() {
  browserPromise ??= chromium.launch();
  return browserPromise;
}
export async function closeBrowser() {
  if (!browserPromise) return;
  const b = await browserPromise;
  browserPromise = undefined;
  await b.close();
}

/**
 * Render an HTML string to an image file.
 * @param {string} html
 * @param {{width:number,height:number,path:string,type?:'jpeg'|'png',quality?:number,transparent?:boolean}} opts
 */
export async function screenshotHtml(html, { width, height, path, type = 'jpeg', quality = 90, transparent = false }) {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  try {
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({
      path,
      type,
      ...(type === 'jpeg' ? { quality } : {}),
      omitBackground: transparent,
      clip: { x: 0, y: 0, width, height },
    });
  } finally {
    await page.close();
  }
  return path;
}
