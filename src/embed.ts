import { FileView, MarkdownRenderChild, TFile, type MarkdownPostProcessorContext } from 'obsidian';
import { svgEl } from './dom';
import { makeEngine } from './engine';
import type EvraPlugin from './main';
import { normDoc } from './model';
import { VIEW_TYPE } from './view';
import type { EvraDoc } from './types';

/* A timeline inside a note:
   ```evra
   timeline: Chronicle of Veld   (optional: the only or first timeline in the vault otherwise)
   era: Reign of Ash             (or from: 30 / to: 50, in years)
   tag: war                      (optional)
   ```                                                                  */

export function parseEmbed(src: string): Record<string, string> {
	const o: Record<string, string> = {};
	src.split('\n').forEach((l) => { const m = /^\s*(\w+)\s*:\s*(.+)$/.exec(l); if (m) o[m[1].toLowerCase()] = m[2].trim(); });
	return o;
}

function findTimeline(plugin: EvraPlugin, name: string | undefined, sourcePath: string): TFile | null {
	const mc = plugin.app.metadataCache;
	if (name) {
		const n = name.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();
		const f = mc.getFirstLinkpathDest(n.endsWith('.evra') ? n : n + '.evra', sourcePath);
		if (f) return f;
		const byName = plugin.app.vault.getFiles().find((x) => x.extension === 'evra' && x.basename.toLowerCase() === n.toLowerCase());
		return byName || null;
	}
	const all = plugin.app.vault.getFiles().filter((x) => x.extension === 'evra').sort((a, b) => a.path.localeCompare(b.path));
	const dir = sourcePath.split('/').slice(0, -1).join('/');
	// a root-level file's parent path is '/', while a root note's folder is ''
	const folderOf = (x: TFile) => { const p = x.parent ? x.parent.path : ''; return p === '/' ? '' : p; };
	return all.find((x) => folderOf(x) === dir) || all[0] || null;
}

class EmbedChild extends MarkdownRenderChild {
	private gen = 0; // bumped by each render; an older render still waiting on a read gives up
	private filePath: string | null = null; // the timeline this embed shows, resolved on each render
	constructor(el: HTMLElement, private plugin: EvraPlugin, private src: string, private sourcePath: string) { super(el); }
	onload() {
		void this.render();
		// only saves to the timeline shown here (or any timeline while none is found) redraw it
		this.registerEvent(this.plugin.app.vault.on('modify', (f) => { if (f.path.endsWith('.evra') && (this.filePath == null || f.path === this.filePath)) void this.render(); }));
		// a renamed timeline can change which file the embed's name points at, so resolve it again
		this.registerEvent(this.plugin.app.vault.on('rename', (f, oldPath) => { if (f.path.endsWith('.evra') || oldPath.endsWith('.evra')) void this.render(); }));
	}
	/** Show an event: in the leaf that already has this timeline open, or in a new one. */
	private async open(file: TFile, id: string) {
		const ws = this.plugin.app.workspace;
		// the view state names the file even for a background tab that hasn't loaded its view yet
		const leaf = ws.getLeavesOfType(VIEW_TYPE).find((l) => (l.view instanceof FileView && l.view.file === file) || (l.getViewState().state as { file?: string } | undefined)?.file === file.path);
		if (!leaf) { await ws.getLeaf(false).openFile(file, { eState: { evraFocus: id } }); return; }
		if (!(leaf.view instanceof FileView)) { ws.setActiveLeaf(leaf, { focus: true }); await leaf.openFile(file, { eState: { evraFocus: id } }); return; } // not loaded yet: load it there
		// setActiveLeaf brings its tab to the front (revealLeaf needs a newer Obsidian than minAppVersion)
		await leaf.openFile(file, { active: true, eState: { evraFocus: id } }); // same file: Obsidian just brings the leaf forward and passes the focus request
	}
	async render() {
		const gen = ++this.gen, el = this.containerEl, o = parseEmbed(this.src);
		const file = findTimeline(this.plugin, o.timeline, this.sourcePath);
		this.filePath = file ? file.path : null;
		let doc: EvraDoc = null, failed = false;
		if (file) {
			try { doc = normDoc(JSON.parse(await this.plugin.app.vault.cachedRead(file)), file.basename); }
			catch { failed = true; }
		}
		if (gen !== this.gen) return; // a newer render has taken over
		el.empty();
		el.addClass('evra-embed');
		if (!file) { el.createDiv({ cls: 'eh', text: o.timeline ? `No timeline called “${o.timeline}”.` : 'No timelines in this vault yet.' }); return; }
		if (failed) { el.createDiv({ cls: 'eh', text: `“${file.basename}” couldn’t be read.` }); return; }
		drawEmbed(el, doc, o, (id) => void this.open(file, id), (link) => this.plugin.app.metadataCache.getFirstLinkpathDest(link, file.path)?.basename || link.split('/').pop());
	}
}

export function drawEmbed(el: HTMLElement, doc: EvraDoc, o: Record<string, string>, open: (id: string) => void, noteTitle: (link: string) => string) {
	const E = makeEngine(() => doc), dep = E.eraDepths();
	const col = (c: string | null) => { const p = c && doc.palette.find((x) => x.id === c); return p ? p.hex || `var(--evra-c${p.id})` : 'var(--evra-muted)'; };
	let a = E.yearStartT(doc.range[0]), b = E.yearStartT(doc.range[1]), title = doc.name;
	if (o.era) {
		const e = doc.eras.find((x) => x.name.toLowerCase() === o.era.toLowerCase());
		// say so rather than quietly showing the whole timeline
		if (!e) { el.createDiv({ cls: 'eh', text: `No era called “${o.era}” in ${doc.name}.` }); return; }
		a = e.start; b = e.end; title = e.name;
	}
	// from:/to: that aren't years are ignored rather than giving an empty, NaN range
	const from = o.from ? parseInt(o.from, 10) : NaN, to = o.to ? parseInt(o.to, 10) : NaN;
	if (Number.isFinite(from)) a = E.toT(from - doc.cal.yearStart, 0, 0);
	// to: is inclusive: it runs to the last day of that year, so "to: 38" shows Year 38's events and the header ends in 38
	if (Number.isFinite(to)) b = E.yearStartT(to - doc.cal.yearStart + 1) - 1;
	const tag = o.tag ? o.tag.replace(/^#/, '') : '';
	const evs = doc.events.filter((e) => (e.end != null ? e.end : e.t) >= a && e.t <= b && (!tag || (e.tags || []).includes(tag))).sort((x, y) => x.t - y.t);
	const W = 600, H = 58, X = (t: number) => 12 + ((t - a) / Math.max(1, b - a)) * (W - 24), rd = (v: number) => Math.round(v * 10) / 10;
	const head = el.createDiv({ cls: 'eh' });
	head.createSpan({ text: title });
	head.createEl('small', { text: `${E.fmt(a)} – ${E.fmt(b)}` });
	const svg = el.createSvg('svg', { attr: { viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', role: 'img', 'aria-label': `Timeline of ${title}` } });
	doc.eras.filter((e) => e.end > a && e.start < b && dep[e.id] <= 2).forEach((e) => {
		svg.appendChild(svgEl('rect', { x: rd(X(Math.max(a, e.start))), y: dep[e.id] === 1 ? 6 : 16, width: rd(Math.max(1, X(Math.min(b, e.end)) - X(Math.max(a, e.start)))), height: dep[e.id] === 1 ? 40 : 20, rx: 4 }, `fill:${col(e.color)};opacity:.16`));
	});
	svg.appendChild(svgEl('line', { x1: 12, y1: H / 2, x2: W - 12, y2: H / 2 }, 'stroke:var(--evra-line);stroke-width:1.5'));
	evs.forEach((e) => {
		if (e.end != null) svg.appendChild(svgEl('line', { x1: rd(X(Math.max(a, e.t))), y1: H / 2 + (e.side === 'a' ? -7 : 7), x2: rd(X(Math.min(b, e.end))), y2: H / 2 + (e.side === 'a' ? -7 : 7) }, `stroke:${col(e.color)};stroke-width:3;stroke-linecap:round`));
		else svg.appendChild(svgEl('circle', { cx: rd(X(e.t)), cy: H / 2, r: 4.5 }, `fill:${col(e.color)};stroke:var(--evra-surface);stroke-width:2`));
	});
	const ol = el.createEl('ol');
	evs.slice(0, 10).forEach((e) => {
		const btn = ol.createEl('li').createEl('button');
		btn.createEl('small', { text: E.evDate(e) });
		btn.appendText(e.file ? noteTitle(e.file) : e.title || 'Untitled');
		btn.addEventListener('click', () => open(e.id));
	});
	if (evs.length > 10) ol.createEl('li', { cls: 'more', text: `and ${evs.length - 10} more` });
	if (!evs.length && tag) ol.createEl('li', { cls: 'more', text: `No events tagged #${tag}.` });
}

export function renderEmbed(plugin: EvraPlugin, src: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) {
	ctx.addChild(new EmbedChild(el, plugin, src, ctx.sourcePath));
}
