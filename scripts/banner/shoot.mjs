// The banner's screenshot: the sample world, "Chronicle of Veld", in the default dark theme, with the sidebars and the
// ribbon out of the way. Taken in a headless Obsidian by the e2e driver, at three device pixels to one. Run it again
// when the timeline looks different, then `npm run banner`:
//   npm run build && npm run install-vault && node scripts/banner/shoot.mjs
// The driver opens a throwaway copy of test-vault, so nothing of the project's is changed but raw/.
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { launch } from '../../tests/e2e/driver.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'raw');
mkdirSync(out, { recursive: true });

// The banner places the shot at one CSS pixel to one of the app's; build.mjs counts on this window.
const W = 990, H = 760, SCALE = 3;
const FILE = 'Chronicle of Veld.evra';
// the stretch of time on screen: the Long War and what came of it (days, and CSS pixels per day)
const VIEW = { v0: 10330, scale: 0.15, x: 0 };
const p = await launch({ theme: 'dark', width: W, height: H });
const until = async (expr, what, ms = 10000) => { for (let i = 0; i < ms / 100; i++) { if (await p.ev(expr).catch(() => false)) return; await p.sleep(100); } throw new Error(`never happened: ${what}`); };
try {
	await p.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: SCALE, mobile: false });
	await p.ev(`(async () => {
		app.vault.setConfig('showRibbon', false); // Appearance → Show ribbon: off, so the timeline has the width
		app.workspace.leftSplit.collapse();
		app.workspace.rightSplit.collapse();
		const leaf = app.workspace.getLeaf(false);
		await leaf.setViewState({ type: 'evra', active: true, state: { file: ${JSON.stringify(FILE)}, evraView: ${JSON.stringify(VIEW)} } });
	})().then(() => 1)`);
	await until(`document.querySelectorAll('.evra-root .cards > .evra-card').length > 3`, 'the timeline drew its cards');
	await p.sleep(1500);
	await p.ev(`(() => { document.querySelectorAll('.notice').forEach(n => n.remove()); document.activeElement?.blur?.(); return 1; })()`);
	await p.move(W - 4, 4, 2); // the pointer over nothing that would light up
	await p.sleep(900);
	await p.shot(join(out, 'timeline-dark.png'));
	// what the picture shows, for whoever takes it again
	const state = await p.ev(`JSON.stringify({ obsidian: navigator.userAgent.match(/obsidian\\/[\\d.]+/i)?.[0], plugin: app.plugins.manifests.evra.version, window: [${W}, ${H}, ${SCALE}], file: ${JSON.stringify(FILE)}, view: app.workspace.getLeavesOfType('evra')[0].view.getState().evraView, cards: [...document.querySelectorAll('.evra-root .cards > .evra-card')].map(c => c.getAttribute('aria-label')) }, null, '\\t')`);
	writeFileSync(join(out, 'state.json'), state + '\n');
	console.log('scripts/banner/raw/timeline-dark.png. Look at it, then: npm run banner');
} finally { await p.close(); }
