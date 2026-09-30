// End-to-end tests in real Obsidian.
//   npm run e2e                     all tests, light theme
//   npm run e2e -- --theme dark     or: --theme both
//   npm run e2e -- --grep sync      only tests whose name matches
//   npm run e2e -- --repeat 3       run everything several times
//   npm run e2e -- --shots dir      save a screenshot of every failure there
import { mkdirSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { launch } from './driver.mjs';
import { readdirSync as ls } from 'fs';
import { pathToFileURL } from 'url';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const themes = arg('theme', 'light') === 'both' ? ['light', 'dark'] : [arg('theme', 'light')];
const grep = arg('grep', '') ? new RegExp(arg('grep'), 'i') : null;
const repeat = Number(arg('repeat', '1'));
const shots = arg('shots', 'test-dist/e2e-failures');
mkdirSync(shots, { recursive: true });

// the pristine test vault, so each test starts from the same files
const pristine = new Map();
const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (f === '.obsidian' || f === 'Aerth') continue; if (statSync(p).isDirectory()) walk(p); else if (/\.(md|evra)$/.test(f)) pristine.set(relative('test-vault', p), readFileSync(p, 'utf8')); } };
walk('test-vault');

// specs: every tests/e2e/specs*.mjs, or just the ones given with --specs a.mjs,b.mjs
const specFiles = arg('specs', '') ? arg('specs').split(',') : ls('tests/e2e').filter((f) => /^specs.*\.mjs$/.test(f)).map((f) => 'tests/e2e/' + f);
const specs = [];
for (const f of specFiles) specs.push(...(await import(pathToFileURL(f).href)).specs);

class Fail extends Error {}
const results = [];
for (let round = 1; round <= repeat; round++) {
	for (const theme of themes) {
		const p = await launch({ theme });
		const h = helpers(p);
		for (const s of specs) {
			if (grep && !grep.test(s.name)) continue;
			const name = `${s.name} [${theme}${repeat > 1 ? ' #' + round : ''}]`;
			const t0 = Date.now();
			p.errors.length = 0;
			let err = null;
			try {
				await h.reset();
				await s.fn(p, h, {
					ok: (c, m) => { if (!c) throw new Fail(m); },
					eq: (a, b, m) => { if (a !== b) throw new Fail(`${m}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); },
				});
				await p.sleep(80);
				const bad = p.errors.filter((e) => !/ERR_|net::|DevTools|favicon|Failed to load resource|Electron Security Warning/.test(e));
				if (bad.length) throw new Fail('errors logged: ' + bad.slice(0, 3).join(' ; '));
			} catch (e) {
				err = e instanceof Fail ? e.message : 'crashed: ' + (e.stack || e).toString().split('\n').slice(0, 3).join(' | ');
				await p.shot(join(shots, name.replace(/[^\w]+/g, '_') + '.png')).catch(() => {});
			}
			results.push({ name, ok: !err, err, ms: Date.now() - t0 });
			console.log(`${err ? '✗' : '✓'} ${name} ${err ? '\n    ' + err : ''} (${Date.now() - t0}ms)`);
		}
		await p.close();
	}
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
process.exit(failed.length ? 1 : 0);

function helpers(p) {
	const view = `app.workspace.getLeavesOfType('evra').map(l => l.view).find(v => v.timeline && v.leaf === app.workspace.activeLeaf) || app.workspace.getLeavesOfType('evra').map(l => l.view)[0]`;
	const h = {
		view, tl: `(${view}).timeline`,
		async reset() {
			await p.ev(`(async () => {
				document.querySelectorAll('.modal-close-button').forEach(b => b.click());
				app.workspace.iterateRootLeaves(l => l.detach());
				await new Promise(r => setTimeout(r, 150));
				const files = ${JSON.stringify([...pristine])};
				for (const [path, text] of files) {
					const f = app.vault.getAbstractFileByPath(path);
					if (f) await app.vault.modify(f, text); else { const dir = path.split('/').slice(0, -1).join('/'); if (dir && !app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir); await app.vault.create(path, text); }
				}
				const keep = new Set(files.map(f => f[0]));
				for (const f of app.vault.getFiles()) if (!keep.has(f.path) && !f.path.startsWith('Aerth/') && /\\.(md|evra)$/.test(f.path)) await app.vault.delete(f);
				const p = app.plugins.plugins.evra; p.settings = Object.assign({}, p.settings, { defaults: null, newFileFolder: '', noteFolder: '', openNotesIn: 'split' }); await p.saveSettings();
				app.workspace.leftSplit.collapse();
			})().then(() => 1)`);
			await p.sleep(250);
		},
		async open(path = 'Chronicle of Veld.evra') {
			await p.ev(`app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(${JSON.stringify(path)})).then(() => 1)`);
			for (let i = 0; i < 40; i++) { if (await p.ev(`!!document.querySelector('.workspace-leaf.mod-active .evra-root .evra-card, .workspace-leaf.mod-active .evra-root .lines circle')`)) break; await p.sleep(100); }
			await p.sleep(300);
		},
		doc: () => p.ev(`JSON.parse(JSON.stringify(${h.tl}.getDoc()))`),
		events: async () => (await h.doc()).events,
		ev: async (title) => (await h.doc()).events.find((e) => e.title === title || (e.file && e.file.split('/').pop() === title)),
		run: (id) => p.ev(`app.commands.executeCommandById('evra:${id}')`),
		/** The file on disk, after any pending save. */
		async saved(path = 'Chronicle of Veld.evra') { await p.ev(`(${view}).save().then(() => 1)`); return JSON.parse(await p.ev(`app.vault.adapter.read(${JSON.stringify(path)})`)); },
		setView: (v0Years, years) => p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); const Y = d.cal.months.reduce((a, m) => a + m.days, 0); const s = document.querySelector('.workspace-leaf.mod-active .evra-root .stage'); const L = ['ltr','rtl'].includes(d.orientation) ? s.clientWidth : s.clientHeight; t.setViewState({v0: ${v0Years} * Y, scale: L / (${years} * Y), x: 0}); return 1; })()`).then(() => p.sleep(350)),
		async menu(title) { await p.ev(`document.querySelector('.workspace-leaf.mod-active .evra-root .evra-card[aria-label^="${title}"] [data-act=menu]').click()`); await p.sleep(200); },
		stage: () => p.at('.workspace-leaf.mod-active .evra-root .stage'),
		/** Screen x (vertical) of the time line. */
		async lineX() { const s = await h.stage(); const x = await p.ev(`Number(document.querySelector('.workspace-leaf.mod-active .evra-root .lines line[style*="dasharray: 2"], .workspace-leaf.mod-active .evra-root .lines line[style*="dasharray:2"]').getAttribute('x1'))`); return s.l + x; },
		card: (title, sub = '') => p.at(`.workspace-leaf.mod-active .evra-root .evra-card[aria-label^="${title}"] ${sub}`),
		cardCount: () => p.ev(`document.querySelectorAll('.workspace-leaf.mod-active .evra-root .cards > .evra-card').length`),
		popOpen: () => p.ev(`!document.querySelector('.workspace-leaf.mod-active .evra-root [data-r=pop]').hidden`),
		pop: (sel) => p.at(`.workspace-leaf.mod-active .evra-root [data-r=pop] ${sel}`),
		clickPop: async (sel) => { const b = await h.pop(sel); if (!b) throw new Fail('not in the popover: ' + sel); await p.click(b.x, b.y); await p.sleep(150); },
		ctrl: (c) => p.at(`.workspace-leaf.mod-active .evra-root [data-c=${c}]`),
		async openSheet(tab) { const b = await h.ctrl('settings'); await p.click(b.x, b.y); await p.sleep(200); if (tab) { const t = await p.at(`.workspace-leaf.mod-active .evra-root [data-tab=${tab}]`); await p.click(t.x, t.y); await p.sleep(250); } },
		sheet: async (sel) => { await p.ev(`(() => { const e = document.querySelector('.workspace-leaf.mod-active .evra-root .sheet-body ${sel}'); if (e) e.scrollIntoView({block: 'center'}); return 1; })()`); await p.sleep(120); return p.at(`.workspace-leaf.mod-active .evra-root .sheet-body ${sel}`); },
		toast: () => p.ev(`(() => { const t = document.querySelector('.workspace-leaf.mod-active .evra-root [data-r=toast]'); return t && !t.hidden ? t.textContent : ''; })()`),
		focusStage: async () => { const s = await h.stage(); await p.click(s.l + s.w - 60, s.t + 40); await p.sleep(80); },
		Fail,
	};
	return h;
}
