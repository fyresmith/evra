// The README's headline image and what goes with it, made from the screenshot in raw/ (shoot.mjs takes that):
//   npm run banner
// writes, in docs/media: banner.png (2560×1280, round corners, clear outside them), social-preview.png (1280×640,
// square: the repository's social preview, set by hand in GitHub's settings), mark.svg (the mark as an icon, in
// currentColor), mark-tile.svg and mark-tile.png (white on the teal, 512 square).
// Each picture is a page, written to test-dist/banner/ (open one in a browser to work on it), photographed by a
// headless Chromium (CHROMIUM names another binary). The type is Inter, from fonts/ (SIL OFL: fonts/OFL.txt), so the
// result doesn't depend on what is installed. No Obsidian logo, and nothing made from it: their brand guidelines.
import { execFileSync } from 'child_process';
import { mkdirSync, statSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, '../../docs/media'), work = resolve(here, '../../test-dist/banner');
const url = (...parts) => pathToFileURL(join(here, ...parts)).href;
const CHROMIUM = process.env.CHROMIUM || 'chromium';

// The mark is the plugin's own icon (ICON_SVG in src/main.ts): a line of time with marks on either side, on a 100 grid.
const MARK = `<path d="M50 9v82M25 28h19M56 50h19M25 72h19"/>`;
// Beside the heavy wordmark, and on the tile, the stroke is a little heavier than the icon's, or the mark looks thin.
const HEAVY = 9.5;
const svg = (attrs, stroke = 8) => `<svg ${attrs}xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round">${MARK}</svg>`;

const TEAL = '#12736b'; // the sample world's teal, deep enough that white type holds on it
const PITCH = 'Built for the worlds you make up.';

/** The banner as a page, `w`×`h` CSS pixels; `radius` 0 for the cut that fills its frame (the social preview). */
const page = ({ w = 1280, h = 640, radius = 32 }) => `<!doctype html>
<meta charset="utf-8">
<title>Evra Timelines for Obsidian</title>
<style>
	@font-face { font-family: "Inter"; font-weight: 100 900; font-style: normal; font-display: block; src: url("${url('fonts', 'Inter-latin-variable.woff2')}") format("woff2"); }
	html, body { margin: 0; background: transparent; }
	body { width: ${w}px; height: ${h}px; overflow: hidden; }
	.panel { position: relative; width: ${w}px; height: ${h}px; overflow: hidden; border-radius: ${radius}px; background: ${TEAL}; }
	.words { position: absolute; left: 76px; top: 0; bottom: 0; width: 430px; display: flex; flex-direction: column; justify-content: center; font-family: "Inter", system-ui, sans-serif; color: #fff; -webkit-font-smoothing: antialiased; text-rendering: geometricPrecision; }
	/* (the mark's own left edge is 21 of 100 in from its box: pulled back, so it stands over the E's stem) */
	.mark { display: block; flex: none; width: 96px; height: 96px; margin: 0 0 18px -17px; }
	.name { margin: 0; font-size: 96px; line-height: 1; font-weight: 700; letter-spacing: -0.04em; }
	.for { margin: 14px 0 0 3px; font-size: 27px; line-height: 1.2; font-weight: 500; letter-spacing: -0.01em; color: rgba(255,255,255,.74); }
	.pitch { margin: 40px 0 0 3px; font-size: 23px; line-height: 1.35; font-weight: 450; letter-spacing: -0.005em; color: rgba(255,255,255,.92); white-space: nowrap; }
	/* The app: its window's corner and a little of its chrome, running off the right and the bottom. One CSS pixel to
	   one of the app's (the shot is 990 wide at 3×), placed so the line of time and the cards on both sides of it are
	   in the picture: if the timeline's layout changes, look at where the edges cut it and move left and top. */
	.shot { position: absolute; left: ${Math.round(w * 0.414)}px; top: ${Math.round(h * 0.135)}px; width: 990px; border-radius: 12px 0 0 0; overflow: hidden; box-shadow: 0 0 0 1px rgba(4,30,28,.4), 0 24px 56px rgba(4,34,31,.42); }
	.shot img { display: block; width: 100%; }
</style>
<div class="panel">
	<div class="words">
		${svg('class="mark" ', HEAVY)}
		<h1 class="name">Evra</h1>
		<p class="for">Timelines for Obsidian</p>
		<p class="pitch">${PITCH}</p>
	</div>
	<div class="shot"><img src="${url('raw', 'timeline-dark.png')}" alt=""></div>
</div>
`;

const tile = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${TEAL}"/><g transform="translate(96 96) scale(3.2)" fill="none" stroke="#fff" stroke-width="${HEAVY}" stroke-linecap="round">${MARK}</g></svg>\n`;

mkdirSync(out, { recursive: true });
mkdirSync(work, { recursive: true });
writeFileSync(join(out, 'mark.svg'), svg('') + '\n');
writeFileSync(join(out, 'mark-tile.svg'), tile);

const PICTURES = {
	'banner': { html: page({}), w: 1280, h: 640, scale: 2 },
	'social-preview': { html: page({ radius: 0 }), w: 1280, h: 640, scale: 1 },
	'mark-tile': { html: `<!doctype html><meta charset="utf-8"><style>html, body { margin: 0; background: transparent; } img { display: block; width: 512px; height: 512px; }</style><img src="${pathToFileURL(join(out, 'mark-tile.svg')).href}" alt="">`, w: 512, h: 512, scale: 1 },
};
for (const [name, { html, w, h, scale }] of Object.entries(PICTURES)) {
	const file = join(work, `${name}.html`), png = join(out, `${name}.png`);
	writeFileSync(file, html);
	execFileSync(CHROMIUM, ['--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000', `--force-device-scale-factor=${scale}`, `--window-size=${w},${h}`, `--screenshot=${png}`, pathToFileURL(file).href], { stdio: 'ignore' });
	console.log(`docs/media/${name}.png  ${w * scale}×${h * scale}  ${Math.round(statSync(png).size / 1000)} kB`);
}
