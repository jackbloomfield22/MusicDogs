// Bundles the 3D game into single self-contained HTML files:
//   dist/MusicDogs.html          – double-click to play, works offline (three.js bundled in)
//   dist/MusicDogs.fragment.html – no <html>/<head>, loads three.js from cdnjs; for hosts
//                                   that wrap pages themselves
import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const read = (p, enc = 'utf8') => readFile(new URL(p, root), enc);
const THREE_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.159.0/three.min.js';

const globalThree = {
  name: 'global-three',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: 'three', namespace: 'global-three' }));
    b.onLoad({ filter: /.*/, namespace: 'global-three' }, () => ({ contents: 'module.exports = window.THREE;', loader: 'js' }));
  },
};

async function bundle(external) {
  const out = await build({
    entryPoints: [new URL('src/main.js', root).pathname],
    bundle: true,
    minify: true,
    format: 'iife',
    target: 'es2019',
    write: false,
    legalComments: 'none',
    plugins: external ? [globalThree] : [],
  });
  return out.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
}

const font = (await read('assets/fonts/Fredoka.woff2', null)).toString('base64');
const icon = (await read('assets/icons/icon-192.png', null)).toString('base64');
const css = (await read('css/style.css')).replace("url('../assets/fonts/Fredoka.woff2')", `url(data:font/woff2;base64,${font})`);
if (!css.includes('data:font/woff2')) throw new Error('Font was not inlined');

const html = await read('index.html');
const app = html.slice(html.indexOf('<!--APP-->') + 10, html.indexOf('<!--/APP-->')).trim();
if (!app.includes('id="app"')) throw new Error('App markup not found in index.html');
const flag = '<script>window.__MUSICDOGS_SINGLE_FILE = true;</script>';

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
${app}
${flag}
<script>${await bundle(false)}</script>
</body>
</html>
`;

const fragment = `<title>MusicDogs 3D</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
${app}
${flag}
<script src="${THREE_CDN}"></script>
<script>${await bundle(true)}</script>
`;

await mkdir(new URL('dist/', root), { recursive: true });
await writeFile(new URL('dist/MusicDogs.html', root), standalone);
await writeFile(new URL('dist/MusicDogs3D.fragment.html', root), fragment);
const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(0)} KB`;
console.log(`dist/MusicDogs.html             ${kb(standalone)}`);
console.log(`dist/MusicDogs3D.fragment.html  ${kb(fragment)}`);
