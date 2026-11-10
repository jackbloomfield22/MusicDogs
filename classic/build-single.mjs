// Bundles the whole game into single self-contained HTML files:
//   dist/MusicDogsClassic.html   – double-click to play, works offline, easy to share
//   dist/MusicDogs.fragment.html – same game without <html>/<head>, for hosts that wrap pages themselves
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('.', import.meta.url);
const read = (p, enc = 'utf8') => readFile(new URL(p, root), enc);

const bundle = await build({
  entryPoints: [new URL('src/main.js', root).pathname],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2019',
  write: false,
  legalComments: 'none',
});
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');

const font = (await read('assets/fonts/Fredoka.woff2', null)).toString('base64');
const icon = (await read('assets/icons/icon-192.png', null)).toString('base64');
const css = (await read('css/style.css')).replace("url('../assets/fonts/Fredoka.woff2')", `url(data:font/woff2;base64,${font})`);
if (!css.includes('data:font/woff2')) throw new Error('Font was not inlined');

const html = await read('index.html');
const app = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->')).trim();
if (!app.includes('id="app"')) throw new Error('App markup not found in index.html');

const body = `${app}
<script>window.__MUSICDOGS_SINGLE_FILE = true;</script>
<script>${js}</script>`;

const standalone = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<title>MusicDogs</title>
<meta name="theme-color" content="#14102E">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<link rel="icon" type="image/png" href="data:image/png;base64,${icon}">
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>
`;

const fragment = `<title>MusicDogs</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
${body}
`;

const dist = new URL('../dist/', root);
await mkdir(dist, { recursive: true });
await writeFile(new URL('MusicDogsClassic.html', dist), standalone);
await writeFile(new URL('MusicDogs.fragment.html', dist), fragment);
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`dist/MusicDogsClassic.html    ${kb(standalone)}`);
console.log(`dist/MusicDogs.fragment.html  ${kb(fragment)}`);
