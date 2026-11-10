// Renders the app icons from the real 3D pup.
// Usage: start the dev server (npm start), then `node tools/make-icons.mjs [port]`.
// Requires Playwright (not a project dependency; only needed to regenerate icons).
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = process.argv[2] || 8080;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [name, size] of [['icon-512.png', 512], ['icon-192.png', 192], ['apple-touch-icon.png', 180]]) {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 });
  await page.goto(`http://localhost:${port}/tools/viewer.html?levels=1,1,0,1&az=0.6&el=0.14&zoom=0.52&happy=1&icon=1`);
  await page.waitForFunction(() => window.__ready);
  await page.waitForTimeout(2500);
  await writeFile(new URL(`../assets/icons/${name}`, import.meta.url), await page.screenshot());
  console.log('wrote', name);
  await page.close();
}
await browser.close();
