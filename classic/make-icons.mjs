// Renders the app icons from the game's own dog art.
// Usage: start the dev server (npm start), then `node tools/make-icons.mjs [port]`.
// Requires Playwright (not a project dependency; only needed to regenerate icons).
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const port = process.argv[2] || 8080;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/classic/`);
const icons = await page.evaluate(async () => {
  const { DogActor, drawDogHead, LANE_COLORS } = await import('/classic/src/render/dogs.js');
  const make = (size) => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(size / 2, size * 0.42, size * 0.05, size / 2, size / 2, size * 0.75);
    g.addColorStop(0, '#5B33C9');
    g.addColorStop(0.6, '#2A1670');
    g.addColorStop(1, '#14102E');
    c.fillStyle = g;
    c.fillRect(0, 0, size, size);
    // sunburst
    c.save();
    c.translate(size / 2, size * 0.52);
    for (let i = 0; i < 12; i++) {
      c.rotate(Math.PI / 6);
      c.fillStyle = i % 2 ? 'rgba(255,210,63,0.16)' : 'rgba(255,95,168,0.14)';
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(size, -size * 0.27);
      c.lineTo(size, size * 0.27);
      c.closePath();
      c.fill();
    }
    c.restore();
    c.fillStyle = '#FFD23F';
    c.beginPath();
    c.arc(size / 2, size * 0.55, size * 0.3, 0, Math.PI * 2);
    c.fill();
    const dog = new DogActor(0);
    dog.happy = 1;
    dog.wag = 0;
    // clip away the paws/collar so only the head shows
    c.save();
    c.beginPath();
    c.rect(0, 0, size, size * 0.745);
    c.clip();
    drawDogHead(c, dog, size / 2, size * 0.56, size * 0.215, 0, LANE_COLORS[0], 9);
    c.restore();
    // music note
    const s = size * 0.085;
    c.save();
    c.translate(size * 0.79, size * 0.27);
    c.rotate(0.2);
    c.fillStyle = '#FFFFFF';
    c.strokeStyle = '#FFFFFF';
    c.lineWidth = s * 0.34;
    c.lineCap = 'round';
    c.beginPath();
    c.ellipse(-s * 0.2, s * 0.5, s * 0.5, s * 0.38, -0.35, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(s * 0.2, s * 0.42);
    c.lineTo(s * 0.2, -s * 1.1);
    c.quadraticCurveTo(s * 0.7, -s * 0.9, s * 0.95, -s * 0.25);
    c.stroke();
    c.restore();
    return cv.toDataURL('image/png').split(',')[1];
  };
  return { 'icon-512.png': make(512), 'icon-192.png': make(192), 'apple-touch-icon.png': make(180) };
});
for (const [name, b64] of Object.entries(icons)) {
  await writeFile(new URL(`./assets/icons/${name}`, import.meta.url), Buffer.from(b64, 'base64'));
  console.log('wrote', name);
}
await browser.close();
