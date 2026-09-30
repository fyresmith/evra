import { TIMELINE_COMMANDS } from './commands';
import { attr, closest, q1, qa, setHTML, svgEl, type SvgEl } from './dom';
import { cap, clamp, DEFAULT_FMT, eraAbbr, esc, makeEngine, TOKENS, tpl, uid } from './engine';
import type { TimelineHost } from './host';
import { DEFAULT_UNITS, defaultPalette, normCal, normDoc, okDay, parseCalendarImport, PRESETS, SYNC_FIELDS } from './model';
import { dateFromProps, noteDateOf, syncValue } from './sync';
import { DESC_MAX, inline, noteExcerpt, plainOf } from './text';
import type { Era, EvraDoc, EvraEvent, Orientation, SavedView, Side } from './types';

/* The timeline view: one axis of time, cards on either side, eras on the line.
   Everything is drawn from the document `S` each animation frame: an SVG layer for the line, eras,
   threads and stems, and a layer of HTML cards laid out beside it. */

export interface ViewState { v0: number; scale: number; x: number }
export interface Timeline {
	setDoc(doc: EvraDoc): void;
	getDoc(): EvraDoc;
	run(id: string): void;
	undo(): void;
	redo(): void;
	canUndo(): boolean;
	canRedo(): boolean;
	getViewState(): ViewState | null;
	setViewState(v: ViewState): void;
	focusEvent(id: string): void;
	notesChanged(): void;
	noteChanged(link: string): void;
	cssChanged(): void;
	focus(): void;
	/** Save the card being edited, if any. */
	flush(): void;
	/** A note was renamed: point undo and redo at its new link too, so undoing never brings back a dead link. */
	relinkHistory(from: string[], to: string): void;
	destroy(): void;
}

interface Geo { W: number; H: number; vert: boolean; rev: boolean; L: number; C: number; cx: number; inb: number; ext?: { a: number; b: number } }
interface Item {
	ev: EvraEvent; side: Side; group?: boolean; gid?: string; year?: number; members?: EvraEvent[]; span?: boolean;
	a: number; b?: number; lo: number; hi: number; ra?: number; rb?: number; along?: number; len?: number; cr?: number; cOff?: number; pos?: number; offP?: number;
}
type Rect = [number, number, number, number];
interface TagInfo { ev: EvraEvent; c: number; color: string; side?: Side; k?: number }
interface Layout {
	mode: 'full' | 'compact' | 'dots'; len?: number; offP?: number; items: Item[]; ext: { a: number; b: number };
	ribbons: { a: Rect[]; b: Rect[] }; groups: Record<string, Item>; cross?: { a: number; b: number };
	gut?: { a: number; b: number }; lanes?: Record<string, number>; bundled?: Set<string>; tags?: { a: TagInfo[]; b: TagInfo[] };
}
interface Dot { id: string | null; which?: 'point' | 'start' | 'end'; s: number; zoom?: [number, number] }
interface Bound { id: string; which: 'start' | 'end'; s: number; dep: number }
interface EraLabel { id: string; name: string; s: number; sub: boolean; lvl: number; lead?: number; row?: number }
interface Bundle { side: Side; n: number; ids: string[]; s: number }
interface FrameInfo {
	dots: Dot[]; bounds: Bound[]; eraLabels: EraLabel[]; ticks?: { s: number; label: string }[]; ticks2?: { s: number; label: string }[];
	railW?: number; bundles?: Bundle[]; nowS?: number | null;
}
interface Local { x: number; y: number; s: number; c: number }
interface Age { name: string; age: number; color: string }
interface At { x: number; y: number }
interface Drag {
	type: 'pan' | 'card' | 'group' | 'dot' | 'bound' | 'select' | 'marquee' | 'zoomdot' | 'pinch';
	start?: Local; moved?: boolean; armed?: boolean; timer?: number; before?: string;
	id?: string; together?: { id: string; t: number; end?: number; relAt?: number }[]; el0?: At; free?: At; orig?: { t: number; end?: number; side: Side };
	year?: number; members?: { id: string; t: number }[];
	which?: 'point' | 'start' | 'end' | 'auto'; o?: { t: number; end?: number; os?: boolean; oe?: boolean };
	d?: Dot; a?: number; b?: number; keep?: string[]; v0?: number; x0?: number; era?: string; thread?: string; last?: number;
	other?: 'start' | 'end'; bt?: number; lo?: number; hi?: number; group?: string[]; group2?: string[];
}
type Kind = 'day' | 'month' | 'whole';

const MAXS = 40; // px per day at max zoom
const ICON = {
	note: '<svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3H3v10h10v-3"/><path d="M9 2.5h4.5V7M13.5 2.5 7.5 8.5"/></svg>',
	stack: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 2 14 5 8 8 2 5z"/><path d="M2 8l6 3 6-3M2 11l6 3 6-3"/></svg>',
	pen: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 2.5l3 3L6 13H3v-3z"/></svg>',
	dots: '<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><circle cx="3.5" cy="8" r="1.3"/><circle cx="8" cy="8" r="1.3"/><circle cx="12.5" cy="8" r="1.3"/></svg>',
	x: '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
	arrow: (r: number) => `<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" style="transform:rotate(${r}deg)"><path d="M8 2v12M4 10l4 4 4-4"/></svg>`,
};
const ICONS = ['⚔', '♛', '☠', '☄', '⚓', '✦', '⚑', '☾', '✚', '★', '⌂', '❦'];
const ORIENT: Record<Orientation, { rot: number; label: string }> = {
	ttb: { rot: 0, label: 'Top to bottom' }, btt: { rot: 180, label: 'Bottom to top' }, ltr: { rot: -90, label: 'Left to right' }, rtl: { rot: 90, label: 'Right to left' },
};
const DIR: Record<Orientation, string> = { ttb: 'bottom', btt: 'top', ltr: 'right', rtl: 'left' };
const FMT_FIELDS: [string, [keyof EvraDoc['cal']['fmt'], string, string][]][] = [
	['Years', [['year', 'Year', 'yearPos'], ['yearNeg', 'Years before zero', 'yearNeg']]],
	['Dates on cards', [['dateDay', 'Exact day', 'day'], ['dateMonth', 'Month only', 'month'], ['dateYear', 'Whole year', 'whole'], ['dateInter', 'Festival days', 'inter']]],
	['Ruler on the line', [['tickYear', 'Year marks', 'whole'], ['tickMonth', 'Month marks', 'month'], ['tickDay', 'Day marks', 'day']]],
	['Spans', [['range', 'Start to end', 'range'], ['ongoing', 'Word for an ongoing span', 'ongoing']]],
	['Approximate dates', [['circa', 'Circa (use {date})', 'circa']]],
];
const GUT = 22, GAPC = 14, LANE = 6, RULER = 64; // gutter beside the line, gap between stacked cards, spacing of span threads, width of the year ruler
const BASE_H = 55, LINE_H = 18.1, GROUP_H = 112; // card = title + date (+ description lines)
const MAXL = 6; // past this many overlapping spans, the rest share one bundled lane
const laneC = (i: number) => 12 + i * LANE;
const DIM_HOVER = 0.5, DIM_SELECT = 0.2; // DIM_HOVER: everything else while hovering a card. DIM_SELECT: cards a filter leaves out
const rd = (v: number) => Math.round(v * 10) / 10;
const normHex = (v: string): string | null => {
	const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(v).trim());
	if (!m) return null;
	const h = m[1].length === 3 ? m[1].replace(/./g, (x) => x + x) : m[1];
	return '#' + h.toLowerCase();
};
function hslHex(h: number, s: number, l: number) {
	s /= 100; l /= 100;
	const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
	return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}

const MARKUP = `<div class="stage" data-r="stage" tabindex="0" role="application" aria-roledescription="timeline">
<svg class="lines" data-r="svg"></svg>
<div class="cards" data-r="cards"></div>
<div class="ui empty" data-r="empty" hidden><p>Double-click beside the line to add an event. Drag along the line to create an era or a span.</p></div>
<nav class="ui crumb" data-r="crumb" aria-label="Current era" hidden></nav>
<button class="ui xbtn" data-r="extS" hidden></button>
<button class="ui xbtn" data-r="extE" hidden></button>
<div class="ui hint" data-r="hint">Double-click to add · Drag along the line for an era or span · Ctrl/⌘ + scroll to zoom</div>
<div class="ui ctrls" data-r="ctrls">
<button class="ibtn" data-c="in" aria-label="Zoom in (+)"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M8 3v10M3 8h10"/></svg></button>
<button class="ibtn" data-c="out" aria-label="Zoom out (−)"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3 8h10"/></svg></button>
<button class="ibtn" data-c="fit" aria-label="Fit everything (F)"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/></svg></button>
<button class="ibtn" data-c="views" data-pop-toggle aria-label="Saved views"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M4 2.5h8v11l-4-3-4 3z"/></svg></button>
<button class="ibtn" data-c="filter" data-pop-toggle aria-label="Filter"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M2.5 3h11L9.5 8.5V13l-3-1.5v-3z"/></svg></button>
<hr>
<button class="ibtn" data-c="orient" aria-label="Change direction"><svg data-r="orientIcon" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v12M4 10l4 4 4-4"/></svg></button>
<button class="ibtn" data-c="settings" data-pop-toggle aria-label="Timeline settings"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.6"/><circle cx="6" cy="11.5" r="1.6"/></svg></button>
<button class="ibtn" data-c="help" data-pop-toggle aria-label="Shortcuts"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.4"/><circle cx="8" cy="12" r=".6" fill="currentColor"/></svg></button>
</div>
<div class="ui fade" data-r="fadeA" hidden></div>
<div class="ui fade" data-r="fadeB" hidden></div>
<div class="ui xbar" data-r="xbar" hidden><i data-r="xthumb"></i></div>
<div class="ui ruler" data-r="ruler" aria-hidden="true"></div>
<div class="ui ruler r2" data-r="ruler2" aria-hidden="true" hidden></div>
<div class="ui eralabels" data-r="eraLabels"></div>
<div class="ui bundles" data-r="bundles"></div>
<div class="ui minimap" data-r="minimap" title="The whole range. Click or drag to move"><canvas></canvas></div>
<button class="ui nowtag" data-r="nowTag" hidden title="Now. Click to jump here"></button>
<div class="ui fpill" data-r="fpill" hidden></div>
<div class="ui tags" data-r="tags"></div>
<div class="ui tipx" data-r="tip" hidden></div>
<div class="ui pop" data-r="pop" hidden></div>
<div class="ui toast" data-r="toast" hidden></div>
<div class="ui marquee" data-r="marquee" hidden></div>
<div class="ui palette" data-r="palette" hidden role="dialog" aria-label="Search and commands"><div class="pbox"><input type="text" data-r="palIn" autocomplete="off" spellcheck="false" aria-label="Search"><div class="plist" data-r="palList" role="listbox"></div><div class="pfoot"><span><kbd>↑↓</kbd> choose</span><span><kbd>↵</kbd> go</span><span><kbd>&gt;</kbd> commands</span><span><kbd>esc</kbd> close</span></div></div></div>
</div>
<aside class="drawer sheet" data-r="sheet" hidden aria-label="Timeline settings">
<header><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4.5h6M11.5 4.5h2M2.5 11.5h2M7.5 11.5h6"/><circle cx="10" cy="4.5" r="1.6"/><circle cx="6" cy="11.5" r="1.6"/></svg><span>Timeline settings</span><button class="ibtn" data-r="sheetClose" aria-label="Close settings">${ICON.x}</button></header>
<nav class="tabs" data-r="sheetTabs" aria-label="Settings sections"><button data-tab="calendar">Calendar</button><button data-tab="formats">Formats</button><button data-tab="timeline">Timeline</button><button data-tab="cards">Cards</button><button data-tab="colors">Colors</button><button data-tab="notes">Notes</button></nav>
<div class="sheet-body" data-r="sheetBody"></div>
</aside>`;

export function mountTimeline(root: HTMLElement, host: TimelineHost, initial: EvraDoc, onUndoChange: () => void): Timeline {
	root.addClass('evra-view', 'evra-root');
	setHTML(root, MARKUP);
	const $ = <T extends Element = HTMLElement>(k: string) => q1<T>(root, `[data-r="${k}"]`);
	const stage = $('stage'), svg = $<SVGSVGElement>('svg'), cardsLayer = $('cards'), pop = $('pop'), tipEl = $('tip');
	const sheet = $('sheet'), sheetBody = $('sheetBody'), marqueeEl = $('marquee');
	const win = () => root.win, doc = () => root.doc;
	const raf = (f: FrameRequestCallback) => win().requestAnimationFrame(f);
	const later = (f: () => void, ms: number) => win().setTimeout(f, ms); // the view's own window, so popouts clear the same timers
	const REDUCED = () => win().matchMedia('(prefers-reduced-motion: reduce)').matches;

	// listeners on things outside the view, removed when it closes
	const cleanups: (() => void)[] = [];
	const listen = <K extends keyof DocumentEventMap>(t: Document, type: K, fn: (e: DocumentEventMap[K]) => void, opts?: boolean | AddEventListenerOptions) => {
		t.addEventListener(type, fn, opts);
		cleanups.push(() => t.removeEventListener(type, fn, opts));
	};

	/* ---------- state ---------- */
	let S: EvraDoc = initial;
	const E = makeEngine(() => S);
	const { ci, yearStartT, yearOf, dpy, parts, toT, fmt, fmtRange, evDate, yearStr, monthName, genTicks, snap, stepT, eraDepths, vals } = E;
	let savedView: ViewState | null = null;
	let V = { v0: 0, scale: 1, x: 0, xmin: 0, xmax: 0 }, G: Geo = null, lastL = 0, rafId = 0, animId = 0;
	let sel: string = null, editing: string = null, drag: Drag = null, lod: Layout['mode'] = 'full', F: FrameInfo = { dots: [], bounds: [], eraLabels: [] }, LY: Layout = null;
	let hoverB: { id: string; which: 'start' | 'end' } = null, hoverId: string = null, hist: string[] = [], redo: string[] = [], viewSaveT = 0;
	let popOnClose: (() => void) | null = null, toastT = 0, noAnim = true, destroyed = false, started = false;
	const fresh = new Set<string>(), settling = new Set<string>();
	const pointers = new Map<number, Local>();
	const sigs = new WeakMap<HTMLElement, string>();
	let EV_LIST: EvraEvent[] = [];
	let fadeOf: (id: string) => number = () => 1;

	const threadsOn = () => S.opts.spanStyle !== 'blocks';
	const presetOf = (c: string | null) => c && S.palette.find((p) => p.id === c);
	const col = (c: string | null) => { const p = presetOf(c); return p ? p.hex || `var(--evra-c${p.id})` : 'var(--evra-muted)'; };
	const cssVar = (name: string) => win().getComputedStyle(root).getPropertyValue(name).trim();
	// Any CSS color (including theme blends like color-mix) as #rrggbb: let the browser resolve it, paint a pixel, read it back
	const hexCanvas = createEl('canvas');
	hexCanvas.width = hexCanvas.height = 1;
	const toHex = (color: string): string => {
		const probe = root.createSpan({ cls: 'evra-probe' });
		probe.style.color = color;
		const resolved = win().getComputedStyle(probe).color;
		probe.remove();
		const c = hexCanvas.getContext('2d', { willReadFrequently: true });
		c.clearRect(0, 0, 1, 1);
		c.fillStyle = '#888888';
		c.fillStyle = resolved;
		c.fillRect(0, 0, 1, 1);
		const [r, g, b] = c.getImageData(0, 0, 1, 1).data;
		return '#' + [r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('');
	};
	const hexOf = (p: { id: string; hex: string | null }) => p.hex || toHex(`var(--evra-c${p.id})`);
	/* Per-frame memos. Note lookups go through Obsidian's metadata cache, which is quick once but not
	   thousands of times a frame, so each is asked at most once per frame; note-derived text is kept
	   until the note changes (its stamp). */
	let memoTitle = new Map<string, string>(), memoAges = new Map<string, Age[]>(), memoStamp = new Map<string, number>(), memoLives: { L: EvraEvent; name: string; lname: string }[] = null;
	let memoEpoch = -1;
	let idx = new Map<string, EvraEvent>(), idxFor: EvraEvent[] = null, idxLen = -1;
	const resetMemos = () => { memoTitle = new Map(); memoAges = new Map(); memoStamp = new Map(); memoLives = null; };
	const stampOf = (link: string) => { let v = memoStamp.get(link); if (v == null) { v = host.noteStamp(link); memoStamp.set(link, v); } return v; };
	const titleOf = (ev: EvraEvent) => {
		if (!ev.file) return ev.title || 'Untitled';
		let v = memoTitle.get(ev.file);
		if (v == null) { v = host.noteTitle(ev.file); memoTitle.set(ev.file, v); }
		return v;
	};

	const snapshot = () => JSON.stringify(S);
	function saveSoon() { // the zoom and scroll belong to the workspace, not the file
		win().clearTimeout(viewSaveT);
		viewSaveT = later(() => host.saveViewState(), 400);
	}
	// Undo keeps whole snapshots, so a large timeline is capped by size as well as count: at most 200 steps and about
	// 25 MB of text across undo and redo, dropping the oldest undo steps first but always keeping the last 20.
	const HIST_MAX = 200, HIST_KEEP = 20, HIST_BYTES = 25e6;
	function capHist() {
		if (hist.length > HIST_MAX) hist.splice(0, hist.length - HIST_MAX);
		let total = 0;
		for (const h of hist) total += h.length;
		for (const r of redo) total += r.length;
		while (total > HIST_BYTES && hist.length > HIST_KEEP) total -= hist.shift().length;
	}
	function commit(before: string) {
		docEpoch++;
		resolveRel();
		if (before && before !== snapshot()) { hist.push(before); redo = []; capHist(); host.requestSave(); }
		host.syncNotes(S); updateUndo(); invalidate();
	}
	function restore(json: string) {
		noAnim = true;
		S = normDoc(JSON.parse(json), S.name); E.reset(); docEpoch++;
		if (sel && !S.events.find((e) => e.id === sel)) sel = null;
		editing = null; host.requestSave(); host.syncNotes(S); invalidate();
	}
	function undo() { if (!hist.length) return; popOnClose = null; closePop(); redo.push(snapshot()); restore(hist.pop()); capHist(); updateUndo(); toast('Undone'); if (!sheet.hidden) renderSheet(); }
	function redoF() { if (!redo.length) return; popOnClose = null; closePop(); hist.push(snapshot()); restore(redo.pop()); capHist(); updateUndo(); if (!sheet.hidden) renderSheet(); }
	// The settings panel is redrawn only by actions that change what it shows, never merely because something was saved:
	// redrawing it as a field loses focus would swallow the click that moved the focus.
	function updateUndo() { onUndoChange(); }
	const evById = (id: string): EvraEvent => {
		if (idxFor !== S.events || idxLen !== S.events.length) { idx = new Map(S.events.map((e) => [e.id, e])); idxFor = S.events; idxLen = S.events.length; }
		return idx.get(id);
	};
	const eraById = (id: string) => S.eras.find((e) => e.id === id);
	const descendants = (e: Era) => { const out: Era[] = []; const walk = (id: string) => S.eras.forEach((x) => { if (x.parent === id) { out.push(x); walk(x.id); } }); walk(e.id); return out; };

	/* ---------- geometry ---------- */
	function geo(): Geo {
		if (!stageSize) { stageSize = { w: stage.clientWidth, h: stage.clientHeight }; bottomInset = statusBarOverlap(); root.style.setProperty('--evra-inset', bottomInset + 'px'); }
		const W = stageSize.w, H = stageSize.h, o = S.orientation || 'ttb';
		const vert = o === 'ttb' || o === 'btt', rev = o === 'btt' || o === 'rtl';
		return { W, H, vert, rev, L: vert ? H : W, C: vert ? W : H, cx: (vert ? W : H) / 2, inb: bottomInset };
	}
	const P = (t: number) => (t - V.v0) * V.scale;
	const Sx = (p: number) => (G.rev ? G.L - p : p);
	const ts = (t: number) => Sx(P(t));
	const tAt = (s: number) => V.v0 + (G.rev ? G.L - s : s) / V.scale;
	const xy = (s: number, c: number): [number, number] => (G.vert ? [G.cx + c, s] : [s, G.cx + c]); // G.cx already includes the cross-axis scroll
	let stageRect: DOMRect = null, stageSize: { w: number; h: number } = null, bottomInset = 0;
	// Obsidian's status bar floats over the bottom right of the workspace; anything anchored to the bottom stays clear of it
	function statusBarOverlap(): number {
		const bar = doc().body.querySelector<HTMLElement>('.status-bar');
		if (!bar || !bar.offsetParent) return 0;
		const b = bar.getBoundingClientRect(), r = stage.getBoundingClientRect();
		const overlaps = b.height > 0 && b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.bottom - 80;
		return overlaps ? Math.ceil(r.bottom - b.top) + 2 : 0;
	}
	const rectOf = () => stageRect || (stageRect = stage.getBoundingClientRect());
	function local(e: { clientX: number; clientY: number }): Local {
		const r = rectOf(), x = e.clientX - r.left, y = e.clientY - r.top;
		return G.vert ? { x, y, s: y, c: x - G.cx } : { x, y, s: x, c: y - G.cx };
	}
	const minScale = () => (G.L * 0.8) / Math.max(1, yearStartT(S.range[1]) - yearStartT(S.range[0]));
	function clampView() {
		V.scale = clamp(V.scale, minScale(), MAXS);
		const span = G.L / V.scale, R0 = yearStartT(S.range[0]), R1 = yearStartT(S.range[1]), m = span * 0.15;
		if (span >= R1 - R0 + 2 * m) V.v0 = (R0 + R1) / 2 - span / 2;
		else V.v0 = clamp(V.v0, R0 - m, R1 + m - span);
	}
	function zoomAt(s: number, f: number) { const t = tAt(s); V.scale = clamp(V.scale * f, minScale(), MAXS); V.v0 = t - (G.rev ? G.L - s : s) / V.scale; repaint(); saveSoon(); }
	function animView(tc: number, sc: number, cb?: () => void) {
		if (!G) return;
		sc = clamp(sc, minScale(), MAXS);
		const c0 = V.v0 + G.L / 2 / V.scale, s0 = V.scale, dur = REDUCED() ? 0 : 300, st = performance.now();
		win().cancelAnimationFrame(animId);
		const step = (now: number) => {
			if (destroyed) return;
			const k = dur ? Math.min(1, (now - st) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
			V.scale = Math.exp(Math.log(s0) + (Math.log(sc) - Math.log(s0)) * e);
			V.v0 = c0 + (tc - c0) * e - G.L / 2 / V.scale;
			frame();
			if (k < 1) animId = raf(step); else { saveSoon(); if (cb) cb(); }
		};
		animId = raf(step);
	}
	const fitScale = (a: number, b: number) => (G.L * 0.84) / Math.max(b - a, dpy() * 0.5);
	function fitRange(a: number, b: number, cb?: () => void) { animView((a + b) / 2, fitScale(a, b), cb); }
	function contentBounds(): [number, number] | null {
		let a = Infinity, b = -Infinity;
		S.events.forEach((e) => { a = Math.min(a, e.t); b = Math.max(b, e.end != null && !e.oe ? e.end : e.t); });
		S.eras.forEach((e) => { a = Math.min(a, e.start); b = Math.max(b, e.end); });
		return a === Infinity ? null : [a, b];
	}
	function fitAll(now?: boolean) {
		const cb = contentBounds() || [yearStartT(S.range[0]), yearStartT(S.range[1])];
		if (now) { V.scale = fitScale(cb[0], cb[1]); V.v0 = (cb[0] + cb[1]) / 2 - G.L / 2 / V.scale; clampView(); invalidate(); }
		else fitRange(cb[0], cb[1]);
	}
	function ensureRange(ev: { t: number; end?: number }) {
		const a = ev.t, b = ev.end != null ? ev.end : ev.t;
		if (a < yearStartT(S.range[0])) S.range[0] = yearOf(a);
		if (b > yearStartT(S.range[1])) S.range[1] = yearStartT(yearOf(b)) === b ? yearOf(b) : yearOf(b) + 1;
	}

	/* ---------- cards: size and stacking ----------
	   Cards sit exactly at their date. Overlaps stack outward into columns (side by side on a vertical line, rows on a horizontal one). */
	const noteSrc = (ev: EvraEvent) => (ev.file ? host.noteText(ev.file) || '' : '');
	const noteCache = new Map<string, { stamp: number; desc: string; plain: string; cover: string | null }>();
	function noteInfo(link: string) {
		const stamp = stampOf(link), hit = noteCache.get(link);
		if (hit && hit.stamp === stamp) return hit;
		const src = host.noteText(link);
		const desc = noteExcerpt(src || ''), info = { stamp: src == null ? -1 : stamp, desc, plain: plainOf(desc).trim(), cover: host.coverOf(link) };
		if (noteCache.size > 5000) noteCache.clear();
		noteCache.set(link, info);
		return info;
	}
	function descOf(ev: EvraEvent): string { return ev.file ? noteInfo(ev.file).desc : ev.text || ''; }
	const plainDesc = (ev: EvraEvent) => (ev.file ? noteInfo(ev.file).plain : plainOf(ev.text || '').trim());
	let measureFont = '', lastFont = '', family = '';
	const uiFamily = () => family || (family = win().getComputedStyle(stage).fontFamily || 'sans-serif'); // read once: asking for styles mid-frame forces a recalculation
	let serif = '';
	const eraFamily = () => serif || (serif = cssVar('--evra-f-era') || 'Georgia, serif');
	const measureCtx = createEl('canvas').getContext('2d'), measureCache = new Map<string, number>();
	const measure = (text: string, width: number) => {
		const k = width + '|' + text, hit = measureCache.get(k);
		if (hit != null) return hit;
		if (measureCache.size > 3000) measureCache.clear();
		if (!measureFont) measureFont = `400 12.5px ${uiFamily()}`;
		if (lastFont !== measureFont) { measureCtx.font = measureFont; lastFont = measureFont; }
		let lines = 0;
		for (const para of text.split('\n')) lines += Math.max(1, Math.ceil((measureCtx.measureText(para).width * 1.1) / Math.max(40, width)));
		measureCache.set(k, lines);
		return lines;
	};
	function descLines(ev: EvraEvent, width: number) { const d = plainDesc(ev); return d ? Math.min(S.opts.cardLines, measure(d, width - 24)) : 0; }
	const coverOf = (ev: EvraEvent) => (ev.file ? noteInfo(ev.file).cover : null);
	function cardSize(ev: EvraEvent, width: number) {
		const n = descLines(ev, width);
		return Math.round(BASE_H + (n ? n * LINE_H + 3 : 0) + ((ev.tags || []).length ? 19 : 0) + (coverOf(ev) ? 70 : 0) + (ev.rel ? 17 : 0) + (agesOf(ev).length ? 20 : 0));
	}
	function pack(mode: 'full' | 'compact', cr: number): Layout {
		const vert = G.vert, full = mode === 'full';
		const len = vert ? (full ? GROUP_H : 38) : full ? 220 : 150, off = vert ? (full ? 18 : 19) : 20; // len: the typical size, for grouping and costs
		// Each card's own size: along the time axis on a vertical line, across it on a horizontal one
		const sizeOf = (it: Item): [number, number] => (!full ? [len, vert ? cr : 38] : it.group ? (vert ? [GROUP_H, cr] : [220, GROUP_H]) : vert ? [cardSize(it.ev, cr), cr] : [220, cardSize(it.ev, 220)]);
		const offOf = (l: number) => (G.rev ? l - off : off), offP = offOf(len);
		const margin = G.rev ? 12 : vert ? 50 : 12;
		const out: Layout = { mode, len, offP, items: [], ext: { a: 0, b: 0 }, ribbons: { a: [], b: [] }, groups: {} };
		// More than N moments in one year on one side collapse into a group card, until you zoom in far enough to spread them out
		const y = dpy(), grouping = y * V.scale < len * 4.5, loose = drag && drag.type === 'card' ? drag.id : null;
		for (const side of ['a', 'b'] as Side[]) {
			// only lay out what is on screen or within a screen of it; far-off cards cannot affect what you see
			const span_ = G.L / V.scale, tLo = V.v0 - span_, tHi = V.v0 + 2 * span_;
			const evs = EV_LIST.filter((e) => e.side === side && (e.end != null ? e.end : e.t) >= tLo && e.t <= tHi);
			let single = evs.filter((e) => e.end == null);
			const grps: Item[] = [];
			if (grouping) {
				const byYear = new Map<number, EvraEvent[]>();
				single.forEach((ev) => { if (ev.id === loose) return; const k = yearOf(ev.t); if (!byYear.has(k)) byYear.set(k, []); byYear.get(k).push(ev); });
				for (const [yr, list] of byYear) if (S.opts.groupOver > 0 && list.length > S.opts.groupOver) {
					list.sort((p, q) => p.t - q.t);
					grps.push({ group: true, gid: 'g:' + list[0].id, year: yr, members: list, ev: list[0], side, a: 0, lo: 0, hi: 0 });
				}
				const inGroup = new Set(grps.flatMap((g) => g.members.map((m) => m.id)));
				single = single.filter((e) => !inGroup.has(e.id));
			}
			grps.forEach((g) => (out.groups[g.gid] = g));
			const items: Item[] = [
				...[...single.map((ev): Item => ({ ev, side, a: 0, lo: 0, hi: 0 })), ...grps].map((it) => Object.assign(it, { a: P(it.ev.t) - offP, lo: -Infinity, hi: Infinity })),
				// a span's card starts at the span's start and may slide later, but never outside its block
				...evs.filter((e) => e.end != null).map((ev): Item => {
					if (threadsOn()) return { ev, side, a: P(ev.t) - offP, lo: -Infinity, hi: Infinity, along: Math.max(0, P(ev.end) - P(ev.t) - 24) }; // a card that can sit anywhere along its thread
					const a = P(ev.t), rb = Math.max(P(ev.end), a + len);
					return { ev, side, span: true, a, ra: a, rb, lo: 0, hi: rb - a - len };
				}),
			].sort((p, q) => (q.span ? 1 : 0) - (p.span ? 1 : 0) || p.a - q.a || (p.span ? q.rb - q.ra - (p.rb - p.ra) : 0)); // spans first, so they hug the line
			// Cards stack snugly: each sits right against whatever is already beside the line at its moment, so short cards
			// never inherit a tall neighbour's row. A card weighs sliding along the time axis against moving further out, and takes the cheaper.
			const unit = (vert ? cr : BASE_H) + GAPC, penalty = (len * 0.8) / unit, maxShift = len * 1.1;
			const placed: Rect[] = [], ribs: Rect[] = []; // placed card rects and span-block rects: [t0, t1, c0, c1]
			// placed cards are also bucketed along the time axis, so each card only looks at its neighbours
			const BK = Math.max(200, (maxShift + len) * 2), buckets = new Map<number, Rect[]>();
			const addRect = (r: Rect) => { for (let k = Math.floor(r[0] / BK); k <= Math.floor(r[1] / BK); k++) { if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(r); } };
			const around = (lo: number, hi: number) => {
				const found = new Set<Rect>();
				for (let k = Math.floor(lo / BK); k <= Math.floor(hi / BK); k++) (buckets.get(k) || []).forEach((r) => { if (r[1] > lo && r[0] < hi) found.add(r); });
				return [...found];
			};
			// lowest cross offset at or above `floor` where a card fits between t0 and t1; rects must be sorted by their inner edge
			const lowestSorted = (t0: number, t1: number, h: number, rects: Rect[], floor = 0) => {
				let c = Math.max(0, floor);
				for (const r of rects) {
					if (!(t1 + GAPC > r[0] && t0 < r[1] + GAPC)) continue;
					if (c + h <= r[2] - GAPC) break;
					c = Math.max(c, r[3] + GAPC);
				}
				return c;
			};
			const byInner = (rects: Rect[]) => rects.slice().sort((x, z) => x[2] - z[2]);
			const lowest = (t0: number, t1: number, h: number, rects: Rect[]) => lowestSorted(t0, t1, h, byInner(rects));
			for (const it of items) {
				const [ln, cw] = sizeOf(it), oP = offOf(ln);
				it.len = ln; it.cr = cw;
				if (!it.span) it.a = it.a + offP - oP; // keep the stem at the card's header whatever its size
				if (it.span && it.hi !== Infinity) it.hi = Math.max(0, it.rb - it.ra - ln);
				const near = byInner(around(it.a - maxShift - ln - GAPC, it.a + Math.max(maxShift, Math.min(it.along || 0, G.L * 2)) + ln + GAPC));
				const cands = new Set([it.a]);
				near.forEach((r) => { cands.add(r[1] + GAPC); cands.add(r[0] - GAPC - ln); });
				const ribFloor = it.span ? lowest(it.ra, it.rb, cw, ribs) : 0; // span blocks never overlap each other
				let best: { cost: number; t: number; c: number } = null;
				for (const t of cands) {
					const sh = t - it.a, along = it.along != null && sh >= 0 && sh <= it.along; // sliding along its own thread is cheap
					if (!along && (Math.abs(sh) > maxShift + 0.01 || sh < it.lo - 0.01 || sh > it.hi + 0.01)) continue;
					let c = lowestSorted(t, t + ln, cw, near);
					if (c < ribFloor) c = lowestSorted(t, t + ln, cw, near, ribFloor);
					const cost = (along ? sh * 0.25 : Math.abs(sh)) + c * penalty;
					if (!best || cost < best.cost - 0.01) best = { cost, t, c };
				}
				if (!best) best = { cost: 0, t: it.a, c: lowestSorted(it.a, it.a + ln, cw, near, it.span ? ribFloor : 0) };
				it.a = best.t; it.b = best.t + ln; it.cOff = best.c; it.pos = it.a; it.offP = oP;
				const rect: Rect = [it.a, it.b, it.cOff, it.cOff + cw];
				placed.push(rect); addRect(rect);
				if (it.span) ribs.push([it.ra, it.rb, it.cOff, it.cOff + cw]);
			}
			// Span cards stay in view while their span does, stopping short of the next card stacked in their way
			for (const it of items) if (it.span) {
				// where the card wants to be (the top of the view), stopping short of the next card in its column, and clear of the one before
				const inCol = placed.filter((r) => r[0] > it.a + 0.01 && r[2] < it.cOff + it.cr && r[3] > it.cOff);
				const want = Math.max(it.a, Math.min(margin, it.rb - it.len));
				const next = Math.min(...inCol.filter((r) => r[1] > want).map((r) => r[0]), Infinity);
				const prev = Math.max(...inCol.filter((r) => r[1] <= want).map((r) => r[1] + GAPC), -Infinity);
				it.pos = Math.max(it.a, Math.min(Math.max(want, prev), it.rb - it.len, next - GAPC - it.len));
				out.ribbons[side].push([it.ra, it.rb, it.cOff, it.cOff + it.cr]);
			}
			for (const it of items) {
				it.lo = Math.min(it.a, it.ra ?? it.a); it.hi = Math.max(it.b, it.rb ?? it.b);
				if (it.hi > -60 && it.lo < G.L + 60) out.ext[side] = Math.max(out.ext[side], it.cOff + it.cr);
				out.items.push(it);
			}
		}
		return out;
	}
	// Threads: each span gets a lane beside the line, reused once the earlier span has ended
	let lanesMemo: { key: string; v: ReturnType<typeof threadLanes_> } = null;
	function threadLanes() {
		const key = contentEpoch + '|' + S.opts.spanStyle + '|' + EV_LIST.length;
		if (!lanesMemo || lanesMemo.key !== key) lanesMemo = { key, v: threadLanes_() };
		return lanesMemo.v;
	}
	function threadLanes_() {
		const lanes: Record<string, number> = {}, n = { a: 0, b: 0 }, bundled = new Set<string>();
		if (!threadsOn()) return { lanes, n, bundled };
		for (const side of ['a', 'b'] as Side[]) {
			const ends: number[] = [];
			EV_LIST.filter((e) => e.side === side && e.end != null).sort((x, y) => x.t - y.t || y.end - x.end).forEach((e) => {
				let i = ends.findIndex((v) => v < e.t);
				if (i < 0) { i = ends.length; ends.push(0); }
				ends[i] = e.oe ? Infinity : e.end; lanes[e.id] = i;
			});
			n[side] = ends.length;
			if (n[side] > MAXL) { S.events.forEach((e) => { if (e.side === side && lanes[e.id] >= MAXL - 1) { lanes[e.id] = MAXL - 1; bundled.add(e.id); } }); n[side] = MAXL; }
		}
		return { lanes, n, bundled };
	}
	function chooseLayout(): Layout {
		const th = threadLanes(), gut = { a: GUT + th.n.a * LANE, b: GUT + th.n.b * LANE };
		const r = chooseLayout_(Math.max(gut.a, gut.b));
		r.gut = gut; r.lanes = th.lanes; r.bundled = th.bundled;
		return r;
	}
	function chooseLayout_(gmax: number): Layout {
		// Full cards unless a stretch gets genuinely crowded. Width never shrinks to fit; extra columns overflow and the timeline scrolls across instead.
		const fit = G.C / 2 - gmax - 16, w = S.cardWidth || 240;
		const limits: ['full' | 'compact', number][] = [['full', lod === 'full' ? 6 : 5], ['compact', lod === 'dots' ? 8 : 10]];
		// a quick count first: if even perfectly packed cards could not fit, skip that level without laying it out
		const t0 = V.v0, t1 = V.v0 + G.L / V.scale, cnt = { a: 0, b: 0 };
		EV_LIST.forEach((e) => { if ((e.end != null ? e.end : e.t) >= t0 && e.t <= t1) cnt[e.side]++; });
		for (const [mode, maxCols] of limits) {
			const cr = G.vert ? clamp(fit, 150, mode === 'full' ? w : Math.min(w, 210)) : mode === 'full' ? BASE_H : 38;
			const minLen = G.vert ? (mode === 'full' ? BASE_H : 38) : mode === 'full' ? 220 : 150;
			if (Math.max(cnt.a, cnt.b) * (minLen + GAPC) > (G.L + minLen) * maxCols * 1.5) continue;
			const r = pack(mode, cr);
			const typical = (G.vert ? cr : mode === 'full' ? 90 : 38) + GAPC; // how far out 'maxCols' cards reach
			if (Math.max(r.ext.a, r.ext.b) <= maxCols * typical) { r.cross = { a: cr, b: cr }; return r; }
		}
		return { mode: 'dots', items: [], ext: { a: 0, b: 0 }, cross: { a: 0, b: 0 }, ribbons: { a: [], b: [] }, groups: {}, tags: { a: [], b: [] } };
	}
	const innerEdge = (it: Item) => LY.gut[it.side] + (it.cOff || 0);
	const crossOf = (it: Item) => (G.vert ? LY.cross[it.side] : it.cr);

	/* ---------- render ---------- */
	let layoutDirty = true, layoutKey = '', docEpoch = 0, cssEpoch = 0, contentEpoch = 0;
	function invalidate() { layoutDirty = true; contentEpoch++; if (!rafId && !destroyed) rafId = raf(frame); }
	/** Redraw without laying cards out again: for hover, which changes how things look but not where they go. */
	function repaint() { if (!rafId && !destroyed) rafId = raf(frame); }
	const pt = (s: number, c: number) => xy(s, c).map(rd);
	function seg(s1: number, c1: number, s2: number, c2: number, style: string): SvgEl {
		const [x1, y1] = pt(s1, c1), [x2, y2] = pt(s2, c2);
		return svgEl('line', { x1, y1, x2, y2 }, style);
	}
	function circ(s: number, c: number, r: number, style: string): SvgEl { const [cx, cy] = pt(s, c); return svgEl('circle', { cx, cy, r }, style); }
	const pathEl = (d: string, style: string, extra: Record<string, string> = {}) => svgEl('path', { d, ...extra }, style);
	function band(lo: number, hi: number, style: string): SvgEl {
		return G.vert ? svgEl('rect', { x: 0, y: rd(lo), width: G.W, height: rd(hi - lo) }, style) : svgEl('rect', { x: rd(lo), y: 0, width: rd(hi - lo), height: G.H }, style);
	}
	function text(x: number, y: number, str: string | number, cls: string, era?: string): SvgEl {
		const el = svgEl('text', { x: rd(x), y: rd(y), class: cls });
		if (era) el.setAttribute('data-era', era);
		el.textContent = String(str);
		return el;
	}
	function gradient(id: string, a: [number, number], b: [number, number], stops: [number, string, number][]): SvgEl {
		const g = svgEl('linearGradient', { id, gradientUnits: 'userSpaceOnUse', x1: rd(a[0]), y1: rd(a[1]), x2: rd(b[0]), y2: rd(b[1]) });
		stops.forEach(([o, c, op]) => g.appendChild(svgEl('stop', { offset: o }, `stop-color:${c};stop-opacity:${op}`)));
		return g;
	}
	const gradId = (k: string) => 'evra-' + viewKey + '-' + k; // gradient ids must be unique across every open timeline
	const viewKey = uid();

	// A stem runs straight out to its card and simply passes under any card in the way. Where it crosses
	// another span's block it turns dotted and faint, so the block stays readable.
	function stemPaths(it: Item, p: number, inner: number, color: string, on: boolean, f = 1): SvgEl[] {
		const anchor = it.span ? p : it.pos + it.offP, sg = it.side === 'a' ? -1 : 1;
		const solid = `stroke:${color};stroke-width:1.2;fill:none;opacity:${(on ? 0.95 : 0.55) * f}`, faint = `stroke:${color};stroke-width:1.2;fill:none;stroke-dasharray:1.5 3.5;opacity:${(on ? 0.7 : 0.35) * f}`;
		const P2 = (pts: [number, number][]) => pts.map(([q, c]) => xy(Sx(q), sg * c));
		const out: SvgEl[] = [], g0 = LY.gut[it.side], start = g0 - 4;
		const lane = threadsOn() && !it.group && it.ev.end != null && LY.lanes[it.ev.id] != null ? laneC(LY.lanes[it.ev.id]) : null;
		let head: [number, number][];
		if (lane != null) { // a span's card connects to its own thread, wherever the card sits along it
			const ps = P(it.ev.t), pe = P(it.ev.end), r = Math.max(4, Math.min(24, (pe - ps) / 2.5)), q = clamp(anchor, ps + r, Math.max(ps + r, pe - r)), mid = (lane + start) / 2;
			head = Math.abs(anchor - q) > 1 ? [[q, lane], [q, mid], [anchor, mid], [anchor, start]] : [[q, lane], [anchor, start]];
		} else head = Math.abs(anchor - p) > 1 ? [[p, 6], [p, g0 - 8], [anchor, g0 - 8], [anchor, start]] : [[p, 6], [anchor, start]]; // slid cards bend just outside the threads
		const runs: { from: number; to: number; dashed: boolean }[] = [];
		let c = start, cur: { from: number; to: number; dashed: boolean } = null;
		const push = (to: number, dashed: boolean) => { if (to <= c + 0.1) return; if (cur && cur.dashed === dashed) cur.to = to; else runs.push((cur = { from: c, to, dashed })); c = to; };
		LY.ribbons[it.side].filter((r) => anchor >= r[0] && anchor <= r[1] && r[3] <= it.cOff + 0.5).sort((x, y) => x[2] - y[2]).forEach((r) => { push(g0 + r[2], false); push(g0 + r[3], true); });
		push(inner, false);
		out.push(pathEl(roundPath(P2(head), 7), solid));
		runs.forEach((r) => out.push(pathEl(roundPath(P2([[anchor, r.from], [anchor, r.to]]), 0), r.dashed ? faint : solid)));
		return out;
	}
	function roundPath(pts: [number, number][], r: number) {
		pts = pts.filter((p, i, a) => i === 0 || Math.hypot(p[0] - a[i - 1][0], p[1] - a[i - 1][1]) > 0.5);
		let d = `M${rd(pts[0][0])},${rd(pts[0][1])}`;
		for (let i = 1; i < pts.length - 1; i++) {
			const [px, py] = pts[i - 1], [qx, qy] = pts[i], [nx, ny] = pts[i + 1];
			const l1 = Math.hypot(qx - px, qy - py), l2 = Math.hypot(nx - qx, ny - qy), k = Math.min(r, l1 / 2, l2 / 2);
			d += ` L${rd(qx - ((qx - px) / l1) * k)},${rd(qy - ((qy - py) / l1) * k)} Q${rd(qx)},${rd(qy)} ${rd(qx + ((nx - qx) / l2) * k)},${rd(qy + ((ny - qy) / l2) * k)}`;
		}
		const e = pts[pts.length - 1];
		return d + ` L${rd(e[0])},${rd(e[1])}`;
	}

	function frame() {
		rafId = 0;
		if (destroyed) return;
		resolveRel();
		if (memoEpoch !== contentEpoch) { resetMemos(); memoEpoch = contentEpoch; }
		EV_LIST = filterOn() && FLT.mode === 'hide' ? S.events.filter(matches) : S.events;
		G = geo();
		if (G.L < 20 || G.C < 20) return;
		if (!started) start();
		if (lastL && lastL !== G.L) { const c = V.v0 + lastL / 2 / V.scale; V.v0 = c - G.L / 2 / V.scale; }
		lastL = G.L; clampView();
		const L = G.L, C = G.C, t0 = V.v0, t1 = V.v0 + L / V.scale;
		const tk = E.pickTicks(V.scale), sn = S.opts.snapTo, cI = ci();
		E.setSnap(sn === 'd' ? { u: 'd', k: 1, len: 1 } : sn === 'm' && cI.M > 1 ? { u: 'm', k: 1, len: cI.avgM } : sn === 'y' ? { u: 'y', k: 1, len: cI.Yavg } : tk.minor || tk.major);
		const dep = eraDepths();
		const key = [V.v0, V.scale, G.W, G.H, S.orientation, filterOn() ? FLT.mode : ''].join('|');
		if (layoutDirty || key !== layoutKey || !LY) { LY = chooseLayout(); lod = LY.mode; layoutKey = key; layoutDirty = false; }
		const items = LY.items;
		let extA = 0, extB = 0;
		for (const it of items) if (it.hi > -60 && it.lo < L + 60) { const e = innerEdge(it) + crossOf(it); if (it.side === 'a') extA = Math.max(extA, e); else extB = Math.max(extB, e); }
		V.xmin = Math.min(0, C / 2 - 16 - extA); V.xmax = Math.max(0, extB + 16 - C / 2);
		V.x = clamp(V.x, V.xmin, V.xmax); G.cx = C / 2 - V.x; G.ext = { a: extA, b: extB };
		const out: SvgEl[] = [], defs: SvgEl[] = [];
		F = { dots: [], bounds: [], eraLabels: [] };
		const cx = G.cx, cS = (s: number) => clamp(s, -80, L + 80), vis = (a: number, b: number) => Math.max(a, b) >= -80 && Math.min(a, b) <= L + 80;
		const R0 = yearStartT(S.range[0]), R1 = yearStartT(S.range[1]);
		const eras = [...S.eras].sort((a, b) => a.start - b.start || dep[a.id] - dep[b.id]);
		const top = eras.filter((e) => dep[e.id] === 1);

		// eras: bands, hairlines, labels
		const hair = new Set<number>();
		top.forEach((e, i) => {
			const a = ts(e.start), b = ts(e.end);
			if (!vis(a, b)) return;
			if (S.opts.bands) out.push(band(cS(Math.min(a, b)), cS(Math.max(a, b)), `fill:${col(e.color)};opacity:var(--evra-band-${i % 2 ? 'b' : 'a'})`));
			[a, b].forEach((s) => { if (s > -2 && s < L + 2) hair.add(Math.round(s)); });
		});
		const gridAt = out.length; // faint year guides go under everything else
		hair.forEach((s) => out.push(seg(s, -cx, s, cx, 'stroke:var(--evra-line);stroke-width:1')));
		if (lod === 'dots') {
			eras.forEach((e) => {
				const d = dep[e.id];
				if (d > 2) return;
				const a = ts(e.start), b = ts(e.end), lo = Math.max(Math.min(a, b), 0), hi = Math.min(Math.max(a, b), L);
				if (hi - lo < (d === 1 ? 70 : 44)) return;
				const m = (lo + hi) / 2, off = C * (d === 1 ? 0.26 : 0.24) * (d === 1 ? -1 : 1);
				const [x, yy] = xy(m, G.vert ? clamp(off, -cx + 80, cx - 80) : clamp(off, -cx + 24, cx - 24));
				out.push(text(x, yy, e.name, d === 1 ? 'era-big' : 'era-mid', e.id));
			});
		} else top.forEach((e) => { const s = ts(e.start); if (s > -4 && s < L - 10) F.eraLabels.push({ id: e.id, name: e.name, s, sub: false, lvl: 1 }); });

		// selection along the line
		if (drag && drag.type === 'select' && drag.b != null) out.push(seg(ts(drag.a), 0, ts(drag.b), 0, 'stroke:var(--evra-accent);stroke-width:14;opacity:.22;stroke-linecap:round'));

		// the line
		out.push(seg(0, 0, L, 0, 'stroke:var(--evra-line);stroke-width:1.2;stroke-dasharray:2 5'));
		const r0 = ts(R0), r1 = ts(R1);
		if (vis(r0, r1)) out.push(seg(cS(r0), 0, cS(r1), 0, 'stroke:var(--evra-line);stroke-width:1.6'));
		const notched = new Set<string>();
		eras.forEach((e) => {
			const d = dep[e.id];
			(['start', 'end'] as const).forEach((w) => {
				const s = ts(e[w]);
				if (s < -10 || s > L + 10) return;
				F.bounds.push({ id: e.id, which: w, s, dep: d });
				if (d < 2) return;
				const k = Math.round(s) + ':' + d;
				if (notched.has(k)) return;
				notched.add(k);
				const h = d === 2 ? 7 : d === 3 ? 5 : 3.5;
				out.push(seg(s, -h, s, h, 'stroke:var(--evra-muted);stroke-width:1.4'));
			});
		});
		[r0, r1].forEach((s) => { if (s > -10 && s < L + 10) out.push(seg(s, -10, s, 10, 'stroke:var(--evra-muted);stroke-width:2;stroke-linecap:round')); });

		// ticks
		const ta = Math.max(t0, R0), tb = Math.min(t1, R1);
		const majors = genTicks(tk.major, ta, tb, 200), isMajor = new Set(majors);
		if (tk.minor) for (const t of genTicks(tk.minor, ta, tb, 600)) { if (isMajor.has(t)) continue; const s = ts(t); out.push(seg(s, -2, s, 2, 'stroke:var(--evra-faint);stroke-width:1;opacity:.7')); }
		// Year labels live in a ruler at the edge, joined to the line by faint guides, so the line stays clear
		const guides: SvgEl[] = [];
		F.ticks = [];
		for (const t of majors) {
			const s = ts(t);
			out.push(seg(s, -5, s, 5, 'stroke:var(--evra-faint);stroke-width:1.2'));
			guides.push(G.vert ? svgEl('line', { x1: RULER, y1: rd(s), x2: G.W, y2: rd(s) }, 'stroke:var(--evra-guide);stroke-width:1') : svgEl('line', { x1: rd(s), y1: 0, x2: rd(s), y2: G.H - 26 - G.inb }, 'stroke:var(--evra-guide);stroke-width:1'));
			F.ticks.push({ s, label: E.tickLabel(t) });
		}
		out.splice(gridAt, 0, ...guides);
		F.ticks2 = [];
		if (sec().on) { // second calendar: its own year marks on the far edge
			const yd = Math.max(1, sec().yearDays), k = [1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 1e4].find((n) => yd * n * V.scale >= 74) || 1e4;
			for (let y2 = Math.ceil(secYear(t0) / k) * k; sec().offset + y2 * yd <= t1 && F.ticks2.length < 200; y2 += k) F.ticks2.push({ s: ts(sec().offset + y2 * yd), label: secLabel(y2) });
		}
		if (lod !== 'dots') eras.forEach((e) => {
			if (!S.opts.subLabels && dep[e.id] > 1) return;
			if (dep[e.id] < 2) return;
			const s = ts(e.start);
			if (s < -4 || s > L - 8) return;
			F.eraLabels.push({ id: e.id, name: e.name, s, sub: true, lvl: dep[e.id] });
		});
		// labels that start at the same moment stack, outermost era first
		F.eraLabels.sort((a, b) => a.s - b.s || a.lvl - b.lvl);
		if (G.vert) { // labels run down the edge: push each one below the label above it
			let lastEnd = -Infinity;
			F.eraLabels.forEach((t) => { t.lead = Math.max(0, lastEnd - t.s); lastEnd = t.s + t.lead + 24; });
		} else { // labels run along the bottom: a label that would overlap the one before it moves up a row
			const spans = F.eraLabels.map((t) => { const w = eraLabelWidth(t); return { t, lo: G.rev ? t.s - 6 - w : t.s + 6, hi: G.rev ? t.s - 6 : t.s + 6 + w }; }).sort((a, b) => a.lo - b.lo);
			const rows: number[] = [];
			spans.forEach(({ t, lo, hi }) => {
				let r = rows.findIndex((end) => end + 6 <= lo);
				if (r < 0) { r = rows.length; rows.push(0); }
				rows[r] = hi; t.row = r; t.lead = 0;
			});
		}
		// the era rail: every era, at every depth, as a bar beside the ruler
		const maxDep = Math.max(0, ...S.eras.map((e) => dep[e.id]));
		F.railW = maxDep ? maxDep * 7 + 4 : 0;
		eras.forEach((e) => {
			const a = ts(e.start), b = ts(e.end);
			if (!vis(a, b)) return;
			const lo = cS(Math.min(a, b)), hi = cS(Math.max(a, b)), k = dep[e.id] - 1;
			const bar = G.vert
				? svgEl('rect', { 'data-era': e.id, x: RULER + 3 + k * 7, y: rd(lo + 1), width: 5, height: rd(Math.max(2, hi - lo - 2)), rx: 2.5 }, `fill:${col(e.color)};opacity:.75;cursor:pointer`)
				: svgEl('rect', { 'data-era': e.id, x: rd(lo + 1), y: G.H - 34 - G.inb - k * 7, width: rd(Math.max(2, hi - lo - 2)), height: 5, rx: 2.5 }, `fill:${col(e.color)};opacity:.75;cursor:pointer`);
			const title = svgEl('title', {});
			title.textContent = e.name;
			bar.appendChild(title);
			out.push(bar);
		});

		const hl = new Set([sel, hoverId].filter(Boolean));
		const groupOf: Record<string, string> = {};
		Object.values(LY.groups || {}).forEach((g) => g.members.forEach((m) => (groupOf[m.id] = g.gid)));
		const focusId = hoverId, focusKey = focusId && (groupOf[focusId] || focusId);
		const dimOut = filterOn() && FLT.mode === 'dim';
		const gMatch = (id: string) => { const g = LY.groups && LY.groups[id]; return g ? g.members.some(matches) : evById(id) ? matches(evById(id)) : true; };
		const future = S.opts.fadeFuture && S.now != null, evT = (id: string) => { const g = LY.groups && LY.groups[id]; return g ? g.ev.t : (evById(id) || { t: 0 }).t; };
		// only hovering fades the rest; selecting doesn't
		const fade0 = (id: string) => (dimOut && !gMatch(id) && !isSel(id) ? DIM_SELECT : !focusKey || (groupOf[id] || id) === focusKey ? 1 : DIM_HOVER);
		fadeOf = (id) => { const f = fade0(id); return future && evT(id) > S.now ? Math.min(f, 0.45) : f; };
		// far zoom: span blocks become slim strips stacked beside the line
		if (lod === 'dots' && !threadsOn()) {
			for (const side of ['a', 'b'] as Side[]) {
				const cols: [number, number][][] = [], sg = side === 'a' ? -1 : 1;
				EV_LIST.filter((e) => e.side === side && e.end != null).sort((x, y) => x.t - y.t).forEach((ev) => {
					const a = P(ev.t), b = P(ev.end);
					let j = 0;
					for (; j < cols.length; j++) if (cols[j].every(([x, y]) => b + 6 <= x || a >= y + 6)) break;
					if (j === cols.length) cols.push([]);
					cols[j].push([a, b]);
					const sS = ts(ev.t), sE = ts(ev.end);
					if (!vis(sS, sE)) return;
					const c = col(ev.color), lc = sg * (14 + j * 8), cs1 = cS(sS), cs2 = cS(sE);
					let stroke = c;
					if (ev.os || ev.oe) {
						const gid = gradId('g' + ev.id), stops: [number, string, number][] = [[0, c, ev.os ? 0 : 1]];
						if (ev.os) stops.push([0.35, c, 1]);
						if (ev.oe) stops.push([0.65, c, 1]);
						stops.push([1, c, ev.oe ? 0 : 1]);
						defs.push(gradient(gid, xy(cs1, lc), xy(cs2, lc), stops));
						stroke = `url(#${gid})`;
					}
					out.push(seg(cs1, lc, cs2, lc, `stroke:${stroke};stroke-width:4;stroke-linecap:round;opacity:.85`));
				});
			}
		}
		// a hovered or selected span lights up its full extent on the line
		if (!threadsOn()) EV_LIST.forEach((ev) => {
			if (ev.end == null || !hl.has(ev.id)) return;
			const a = ts(ev.t), b = ts(ev.end);
			if (vis(a, b)) out.push(seg(cS(a), 0, cS(b), 0, `stroke:${col(ev.color)};stroke-width:3.5;stroke-linecap:round`));
		});

		// stems: straight out from the moment to its card
		const visItems = items.filter((it) => it.hi > -120 && it.lo < L + 120);
		const threadOut: SvgEl[] = [], bundleHits: { ev: EvraEvent; side: Side; ps: number; pe: number }[] = [];
		LY.tags = { a: [], b: [] };
		if (threadsOn()) {
			// Each span is a thread: it peels off the line at its start, runs in its lane, and rejoins at its end.
			// A name tag pins to the leading edge while the start is scrolled past.
			const edge = G.rev ? 14 : G.vert ? 52 : 14;
			EV_LIST.forEach((ev) => {
				if (ev.end == null || LY.lanes[ev.id] == null) return;
				const ps = P(ev.t), pe = P(ev.end);
				if (pe < -80 || ps > L + 80) return;
				const sg = ev.side === 'a' ? -1 : 1, lc = sg * laneC(LY.lanes[ev.id]), c = col(ev.color), on = hl.has(ev.id);
				if (lod === 'dots' && pe - ps < 36 && !on) return; // zoomed far out, a short span is just its dot
				const r = Math.max(4, Math.min(24, (pe - ps) / 2.5)), a0 = Math.max(ps, -80), b0 = Math.min(pe, L + 80);
				const M = (p: number, cc: number) => xy(Sx(p), cc).map(rd).join(',');
				let d = ps < -80 ? `M${M(a0, lc)}` : `M${M(ps, 0)} C${M(ps + r * 0.55, 0)} ${M(ps + r * 0.45, lc)} ${M(ps + r, lc)}`;
				d += pe > L + 80 ? ` L${M(b0, lc)}` : ` L${M(pe - r, lc)} C${M(pe - r * 0.45, lc)} ${M(pe - r * 0.55, 0)} ${M(pe, 0)}`;
				const inB = LY.bundled && LY.bundled.has(ev.id);
				// spans past the lane limit share one bundled lane, drawn once below; a hovered one still shows on its own
				if (inB && !on) { bundleHits.push({ ev, side: ev.side, ps, pe }); return; }
				threadOut.push(
					pathEl(d, `stroke:${c};stroke-width:${on ? 3.5 : 2.5};fill:none;stroke-linecap:round;opacity:${on ? 1 : 0.85 * fadeOf(ev.id)}`),
					pathEl(d, 'stroke:transparent;stroke-width:12;fill:none;pointer-events:stroke;cursor:pointer', { 'data-thread': ev.id }),
				);
				if (!inB && ps < edge - 4 && pe > edge + 40) LY.tags[ev.side].push({ ev, c: laneC(LY.lanes[ev.id]), color: c });
			});
		}
		visItems.forEach((it) => { // a group gathers its moments with a small bracket beside the line
			if (!it.group) return;
			const sg = it.side === 'a' ? -1 : 1, ss = it.members.map((m) => ts(m.t)), st = `stroke:var(--evra-muted);stroke-width:1.2;opacity:${0.75 * fadeOf(it.gid)};stroke-linecap:round`;
			out.push(seg(Math.min(...ss), sg * 9, Math.max(...ss), sg * 9, st));
			ss.forEach((s) => out.push(seg(s, sg * 5, s, sg * 9, st)));
		});
		visItems.forEach((it) => {
			const ev = it.ev, on = hl.has(it.group ? it.gid : ev.id);
			out.push(...stemPaths(it, P(ev.t), innerEdge(it), it.group ? 'var(--evra-muted)' : col(ev.color), on, fadeOf(it.group ? it.gid : ev.id)));
		});

		for (const side of ['a', 'b'] as Side[]) { // the bundled lane: one quiet strand wherever any bundled span runs
			const runs = bundleHits.filter((b) => b.side === side).map((b) => [Math.max(b.ps, -80), Math.min(b.pe, L + 80)]).sort((x, y) => x[0] - y[0]);
			const merged: number[][] = [];
			runs.forEach((r) => { const m = merged[merged.length - 1]; if (m && r[0] <= m[1] + 2) m[1] = Math.max(m[1], r[1]); else merged.push([...r]); });
			const lc = (side === 'a' ? -1 : 1) * laneC(MAXL - 1);
			merged.forEach(([a, b]) => threadOut.push(seg(Sx(a), lc, Sx(b), lc, 'stroke:var(--evra-muted);stroke-width:1.6;stroke-dasharray:1 3;stroke-linecap:round;opacity:.8')));
		}
		out.push(...threadOut);
		F.bundles = []; // one "+N" marker per side where bundled spans are running
		for (const side of ['a', 'b'] as Side[]) {
			const on = bundleHits.filter((b) => b.side === side && b.pe > 0 && b.ps < L);
			if (on.length) F.bundles.push({ side, n: on.length, ids: on.map((b) => b.ev.id), s: Sx(clamp(Math.max(...on.map((b) => b.ps)) + 10, 70, L - 30)) });
		}
		// dots
		if (lod === 'dots') {
			const pts = EV_LIST.map((ev) => ({ ev, s: ts(ev.t) })).filter((p) => p.s > -20 && p.s < L + 20).sort((a, b) => a.s - b.s);
			const groups: { items: typeof pts; last: number }[] = [];
			pts.forEach((p) => { const g = groups[groups.length - 1]; if (g && p.s - g.last < 22) g.items.push(p); else groups.push({ items: [p], last: p.s }); }); // clusters span at most 22px, so a dense stretch never chains into one blob
			groups.forEach((g) => {
				const s = g.items.reduce((a, p) => a + p.s, 0) / g.items.length, ts_ = g.items.map((p) => p.ev.t), te = g.items.map((p) => (p.ev.end != null && !p.ev.oe ? p.ev.end : p.ev.t));
				F.dots.push({ zoom: [Math.min(...ts_), Math.max(...te)], s, id: g.items.length === 1 ? g.items[0].ev.id : null });
				if (g.items.length === 1) out.push(circ(s, 0, 4.5, `fill:${col(g.items[0].ev.color)};stroke:var(--evra-bg);stroke-width:2`));
				else { out.push(circ(s, 0, g.items.length > 99 ? 13 : 10, 'fill:var(--evra-surface);stroke:var(--evra-line);stroke-width:1')); const [x, yy] = xy(s, 0); out.push(text(x, yy, g.items.length, 'cl-t')); }
			});
		} else {
			EV_LIST.forEach((ev) => {
				const c = col(ev.color), on = isSel(ev.id), fo = `;opacity:${fadeOf(ev.id)}`;
				if (ev.end == null) {
					const s = ts(ev.t);
					if (s < -20 || s > L + 20) return;
					if (on) out.push(circ(s, 0, 8.5, 'fill:none;stroke:var(--evra-accent);stroke-width:2'));
					out.push(circ(s, 0, 5, `fill:${c};stroke:var(--evra-bg);stroke-width:2.5${fo}`));
					F.dots.push({ id: ev.id, which: 'point', s });
				} else {
					const a = ts(ev.t), b = ts(ev.end);
					if (a > -20 && a < L + 20) {
						if (on) out.push(circ(a, 0, 8, 'fill:none;stroke:var(--evra-accent);stroke-width:2'));
						out.push(circ(a, 0, 5, `fill:${c};stroke:var(--evra-bg);stroke-width:2.5${fo}`));
						F.dots.push({ id: ev.id, which: 'start', s: a });
					}
					if (b > -20 && b < L + 20) { out.push(circ(b, 0, hl.has(ev.id) ? 4.5 : 3.5, `fill:var(--evra-bg);stroke:${c};stroke-width:2${fo}`)); F.dots.push({ id: ev.id, which: 'end', s: b }); }
				}
			});
		}
		// approximate dates: a soft haze along the line
		EV_LIST.forEach((ev) => {
			if (!ev.circa || ev.end != null) return;
			const a = ts(ev.t - ev.circa), b = ts(ev.t + ev.circa);
			if (!vis(a, b)) return;
			const [x1, y1] = xy(cS(a), 0), [x2, y2] = xy(cS(b), 0), gid = gradId('cz' + ev.id), c = col(ev.color);
			defs.push(gradient(gid, xy(a, 0), xy(b, 0), [[0, c, 0], [0.5, c, 0.5], [1, c, 0]]));
			out.splice(1, 0, svgEl('line', { x1: rd(x1), y1: rd(y1), x2: rd(x2), y2: rd(y2) }, `stroke:url(#${gid});stroke-width:8;stroke-linecap:round;opacity:${fadeOf(ev.id)}`));
		});
		// pinned cards: a dashed arc from the anchor to the card, shown while either is in focus
		EV_LIST.forEach((ev) => {
			if (!ev.rel) return;
			const a = evById(ev.rel.to);
			if (!a || !(hl.has(ev.id) || hl.has(a.id))) return;
			const sa = ts(ev.rel.from === 'end' && a.end != null ? a.end : a.t), sd = ts(ev.t), sg = ev.side === 'a' ? -1 : 1, bulge = sg * Math.min(80, Math.abs(sd - sa) / 3 + 18);
			const pts = ([[sa, 0], [sa, bulge], [sd, bulge], [sd, 0]] as [number, number][]).map(([p, c]) => pt(p, c).join(','));
			out.push(pathEl(`M${pts[0]} C${pts[1]} ${pts[2]} ${pts[3]}`, 'fill:none;stroke:var(--evra-accent);stroke-width:1.5;stroke-dasharray:4 4'), circ(sd, 0, 3, 'fill:var(--evra-accent)'));
		});
		F.nowS = null;
		if (S.now != null) {
			const s = ts(S.now);
			if (s > -10 && s < L + 10) { out.push(seg(s, -G.cx, s, G.C - G.cx, 'stroke:var(--evra-now);stroke-width:1.5;opacity:.9'), circ(s, 0, 5, 'fill:var(--evra-now);stroke:var(--evra-bg);stroke-width:2.5')); F.nowS = s; }
		}
		if (flash) { const s = ts(flash.t); out.push(seg(s, -G.cx, s, G.C - G.cx, 'stroke:var(--evra-accent);stroke-width:2;opacity:.9'), circ(s, 0, 7, 'fill:var(--evra-accent);stroke:var(--evra-bg);stroke-width:3')); }
		const edgeB = drag && drag.type === 'bound' ? { id: drag.group[0], which: drag.which as 'start' | 'end' } : hoverB; // the era edge being hovered or dragged
		if (edgeB) {
			const e = eraById(edgeB.id);
			if (e) { const s = ts(e[edgeB.which]); out.push(seg(s, -G.cx, s, G.C - G.cx, 'stroke:var(--evra-accent);stroke-width:1.5;stroke-dasharray:5 4;opacity:.85'), seg(s, -12, s, 12, 'stroke:var(--evra-accent);stroke-width:4;stroke-linecap:round')); }
		}

		svg.setAttribute('width', String(G.W)); svg.setAttribute('height', String(G.H));
		const defsEl = svgEl('defs', {});
		defs.forEach((d) => defsEl.appendChild(d));
		svg.replaceChildren(defsEl, ...out);
		renderCards(visItems);
		renderOverlay(dep, R0, R1);
	}

	const cardEls = new Map<string, HTMLElement>(), ribEls = new Map<string, HTMLElement>();
	const slotEl = cardsLayer.createDiv({ cls: 'slot' });
	slotEl.hidden = true;
	const dimClass = (id: string) => { const f = fadeOf(id); return f === 1 ? '' : f === DIM_SELECT ? ' dim2' : ' dim1'; };
	const place = (el: HTMLElement, [x, y, w, h]: number[]) => el.setCssStyles({ left: rd(x) + 'px', top: rd(y) + 'px', width: rd(w) + 'px', height: rd(h) + 'px' });
	const px = (el: HTMLElement, k: 'left' | 'top' | 'width' | 'height') => parseFloat(el.style[k]) || 0;
	function renderCards(items: Item[]) {
		// Cards are laid out in unscrolled coordinates; cross-axis scrolling moves the whole layer at once,
		// so it is instant and never triggers the stacking transitions.
		cardsLayer.className = 'cards ' + (G.vert ? 'v' : 'h') + (noAnim ? ' noanim' : '') + (S.opts.tint ? '' : ' notint');
		cardsLayer.style.transform = G.vert ? `translate3d(${-V.x}px,0,0)` : `translate3d(0,${-V.x}px,0)`;
		const cx0 = G.C / 2;
		if (noAnim) raf(() => raf(() => { noAnim = false; cardsLayer.removeClass('noanim'); }));
		const seen = new Set<string>(), calSig = JSON.stringify(S.cal) + S.opts.cardLines + (G.vert ? LY.cross.a : 0) + S.eras.map((e) => e.start + e.name).join();
		const hl = new Set([sel, hoverId]);
		const dragId = drag && (drag.type === 'card' || drag.type === 'group') && drag.moved ? drag.id : null;
		slotEl.hidden = true;
		for (const it of items) {
			const ev = it.ev, id = it.group ? it.gid : ev.id;
			seen.add(id);
			const cr = crossOf(it), inner = innerEdge(it), c0 = it.side === 'a' ? -(inner + cr) : inner;
			const box = (pa: number, pl: number) => { const s0 = G.rev ? G.L - (pa + pl) : pa; return G.vert ? [cx0 + c0, s0, cr, pl] : [s0, cx0 + c0, pl, cr]; };
			if (it.span) {
				let rb = ribEls.get(id);
				if (!rb) { rb = createDiv(); rb.dataset.id = id; cardsLayer.insertBefore(rb, cardsLayer.firstChild); ribEls.set(id, rb); }
				rb.className = 'ribbon' + (hl.has(id) ? ' hl' : '') + dimClass(id);
				rb.style.setProperty('--cc', col(ev.color));
				const m = ev.os || ev.oe ? `linear-gradient(to ${DIR[S.orientation]}, ${ev.os ? 'transparent, #000 40%' : '#000'}, ${ev.oe ? '#000 60%, transparent' : '#000'})` : '';
				rb.setCssStyles({ maskImage: m, webkitMaskImage: m });
				const a = clamp(it.ra, -60, G.L + 60), b = clamp(it.rb, -60, G.L + 60);
				place(rb, box(a, b - a));
			}
			let el = cardEls.get(id);
			if (!el) {
				el = cardsLayer.createDiv();
				el.dataset.id = id; el.tabIndex = 0; el.setAttribute('role', 'button');
				cardEls.set(id, el);
				el.addEventListener('focus', () => {
					if (!id.startsWith('g:') && sel !== id && !drag && evById(id)) { setSel([id]); const s = ts(evById(id).t); if (s < 40 || s > G.L - 40) animView(evById(id).t, V.scale); }
				});
				if (fresh.has(id)) later(() => { fresh.delete(id); invalidate(); }, 320);
			}
			const sig = it.group
				? [lod, it.year, calSig, ...it.members.map((m) => titleOf(m) + m.color)].join('|')
				: [lod, ev.title, ev.text, ev.color, ev.file, ev.t, ev.end, ev.os, ev.oe, ev.icon, ev.circa, ev.life, (ev.tags || []).join(','), (ev.people || []).join(','),
					ev.rel ? String(ev.rel.offset) + ev.rel.to : '', agesOf(ev).map((a) => a.name + a.age).join(','), calSig, ev.file ? host.noteStamp(ev.file) : ''].join('|');
			if (sigs.get(el) !== sig && editing !== id) { setHTML(el, it.group ? groupHTML(it) : cardHTML(ev)); sigs.set(el, sig); }
			el.className = 'evra-card' + dimClass(id) + (it.group ? ' group' : '') + (lod === 'compact' ? ' compact' : '') + (ev.color ? ' tint' : '') + (!it.group && ev.file && !host.noteExists(ev.file) ? ' missing' : '') + (isSel(id) ? ' sel' : '')
				+ (editing === id ? ' editing' : '') + (fresh.has(id) ? ' enter' : '') + (settling.has(id) ? ' settle' : '') + (dragId === id ? ' dragging' : '');
			const bx = box(it.pos, it.len);
			if (dragId === id) { place(slotEl, bx); slotEl.hidden = false; bx[0] = drag.free.x; bx[1] = drag.free.y; }
			place(el, bx);
			if (editing === id) el.setCssStyles({ height: '', minHeight: rd(bx[3]) + 'px' }); else el.setCssStyles({ minHeight: '' });
			if (!it.group) el.style.setProperty('--lines', String(descLines(ev, G.vert ? cr : 220)));
			el.tabIndex = sel === id || (!sel && it === items[0]) ? 0 : -1; // one tab stop for the cards (the selected one); J and K move between them
			el.setAttribute('aria-label', it.group ? `${it.members.length} events in ${yearStr(it.year)}` : `${titleOf(ev)}, ${ev.end != null ? fmtRange(ev) : fmt(ev.t)}`);
			el.style.setProperty('--cc', col(ev.color));
			el.setCssStyles({ zIndex: editing === id ? '6' : sel === id && dragId !== id ? '4' : '' });
		}
		for (const [id, el] of cardEls) if (!seen.has(id) && editing !== id) { el.remove(); cardEls.delete(id); }
		for (const [id, el] of ribEls) if (!seen.has(id) || evById(id)?.end == null || threadsOn()) { el.remove(); ribEls.delete(id); }
	}
	function groupHTML(it: Item, mode = lod) {
		const n = it.members.length, yr = yearStr(it.year);
		if (mode === 'compact') return `<span class="gi">${ICON.stack}</span><span class="tt">${n} events</span><span class="dt">${esc(yr)}</span>`;
		const rows = it.members.slice(0, 3).map((m) => `<div class="gr"><i class="sw" style="--cc:${col(m.color)}"></i><span>${esc(titleOf(m))}</span></div>`).join('');
		return `<div class="ch"><span class="gi">${ICON.stack}</span><span class="tt">${esc(yr)}</span><span class="gn">${n} events</span></div><div class="gl">${rows}${n > 3 ? `<div class="gm">+ ${n - 3} more</div>` : ''}</div>`;
	}
	function cardHTML(ev: EvraEvent, mode = lod, forEdit = false) {
		const linked = !!ev.file, title = titleOf(ev), date = evDate(ev) + (sec().on && sec().onCards ? ` · ${secLabel(secYear(ev.t))}` : '');
		if (mode === 'compact') return `${ev.icon ? `<i class="sw ic">${esc(ev.icon)}</i>` : '<i class="sw"></i>'}<span class="tt">${esc(title)}</span><span class="dt">${esc(date)}</span>`;
		const icon = linked ? `<button class="ln" data-act="open" aria-label="Open note" tabindex="-1">${ICON.note}</button>` : '';
		const body = linked ? inline(noteExcerpt(noteSrc(ev))) : inline(ev.text || '').replace(/\n/g, '<br>');
		const ages = agesOf(ev);
		const extra = (ev.rel ? `<div class="rl">↳ ${esc(relText(ev))}</div>` : '') + (ages.length ? `<div class="ag">${ages.map((a) => `<span style="--cc:${col(a.color)}">${esc(a.name)} · ${a.age}</span>`).join('')}</div>` : '');
		const cover = coverOf(ev), mark = ev.icon ? `<i class="sw ic">${esc(ev.icon)}</i>` : '<i class="sw"></i>';
		const tags = (ev.tags || []).length ? `<div class="tg">${ev.tags.map((t) => `<span>#${esc(t)}</span>`).join('')}</div>` : '';
		return `${cover ? `<div class="cv" style="background-image:url('${esc(cover.replace(/'/g, '%27'))}')"></div>` : ''}<div class="ch">${mark}<span class="tt" data-f="title">${esc(title)}</span>${icon}<button class="mb" data-act="menu" aria-label="Card options" tabindex="-1">${ICON.dots}</button></div><div class="dt">${esc(date)}</div>${extra}${tags}${body || forEdit ? `<div class="bd" data-f="text">${body}</div>` : ''}`;
	}

	/* ---------- overlays: tags, era labels, rulers, bundles, now, breadcrumb ---------- */
	// An era label's width, from font metrics (reading it from the page mid-frame would force a layout)
	const eraWidths = new Map<string, number>();
	function eraLabelWidth(t: EraLabel): number {
		const k = (t.sub ? 's|' : 't|') + t.name + '|' + cssEpoch;
		let w = eraWidths.get(k);
		if (w == null) {
			if (eraWidths.size > 2000) eraWidths.clear();
			measureCtx.font = t.sub ? `italic 400 12.5px ${eraFamily()}` : `600 10.5px ${uiFamily()}`;
			const text = t.sub ? t.name : t.name.toUpperCase();
			w = Math.min(220, Math.ceil(measureCtx.measureText(text).width + (t.sub ? 0 : text.length * 10.5 * 0.14)) + 18);
			lastFont = '';
			eraWidths.set(k, w);
		}
		return w;
	}
	let crumbKey = '', tagKey = '', tagWidths: number[] = [];
	function renderTags() {
		const box = $('tags'), list: TagInfo[] = [];
		for (const side of ['a', 'b'] as Side[]) (LY.tags || { a: [], b: [] })[side].sort((p, q) => p.c - q.c).forEach((t, k) => list.push({ ...t, side, k }));
		const key = list.map((t) => t.ev.id + t.side + t.k + titleOf(t.ev) + t.ev.color).join('|') + S.orientation;
		if (key !== tagKey) {
			tagKey = key;
			setHTML(box, list.map((t) => `<button class="evra-tag" data-ev="${t.ev.id}" style="--cc:${t.color}" title="Go to the start of ${esc(titleOf(t.ev))}"><i></i>${esc(titleOf(t.ev))}</button>`).join(''));
			// widths from font metrics: asking the page for them would force a full layout mid-frame
			measureCtx.font = `500 11.5px ${uiFamily()}`;
			tagWidths = list.map((t) => Math.min(190, Math.ceil(measureCtx.measureText(titleOf(t.ev)).width) + 31));
			lastFont = '';
		}
		(Array.from(box.children) as HTMLElement[]).forEach((el, i) => {
			const t = list[i], sg = t.side === 'a' ? -1 : 1, w = tagWidths[i] || 0, h = 22, lane = G.cx + sg * t.c;
			let x: number, y: number;
			if (G.vert) { x = t.side === 'a' ? lane - w + 6 : lane - 6; y = G.rev ? G.H - G.inb - 34 - t.k * 26 : 12 + t.k * 26; }
			else { x = G.rev ? G.W - w - 12 : 12; y = t.side === 'a' ? lane - h + 6 - t.k * 26 : lane - 6 + t.k * 26; }
			el.setCssStyles({ left: rd(x) + 'px', top: rd(y) + 'px' });
			el.toggleClass('hl', hoverId === t.ev.id || sel === t.ev.id);
			el.toggleClass('dim1', fadeOf(t.ev.id) === DIM_HOVER); el.toggleClass('dim2', fadeOf(t.ev.id) === DIM_SELECT);
		});
	}
	$('tags').addEventListener('click', (e) => { // bring the span's start into view, keeping the zoom
		const b = closest(e.target, '[data-ev]');
		if (!b) return;
		const ev = evById(b.dataset.ev);
		if (!ev) return;
		sel = ev.id; animView(ev.t + (G.L * 0.3) / V.scale, V.scale); invalidate();
	});
	function renderEraLabels() {
		const box = $('eraLabels'), list = F.eraLabels || [];
		while (box.children.length < list.length) box.createEl('button', { type: 'button' });
		(Array.from(box.children) as HTMLElement[]).forEach((el, i) => {
			const t = list[i];
			el.hidden = !t;
			if (!t) return;
			el.className = 'el' + (t.sub ? ' sub' : '') + (t.lvl > 2 ? ' deep' : '');
			el.dataset.era = t.id;
			if (el.textContent !== t.name) el.textContent = t.name;
			const d = G.rev ? -1 : 1;
			if (G.vert) el.setCssStyles({ left: RULER + 6 + (F.railW || 0) + 'px', top: rd(t.s + d * (6 + t.lead) - (G.rev ? 20 : 0)) + 'px', bottom: '', transform: '' });
			else el.setCssStyles({ left: rd(t.s + (G.rev ? -6 : 6)) + 'px', transform: G.rev ? 'translateX(-100%)' : '', top: '', bottom: 44 + G.inb + (F.railW || 0) + (t.row || 0) * 26 + 'px' });
		});
	}
	$('eraLabels').addEventListener('click', (e) => {
		const b = closest(e.target, '[data-era]');
		if (!b) return;
		const r = b.getBoundingClientRect(), sr = stage.getBoundingClientRect();
		openEraEditor(b.dataset.era, { x: r.left - sr.left, y: r.bottom - sr.top + 4 });
	});
	$('eraLabels').addEventListener('contextmenu', (e) => {
		const b = closest(e.target, '[data-era]');
		if (!b) return;
		e.preventDefault(); e.stopPropagation();
		const x = eraById(b.dataset.era);
		if (x) fitRange(x.start, x.end);
	});
	function renderRulerSpans(box: HTMLElement, list: { s: number; label: string }[]) {
		while (box.children.length < list.length) box.createSpan();
		(Array.from(box.children) as HTMLElement[]).forEach((el, i) => {
			const t = list[i];
			el.hidden = !t;
			if (!t) return;
			if (el.textContent !== t.label) el.textContent = t.label;
			if (G.vert) el.setCssStyles({ top: rd(t.s) + 'px', left: '' }); else el.setCssStyles({ left: rd(t.s) + 'px', top: '' });
		});
	}
	function renderRuler() {
		const box2 = $('ruler2'), list2 = (F.ticks2 || []).filter((t) => t.s > 20 && t.s < G.L - 20);
		box2.hidden = !list2.length; box2.className = 'ui ruler r2 ' + (G.vert ? 'rv' : 'rh'); box2.title = sec().name;
		renderRulerSpans(box2, list2);
		const box = $('ruler'), ticks = (F.ticks || []).filter((t) => (G.vert ? t.s > 50 && t.s < G.H - G.inb - (G.rev ? 50 : 10) : t.s > 20 && t.s < G.W - 60));
		box.className = 'ui ruler ' + (G.vert ? 'rv' : 'rh');
		renderRulerSpans(box, ticks);
	}
	function renderBundles() {
		const box = $('bundles'), bk = (F.bundles || []).map((b) => b.side + b.n + b.ids.join()).join('|');
		if (bk !== bundleKey) { bundleKey = bk; setHTML(box, (F.bundles || []).map((b, i) => `<button class="bundle" data-i="${i}" title="${esc(b.ids.map((id) => titleOf(evById(id))).join(', '))}">+${b.n}</button>`).join('')); }
		(Array.from(box.children) as HTMLElement[]).forEach((el, i) => {
			const b = F.bundles[i], [x, y] = xy(b.s, (b.side === 'a' ? -1 : 1) * laneC(MAXL - 1));
			el.setCssStyles({ left: rd(x) + 'px', top: rd(y) + 'px' });
		});
	}
	$('bundles').addEventListener('click', (e) => {
		const el = closest(e.target, '[data-i]');
		if (!el) return;
		const b = F.bundles[+el.dataset.i], r = el.getBoundingClientRect(), sr = stage.getBoundingClientRect();
		openPop({ x: r.right - sr.left + 6, y: r.top - sr.top }, `<div class="evra-menu"><div class="meta">${b.n} spans share this thread</div>${b.ids.map((id) => { const x = evById(id); return `<div class="erow"><button data-go="${id}"><i style="--cc:${col(x.color)}"></i>${esc(titleOf(x))}</button></div>`; }).join('')}</div>`,
			(p) => qa(p, '[data-go]').forEach((bt) => (bt.onclick = () => { closePop(); setSel([bt.dataset.go]); zoomToEvent(evById(bt.dataset.go)); })));
	});
	function renderNow() {
		const el = $('nowTag');
		el.hidden = F.nowS == null;
		if (el.hidden) return;
		el.textContent = 'Now · ' + fmt(S.now);
		if (G.vert) el.setCssStyles({ top: rd(F.nowS) + 'px', left: '', right: '16px', transform: 'translateY(-50%)' });
		else el.setCssStyles({ left: rd(F.nowS) + 'px', top: '46px', right: '', transform: 'translateX(-50%)' });
	}
	function renderOverlay(dep: Record<string, number>, R0: number, R1: number) {
		renderNow(); renderMinimap(); renderRuler(); renderEraLabels(); renderBundles(); renderFilterPill();
		// the hint is for getting started: it steps aside for the ruler and the era rail, and goes once there's a handful of events
		const hint = $('hint');
		hint.hidden = S.events.length >= 5;
		if (!hint.hidden) hint.setCssStyles({ bottom: G.vert ? '' : 42 + G.inb + (F.railW || 0) + 'px', left: G.vert ? RULER + (F.railW || 0) + 12 + 'px' : '' });
		renderTags();
		const tc = tAt(G.L / 2), path = S.eras.filter((e) => e.start <= tc && e.end > tc).sort((a, b) => dep[a.id] - dep[b.id]);
		const key = path.map((e) => e.id + e.name).join('|');
		if (key !== crumbKey) {
			crumbKey = key;
			const c = $('crumb');
			c.hidden = !path.length;
			setHTML(c, path.map((e, i) => (i ? '<span class="sep">›</span>' : '') + `<button data-era="${e.id}" title="Fit ${esc(e.name)} to screen">${esc(e.name)}</button>${S.eras.filter((x) => x.parent === e.parent && x.id !== e.id).length ? `<button class="chev" data-sib="${e.id}" title="Other eras at this level" aria-label="Other eras beside ${esc(e.name)}">⌄</button>` : ''}`).join(''));
		}
		const placeAt = (el: HTMLElement, s: number, show: boolean) => { el.hidden = !show; if (!show) return; const [x, y] = xy(s, 0); el.setCssStyles({ left: x + 'px', top: y + 'px' }); };
		const u = S.cal.units.years || 'years', r0 = ts(R0), r1 = ts(R1), o0 = G.rev ? r0 + 34 : r0 - 34, o1 = G.rev ? r1 - 34 : r1 + 34;
		const xs = $('extS'), xe = $('extE');
		xs.textContent = '+10 ' + u; xe.textContent = '+10 ' + u;
		xs.title = `Extend the range 10 ${u} earlier`; xe.title = `Extend the range 10 ${u} later`;
		placeAt(xs, o0, o0 > 20 && o0 < G.L - 20); placeAt(xe, o1, o1 > 20 && o1 < G.L - 20);
		$('empty').hidden = !!(S.events.length || S.eras.length);
		const range = V.xmax - V.xmin, xb = $('xbar'), th = $('xthumb');
		xb.hidden = range < 1;
		if (!xb.hidden) {
			const C = G.C - 28, tl = Math.max(36, (C * C) / (C + range)), tp = ((V.x - V.xmin) / range) * (C - tl);
			xb.className = 'ui xbar ' + (G.vert ? 'hz' : 'vt');
			if (G.vert) th.setCssStyles({ left: tp + 'px', width: tl + 'px', top: '', height: '' });
			else th.setCssStyles({ top: tp + 'px', height: tl + 'px', left: '', width: '' });
		}
		const lo = G.cx - G.ext.a < 8, hi = G.cx + G.ext.b > G.C - 8, fa = $('fadeA'), fb = $('fadeB');
		fa.hidden = !lo; fb.hidden = !hi;
		fa.className = 'ui fade ' + (G.vert ? 'l' : 't'); fb.className = 'ui fade ' + (G.vert ? 'r' : 'b');
		$<SVGElement>('orientIcon').style.transform = `rotate(${ORIENT[S.orientation].rot}deg)`;
	}

	/* ---------- selection ----------
	   `sel` is the card in focus; `selSet` holds a multi-selection. Setting `sel` to a card outside the set collapses the set to it. */
	const selSet = new Set<string>();
	function selIds(): string[] {
		if (!sel) { selSet.clear(); return []; }
		if (!selSet.has(sel)) { selSet.clear(); selSet.add(sel); }
		return [...selSet].filter((id) => evById(id));
	}
	function setSel(ids: string[]) { selSet.clear(); ids.forEach((id) => selSet.add(id)); sel = ids.length ? ids[ids.length - 1] : null; invalidate(); }
	const isSel = (id: string) => !!sel && (selSet.has(sel) ? selSet.has(id) : id === sel) && !!evById(id);
	function selectAll() { setSel(S.events.map((e) => e.id)); toast(`${S.events.length} cards selected`); }
	function deleteSel() {
		const ids = selIds();
		if (!ids.length) return;
		const before = snapshot(), set = new Set(ids);
		S.events = S.events.filter((e) => !set.has(e.id)); setSel([]); commit(before);
		keepFocus();
		toast(ids.length === 1 ? 'Deleted.' : `Deleted ${ids.length} cards.`, true);
	}
	/** The same day a year later: spans made from a moment start a year long, in whole days even with leap years. */
	const yearLater = (t: number) => { const p = parts(t); return Math.max(t + 1, toT(p.yr + 1, p.m, p.d)); };
	function nudgeSel(dir: number, fine: boolean) {
		const ids = selIds();
		if (!ids.length) return;
		const before = snapshot(), lead = evById(sel), d = fine ? dir : stepT(lead.t, dir) - lead.t;
		const set = new Set(ids);
		ids.forEach((id) => { const ev = evById(id); ev.t += d; if (ev.end != null) ev.end += d; ensureRange(ev); });
		keepPins(set, d);
		commit(before);
	}
	/** Cards pinned to a card that moved with them keep their gap: without this they'd follow the anchor a second time. */
	function keepPins(moved: Set<string>, d: number) {
		moved.forEach((id) => { const ev = evById(id); if (ev && ev.rel && moved.has(ev.rel.to) && ev.rel.at != null) ev.rel.at += d; });
	}
	let clip: EvraEvent[] = null, lastPointerT: number = null;
	const copyText = (t: string) => { navigator.clipboard.writeText(t).catch(() => { /* the card copy still works inside Evra */ }); };
	function copySel() {
		const evs = selIds().map(evById);
		if (!evs.length) return;
		const t0 = Math.min(...evs.map((e) => e.t));
		clip = evs.map((e) => ({ ...(JSON.parse(JSON.stringify(e)) as EvraEvent), t: e.t - t0, end: e.end != null ? e.end - t0 : undefined }));
		copyText(evs.map((e) => `${e.end != null ? fmtRange(e) : fmt(e.t)}  ${titleOf(e)}`).join('\n'));
		toast(evs.length === 1 ? 'Copied 1 card' : `Copied ${evs.length} cards`);
	}
	function pasteClip(at: number | null) {
		if (!clip) { toast('Copy a card first (Ctrl/⌘ C).'); return; }
		const before = snapshot(), base = snap(at != null ? at : tAt(G.L / 2)), ids: string[] = [];
		clip.forEach((c) => {
			const ev: EvraEvent = { ...(JSON.parse(JSON.stringify(c)) as EvraEvent), id: uid(), t: base + c.t };
			if (c.end != null) ev.end = base + c.end; else delete ev.end;
			delete ev.rel;
			fresh.add(ev.id); S.events.push(ev); ensureRange(ev); ids.push(ev.id);
		});
		setSel(ids); commit(before);
		toast(ids.length === 1 ? 'Pasted 1 card' : `Pasted ${ids.length} cards`, true);
	}
	function duplicateSel() { // copies within the timeline only: the clipboard and the copy buffer are left alone
		const ids = selIds();
		if (!ids.length) return;
		const keep = clip;
		clip = ids.map(evById).map((e) => ({ ...(JSON.parse(JSON.stringify(e)) as EvraEvent), t: e.t, end: e.end }));
		const t0 = Math.min(...clip.map((e) => e.t));
		clip = clip.map((e) => ({ ...e, t: e.t - t0, end: e.end != null ? e.end - t0 : undefined }));
		pasteClip(stepT(t0, 1));
		clip = keep;
	}
	function stepSel(dir: number) { // J / K: move the focus to the next or previous card in time
		const list = [...S.events].sort((a, b) => a.t - b.t || a.id.localeCompare(b.id));
		if (!list.length) return;
		const i = sel ? list.findIndex((e) => e.id === sel) : -1, next = list[clamp(i < 0 ? (dir > 0 ? 0 : list.length - 1) : i + dir, 0, list.length - 1)];
		setSel([next.id]);
		const s = ts(next.t);
		if (s < 60 || s > G.L - 60) animView(next.t, V.scale);
	}
	function colorSel(n: number) {
		const ids = selIds();
		if (!ids.length) return;
		const p = n === 0 ? null : S.palette[n - 1];
		if (n && !p) return;
		const before = snapshot();
		ids.forEach((id) => (evById(id).color = p ? p.id : null));
		commit(before);
	}
	function toggleSpanSel() {
		const ev = evById(sel);
		if (!ev) return;
		const before = snapshot();
		if (ev.end != null) { delete ev.end; delete ev.os; delete ev.oe; delete ev.life; } else { ev.end = yearLater(ev.t); ensureRange(ev); }
		commit(before);
	}

	/* ---------- relative dates, circa, lifespans, now ---------- */
	// A card pinned to another follows it when it moves. Moving the pinned card itself just changes the gap.
	function resolveRel() {
		const done = new Set<string>(), busy = new Set<string>();
		const visit = (ev: EvraEvent) => {
			if (!ev || !ev.rel || done.has(ev.id)) return;
			if (busy.has(ev.id)) { delete ev.rel; return; } // a loop: drop the pin
			busy.add(ev.id);
			const a = evById(ev.rel.to);
			if (!a) { delete ev.rel; busy.delete(ev.id); return; }
			visit(a);
			if (!ev.rel) { busy.delete(ev.id); return; }
			if (ev.rel.from === 'end' && a.end == null) { ev.rel.from = 'start'; ev.rel.at = a.t; ev.rel.offset = ev.t - a.t; busy.delete(ev.id); done.add(ev.id); return; } // the anchor stopped being a span: stay put
			const at = ev.rel.from === 'end' && a.end != null ? a.end : a.t;
			if (ev.rel.at != null && at !== ev.rel.at) { const d = at - ev.rel.at; ev.t += d; if (ev.end != null) ev.end += d; } // the anchor moved: follow it
			ev.rel.offset = ev.t - at; ev.rel.at = at;
			busy.delete(ev.id); done.add(ev.id);
		};
		S.events.forEach(visit);
	}
	const dependsOn = (ev: EvraEvent, id: string) => { for (let x = ev, g = 0; x && x.rel && g < 200; g++) { if (x.rel.to === id) return true; x = evById(x.rel.to); } return false; };
	function humanGap(days: number) {
		const c = ci(), a = Math.abs(days), y = Math.floor(a / c.Yavg), mo = c.M > 1 ? Math.floor((a - y * c.Yavg) / c.avgM) : 0, d = Math.round(a - y * c.Yavg - mo * c.avgM), u = S.cal.units;
		const pl = (n: number, one: string, many?: string) => `${n} ${n === 1 ? one : many || one + 's'}`;
		return [y && pl(y, u.year, u.years), mo && pl(mo, u.month), !y && !mo && pl(d, u.day)].filter(Boolean).slice(0, 2).join(', ') || 'the same day as';
	}
	function relText(ev: EvraEvent) {
		const a = ev.rel && evById(ev.rel.to);
		if (!a) return '';
		const g = ev.rel.offset, name = titleOf(a), edge = ev.rel.from === 'end' ? ' ends' : '';
		return g === 0 ? `Same day as ${name}${edge}` : `${humanGap(g)} ${g > 0 ? 'after' : 'before'} ${name}${edge}`;
	}
	// Ages: lifespans are spans marked as someone's life. A card shows the age of anyone it links to ([[Name]]) or lists as involved.
	const lives = () => S.events.filter((e) => e.life && e.end != null);
	const livesNamed = () => memoLives || (memoLives = lives().map((L) => { const name = titleOf(L); return { L, name, lname: name.toLowerCase() }; }));
	const linkSets = new Map<string, { stamp: number; set: Set<string> }>();
	const linksOf = (link: string) => {
		const stamp = stampOf(link), hit = linkSets.get(link);
		if (hit && hit.stamp === stamp) return hit.set;
		const set = new Set(host.noteLinks(link));
		linkSets.set(link, { stamp, set });
		return set;
	};
	function agesOf(ev: EvraEvent): Age[] {
		if (ev.life) return [];
		const hit = memoAges.get(ev.id);
		if (hit) return hit;
		const out: Age[] = [], ls = livesNamed();
		memoAges.set(ev.id, out);
		if (!ls.length) return out;
		const text = ev.file ? '' : (ev.text || '') + ' ' + (ev.title || ''), links = ev.file ? linksOf(ev.file) : null;
		if (!ev.people && (links ? !links.size : !text.includes('[['))) return out;
		for (const { L, name, lname } of ls) {
			if (!name || L.id === ev.id) continue;
			const mentioned = links ? links.has(lname) : text.includes('[[' + name);
			if (!(ev.people || []).includes(L.id) && !mentioned) continue;
			if (ev.t < L.t || (!L.oe && ev.t > L.end)) continue;
			const b = parts(L.t), p = parts(ev.t);
			out.push({ name, age: p.yr - b.yr - (p.m < b.m || (p.m === b.m && p.d < b.d) ? 1 : 0), color: L.color });
		}
		return out;
	}
	function setNow(t: number | null) { const b = snapshot(); S.now = t; commit(b); toast(t == null ? '“Now” cleared.' : `“Now” is ${fmt(t)}.`, true); }
	function goToNow() { if (S.now == null) { toast('Set “now” first: right-click the timeline.'); return; } goToDate(S.now); }

	/* ---------- filters ----------
	   A view setting, not saved in the file: narrow the timeline to matching cards, either fading or hiding the rest. */
	const FLT = { q: '', colors: new Set<string>(), tags: new Set<string>(), era: '', side: '', link: '', mode: 'dim' };
	type FltKey = 'side' | 'link' | 'mode';
	const filterOn = () => !!(FLT.q || FLT.colors.size || FLT.tags.size || FLT.era || FLT.side || FLT.link);
	function matches(ev: EvraEvent) {
		if (FLT.q) { const q = FLT.q.toLowerCase(); if (![ev.file ? titleOf(ev) : '', ev.title, plainOf(descOf(ev)), ...(ev.tags || [])].some((x) => x && String(x).toLowerCase().includes(q))) return false; }
		if (FLT.colors.size && !FLT.colors.has(ev.color || 'none')) return false;
		if (FLT.tags.size && !(ev.tags || []).some((t) => FLT.tags.has(t))) return false;
		if (FLT.era) { const e = eraById(FLT.era); if (e && ((ev.end != null ? ev.end : ev.t) < e.start || ev.t >= e.end)) return false; }
		if (FLT.side && ev.side !== FLT.side) return false;
		if (FLT.link === 'linked' && !ev.file) return false;
		if (FLT.link === 'unlinked' && ev.file) return false;
		return true;
	}
	const allTags = () => [...new Set(S.events.flatMap((e) => e.tags || []))].sort();
	function openFilter(at: At) {
		const sideNames = G.vert ? ['Left', 'Right'] : ['Top', 'Bottom'], tags = allTags();
		const segH = (key: FltKey, opts: [string, string][]) => `<div class="seg txt fseg">${opts.map(([v, l]) => `<button data-f="${key}" data-v="${v}" class="${FLT[key] === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
		openPop(at, `<div class="evra-menu filt"><div class="fh"><strong>Filter</strong>${filterOn() ? '<button class="tbtn" data-m="clear">Clear</button>' : ''}</div>
			<input type="text" data-k="fq" placeholder="Text in titles, descriptions or tags" value="${esc(FLT.q)}" aria-label="Filter text">
			<div class="dl">Colors</div><div class="fchips">${[{ id: 'none', name: 'No color' }, ...S.palette].map((p) => `<button data-fc="${p.id}" class="fchip ${FLT.colors.has(p.id) ? 'on' : ''}" style="--cc:${p.id === 'none' ? 'var(--evra-muted)' : col(p.id)}"><i></i>${esc(p.name)}</button>`).join('')}</div>
			${tags.length ? `<div class="dl">Tags</div><div class="fchips">${tags.map((t) => `<button data-ft="${esc(t)}" class="fchip ${FLT.tags.has(t) ? 'on' : ''}">#${esc(t)}</button>`).join('')}</div>` : ''}
			<div class="dl">Era</div><select data-k="fera" aria-label="Era"><option value="">Any era</option>${S.eras.map((e) => `<option value="${e.id}" ${FLT.era === e.id ? 'selected' : ''}>${'  '.repeat(eraDepths()[e.id] - 1)}${esc(e.name)}</option>`).join('')}</select>
			<div class="dl">Side</div>${segH('side', [['', 'Both'], ['a', sideNames[0]], ['b', sideNames[1]]])}
			<div class="dl">Notes</div>${segH('link', [['', 'Any'], ['linked', 'Linked'], ['unlinked', 'Not linked']])}
			<div class="dl">Everything else</div>${segH('mode', [['dim', 'Fade'], ['hide', 'Hide']])}</div>`, (p) => {
			const again = () => { invalidate(); renderFilterPill(); };
			const q = q1<HTMLInputElement>(p, '[data-k=fq]');
			q.focus();
			q.oninput = () => { FLT.q = q.value.trim(); again(); };
			qa(p, '[data-fc]').forEach((b) => (b.onclick = () => { const k = b.dataset.fc; if (FLT.colors.has(k)) FLT.colors.delete(k); else FLT.colors.add(k); b.toggleClass('on', FLT.colors.has(k)); again(); }));
			qa(p, '[data-ft]').forEach((b) => (b.onclick = () => { const k = b.dataset.ft; if (FLT.tags.has(k)) FLT.tags.delete(k); else FLT.tags.add(k); b.toggleClass('on', FLT.tags.has(k)); again(); }));
			const fe = q1<HTMLSelectElement>(p, '[data-k=fera]');
			fe.onchange = () => { FLT.era = fe.value; again(); };
			qa(p, '[data-f]').forEach((b) => (b.onclick = () => { FLT[b.dataset.f as FltKey] = b.dataset.v; qa(p, `[data-f="${b.dataset.f}"]`).forEach((x) => x.toggleClass('on', x === b)); again(); }));
			const c = q1(p, '[data-m=clear]');
			if (c) c.onclick = () => { clearFilter(); openFilter(at); };
		});
	}
	function clearFilter() { Object.assign(FLT, { q: '', era: '', side: '', link: '' }); FLT.colors.clear(); FLT.tags.clear(); invalidate(); renderFilterPill(); }
	let pillKey = '', bundleKey = '';
	function renderFilterPill() {
		const el = $('fpill');
		el.hidden = !filterOn();
		if (el.hidden) return;
		// rebuilt only when the filter or the timeline changes: rebuilding every frame cost time and swallowed clicks mid-animation
		const key = [contentEpoch, FLT.q, FLT.era, FLT.side, FLT.link, FLT.mode, [...FLT.colors].join(), [...FLT.tags].join()].join('|');
		if (key === pillKey) return;
		pillKey = key;
		const n = S.events.filter(matches).length;
		setHTML(el, `<span>${FLT.mode === 'hide' ? 'Showing' : 'Highlighting'} ${n} of ${S.events.length}</span><button data-m="edit">Edit</button><button data-m="clear">Clear</button>`);
	}
	$('nowTag').addEventListener('click', goToNow);
	$('fpill').addEventListener('click', (e) => {
		const b = closest(e.target, '[data-m]');
		if (!b) return;
		if (b.dataset.m === 'clear') clearFilter();
		else { const r = $('fpill').getBoundingClientRect(), sr = stage.getBoundingClientRect(); openFilter({ x: r.left - sr.left, y: r.bottom - sr.top + 6 }); }
	});

	/* ---------- note previews on hover: Obsidian's own page preview ---------- */
	cardsLayer.addEventListener('mouseover', (e) => {
		const b = closest(e.target, '.ln');
		if (!b) return;
		const ev = evById(closest(b, '.evra-card')?.dataset.id);
		if (ev && ev.file) host.hoverNote(e, b, ev.file);
	});

	/* ---------- hit testing ---------- */
	function hitDot(L: Local) { let best: Dot = null, bd = 9; for (const d of F.dots) { const k = Math.abs(d.s - L.s); if (k < bd && Math.abs(L.c) < (d.zoom ? 12 : 9)) { bd = k; best = d; } } return best; }
	function hitBound(L: Local, deep?: boolean) { let best: Bound = null; for (const b of F.bounds) { if (Math.abs(b.s - L.s) > 6) continue; if (!best || (deep ? b.dep > best.dep : b.dep < best.dep)) best = b; } return best; }
	function hover(L: Local, target: EventTarget) {
		if (closest(target, '.evra-card,.ribbon') || closest(target, '.ui')) { stage.setCssStyles({ cursor: '' }); if (hoverB) { hoverB = null; invalidate(); } tipEl.hidden = true; return; }
		let cur = 'default', hb: Bound = null;
		const d = hitDot(L), b = d ? null : hitBound(L);
		if (d) cur = d.zoom ? 'zoom-in' : G.vert ? 'ns-resize' : 'ew-resize';
		else if (b) { hb = b; cur = G.vert ? 'row-resize' : 'col-resize'; }
		else if (Math.abs(L.c) < 10) cur = 'crosshair';
		else if (attr(target, 'data-era')) cur = 'pointer';
		stage.setCssStyles({ cursor: cur });
		if (b) { const er = eraById(b.id); showTip(L, `${er.name} ${b.which === 'start' ? 'starts' : 'ends'} · ${fmt(er[b.which])}`); }
		else if (Math.abs(L.c) < 10 && !d) showTip(L, fmt(snap(tAt(L.s))));
		else tipEl.hidden = true;
		if ((hb && hb.id + hb.which) !== (hoverB && hoverB.id + hoverB.which)) { hoverB = hb; repaint(); }
	}
	function showTip(L: At, s: string) {
		tipEl.hidden = false; tipEl.textContent = s;
		const w = tipEl.offsetWidth;
		tipEl.setCssStyles({ left: clamp(L.x + 14, 4, G.W - w - 4) + 'px', top: clamp(L.y + 14, 4, G.H - 28) + 'px' });
	}

	/* ---------- pointer ---------- */
	const elLeftTop = (ce: HTMLElement, L: Local): At => (ce ? { x: px(ce, 'left'), y: px(ce, 'top') } : { x: L.x, y: L.y });
	// the stage is a fixed frame; if anything ever scrolls it (a focused card off screen), put it back
	stage.addEventListener('scroll', () => { stage.scrollTop = 0; stage.scrollLeft = 0; });
	const capture = (id: number) => { try { stage.setPointerCapture(id); } catch { /* the pointer is already gone */ } };
	stage.addEventListener('pointerenter', () => { stageRect = null; });
	stage.addEventListener('pointerdown', (e) => {
		stageRect = null;
		if (e.button === 2 || closest(e.target, '.ui')) return;
		G = G || geo();
		const L = local(e);
		pointers.set(e.pointerId, L);
		if (pointers.size === 2 && drag && !drag.moved && drag.type !== 'pinch' && (e.pointerType === 'touch' || drag.type === 'pan' || (drag.type === 'card' && !drag.armed))) {
			tipEl.hidden = true;
			win().clearTimeout(drag.timer);
			const [a, b] = [...pointers.values()];
			drag = { type: 'pinch', last: Math.hypot(a.x - b.x, a.y - b.y) };
			return;
		}
		const cardEl = closest(e.target, '.evra-card,.ribbon');
		if (cardEl) {
			if (closest(e.target, '[data-act]')) return;
			const id = cardEl.dataset.id;
			if (editing === id) return;
			if (editing) finishEdit(true);
			if (id.startsWith('g:')) {
				const g = LY.groups[id], ce = cardEls.get(id);
				if (!g) return;
				const el0 = elLeftTop(ce, L);
				sel = null; invalidate();
				drag = { type: 'group', id, year: g.year, members: g.members.map((m) => ({ id: m.id, t: m.t })), start: L, el0, free: { ...el0 }, before: null, moved: false, armed: e.pointerType !== 'touch' };
				if (!drag.armed) drag.timer = later(() => { if (drag && drag.type === 'group' && !drag.moved) drag.armed = true; }, 260);
				capture(e.pointerId);
				return;
			}
			if (e.shiftKey) {
				const ids = selIds();
				if (ids.includes(id)) { selSet.delete(id); sel = [...selSet].pop() || null; } else { ids.forEach((x) => selSet.add(x)); selSet.add(id); sel = id; }
				invalidate();
				return;
			}
			sel = id;
			const ev = evById(id), ce = cardEls.get(id);
			if (!ev) return;
			invalidate();
			const together = selIds().length > 1 ? selIds().map((x) => ({ id: x, t: evById(x).t, end: evById(x).end, relAt: evById(x).rel?.at })) : null;
			const el0 = elLeftTop(ce, L);
			drag = { type: 'card', id, together, start: L, el0, free: { ...el0 }, before: null, orig: { t: ev.t, end: ev.end, side: ev.side }, moved: false, armed: e.pointerType !== 'touch' };
			if (!drag.armed) drag.timer = later(() => { if (drag && drag.type === 'card' && !drag.moved) { drag.armed = true; if (ce) ce.addClass('dragging'); } }, 260);
			capture(e.pointerId);
			return;
		}
		if (editing) finishEdit(true);
		const d = hitDot(L);
		if (d && d.zoom) drag = { type: 'zoomdot', d, start: L, moved: false };
		else if (d) {
			const ev = evById(d.id), both = d.which !== 'point' && F.dots.filter((x) => x.id === d.id && Math.abs(x.s - L.s) < 9).length > 1;
			sel = d.id;
			drag = { type: 'dot', id: d.id, which: both ? 'auto' : d.which, start: L, before: null, o: { t: ev.t, end: ev.end, os: ev.os, oe: ev.oe }, moved: false };
		} else if (Math.abs(L.c) < 10) {
			const b = hitBound(L, e.altKey);
			drag = b ? { ...startBound(b, e.altKey, L), era: attr(e.target, 'data-era') } : { type: 'select', a: snap(tAt(L.s)), b: null, start: L, moved: false };
		} else if (hitBound(L, e.altKey)) drag = { ...startBound(hitBound(L, e.altKey), e.altKey, L), era: attr(e.target, 'data-era') };
		else if (e.shiftKey) drag = { type: 'marquee', start: L, moved: false, keep: selIds() };
		else if (e.pointerType === 'touch') {
			const tgt = e.target;
			drag = { type: 'pan', start: L, v0: V.v0, x0: V.x, moved: false };
			drag.timer = later(() => { if (drag && drag.type === 'pan' && !drag.moved) { drag = null; openContextAt(L, tgt); } }, 550);
		} else drag = { type: 'pan', start: L, v0: V.v0, x0: V.x, moved: false, era: attr(e.target, 'data-era'), thread: attr(e.target, 'data-thread') };
		capture(e.pointerId);
		invalidate();
	});
	stage.addEventListener('pointermove', (e) => {
		if (!G) return;
		const L = local(e);
		lastPointerT = tAt(L.s);
		if (pointers.has(e.pointerId)) pointers.set(e.pointerId, L);
		if (!drag) { if (e.pointerType !== 'touch') hover(L, e.target); return; }
		if (drag.type === 'pinch') {
			if (pointers.size < 2) return;
			const [a, b] = [...pointers.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
			zoomAt((a.s + b.s) / 2, d / drag.last); drag.last = d;
			return;
		}
		const ds = L.s - drag.start.s, dist = Math.hypot(L.x - drag.start.x, L.y - drag.start.y);
		if (!drag.moved && dist < 4) return;
		if ((drag.type === 'card' || drag.type === 'group') && !drag.moved && drag.armed) hidePeek();
		if ((drag.type === 'card' || drag.type === 'group') && !drag.armed) { win().clearTimeout(drag.timer); drag = { type: 'pan', start: drag.start, v0: V.v0, x0: V.x, moved: true }; }
		// the undo snapshot is taken when a drag really starts, not on every click (it copies the whole timeline)
		if (!drag.moved && drag.before == null && /^(card|group|dot|bound)$/.test(drag.type)) drag.before = snapshot();
		drag.moved = true;
		const dt = (G.rev ? -ds : ds) / V.scale, fine = e.altKey;
		if (drag.type === 'marquee') {
			const x0 = Math.min(L.x, drag.start.x), y0 = Math.min(L.y, drag.start.y), x1 = Math.max(L.x, drag.start.x), y1 = Math.max(L.y, drag.start.y), sr = stage.getBoundingClientRect();
			marqueeEl.setCssStyles({ left: x0 + 'px', top: y0 + 'px', width: x1 - x0 + 'px', height: y1 - y0 + 'px' });
			marqueeEl.hidden = false;
			const ids = new Set(drag.keep);
			cardEls.forEach((el, id) => { if (id.startsWith('g:')) return; const r = el.getBoundingClientRect(), a = r.left - sr.left, b = r.top - sr.top; if (a < x1 && a + r.width > x0 && b < y1 && b + r.height > y0) ids.add(id); });
			F.dots.forEach((dd) => { if (!dd.id) return; const [dx, dy] = xy(dd.s, 0); if (dx >= x0 && dx <= x1 && dy >= y0 && dy <= y1) ids.add(dd.id); });
			setSel([...ids]);
			return;
		}
		if (drag.type === 'pan') {
			win().clearTimeout(drag.timer);
			V.v0 = drag.v0 - dt; V.x = drag.x0 - (G.vert ? L.x - drag.start.x : L.y - drag.start.y);
			stage.setCssStyles({ cursor: 'grabbing' }); repaint();
			return;
		}
		if (drag.type === 'card') {
			const ev = evById(drag.id), o = drag.orig, nt = snap(o.t + dt, fine);
			ev.t = nt;
			if (o.end != null) ev.end = nt + (o.end - o.t);
			if (drag.together) { // the whole selection moves as one, and pins within it keep their gaps
				const set = new Set(drag.together.map((m) => m.id));
				drag.together.forEach((m) => {
					const x = evById(m.id);
					if (m.id !== drag.id) { x.t = m.t + (nt - o.t); if (m.end != null) x.end = m.end + (nt - o.t); }
					if (x.rel && set.has(x.rel.to) && m.relAt != null) x.rel.at = m.relAt + (nt - o.t);
				});
			}
			if (Math.abs(L.c) > 26) ev.side = L.c < 0 ? 'a' : 'b';
			drag.free = { x: drag.el0.x + L.x - drag.start.x, y: drag.el0.y + L.y - drag.start.y };
			showTip(L, ev.end != null ? fmtRange(ev) : fmt(ev.t)); invalidate();
			return;
		}
		if (drag.type === 'group') { // whole years keep each member on its own day, so the group stays together
			const k = Math.round(dt / dpy()), d = Math.round(dt);
			drag.members.forEach((m) => { const ev = evById(m.id), p = parts(m.t); ev.t = fine ? m.t + d : toT(p.yr + k, p.m, p.d); if (Math.abs(L.c) > 26) ev.side = L.c < 0 ? 'a' : 'b'; });
			drag.free = { x: drag.el0.x + L.x - drag.start.x, y: drag.el0.y + L.y - drag.start.y };
			showTip(L, `${drag.members.length} events · ${yearStr(drag.year + k)}`); invalidate();
			return;
		}
		if (drag.type === 'dot') {
			const ev = evById(drag.id), o = drag.o;
			if (drag.which === 'auto') drag.which = dt > 0 ? 'end' : 'start';
			if (drag.which === 'point') { const nt = snap(o.t + dt, fine); if (nt > o.t) { ev.t = o.t; ev.end = nt; } else if (nt < o.t) { ev.t = nt; ev.end = o.t; } else delete ev.end; }
			else if (drag.which === 'start') { const nt = Math.min(snap(o.t + dt, fine), o.end); if (nt >= o.end) { ev.t = o.end; delete ev.end; delete ev.os; delete ev.oe; delete ev.life; } else { ev.t = nt; ev.end = o.end; if (o.oe) ev.oe = true; } }
			else { const nt = Math.max(snap(o.end + dt, fine), o.t); if (nt <= o.t) { ev.t = o.t; delete ev.end; delete ev.os; delete ev.oe; delete ev.life; } else { ev.t = o.t; ev.end = nt; if (o.os) ev.os = true; } }
			showTip(L, ev.end != null ? fmtRange(ev) : fmt(ev.t)); invalidate();
			return;
		}
		if (drag.type === 'bound') {
			const nt = clamp(snap(drag.bt + dt, fine), drag.lo, drag.hi), w = drag.which as 'start' | 'end';
			drag.group.forEach((id) => (eraById(id)[w] = nt)); drag.group2.forEach((id) => (eraById(id)[drag.other] = nt));
			showTip(L, `${eraById(drag.group[0]).name} ${w === 'start' ? 'starts' : 'ends'} · ${fmt(nt)}`); invalidate();
			return;
		}
		if (drag.type === 'select') { drag.b = snap(tAt(L.s)); const [a, b] = [drag.a, drag.b].sort((p, q) => p - q); showTip(L, `${fmt(a)} – ${fmt(b)}`); invalidate(); }
	});
	const settle = (id: string) => { settling.add(id); later(() => { settling.delete(id); invalidate(); }, 280); };
	function endPointer(e: PointerEvent) {
		pointers.delete(e.pointerId);
		if (!drag) return;
		if (drag.type === 'pinch') { if (pointers.size === 0) { drag = null; saveSoon(); } return; }
		const d = drag;
		drag = null; win().clearTimeout(d.timer); tipEl.hidden = true; stage.setCssStyles({ cursor: '' });
		if (d.type === 'card') {
			if (!d.moved && d.together) setSel([d.id]);
			if (d.moved) { (d.together || [{ id: d.id }]).forEach((m) => ensureRange(evById(m.id))); commit(d.before); settle(d.id); }
		} else if (d.type === 'group') {
			if (d.moved) { d.members.forEach((m) => ensureRange(evById(m.id))); commit(d.before); settle(d.id); }
			else { win().clearTimeout(groupClickT); groupClickT = later(() => openGroupPanel(d.id), 230); } // wait so a double-click can spread the group instead
		} else if (d.type === 'dot') { if (d.moved) { ensureRange(evById(d.id)); commit(d.before); } }
		else if (d.type === 'bound') { if (d.moved) commit(d.before); else if (d.era) openEraEditor(d.era, d.start); } // a click on an era's bar near an edge still opens it
		else if (d.type === 'marquee') { marqueeEl.hidden = true; if (selIds().length > 1) toast(`${selIds().length} cards selected`); }
		else if (d.type === 'zoomdot') { if (!d.moved) { const [a, b] = d.d.zoom, span = Math.max(b - a, dpy() * 2); fitRange(a - span * 0.2, b + span * 0.2); if (d.d.id) sel = d.d.id; } }
		else if (d.type === 'select') { if (d.b != null && Math.abs(ts(d.b) - ts(d.a)) > 12) openCreatePop(local(e), Math.min(d.a, d.b), Math.max(d.a, d.b)); }
		else if (d.type === 'pan') { if (!d.moved) { if (d.era) openEraEditor(d.era, d.start); else sel = d.thread || null; } saveSoon(); }
		invalidate();
	}
	stage.addEventListener('pointerup', endPointer);
	stage.addEventListener('pointercancel', endPointer);
	stage.addEventListener('pointerover', (e) => {
		const c = closest(e.target, '.evra-card,.ribbon,.evra-tag'), th = attr(e.target, 'data-thread'), id = c ? c.dataset.id || c.dataset.ev : th || null;
		if (id !== hoverId) { hoverId = id; repaint(); }
		if (e.pointerType !== 'mouse' || drag) return;
		if (c && c.hasClass('peek')) { win().clearTimeout(peekT); return; }
		if (c && c.hasClass('compact') && !c.hasClass('group')) { win().clearTimeout(peekT); peekT = later(() => showPeek(id), 140); }
		else { win().clearTimeout(peekT); if (peekEl && editing !== peekId && !(c && c.dataset.id === peekId)) hidePeek(); }
	});
	/* Hovering a compact card dims everything else and opens it at full size in place */
	const dimEl = cardsLayer.createDiv({ cls: 'dim' });
	let peekEl: HTMLElement = null, peekT = 0, peekId: string = null;
	let wheelAt = -Infinity;
	function showPeek(id: string) {
		const ev = evById(id), src = cardEls.get(id);
		if (!ev || !src || lod !== 'compact' || drag || editing) return;
		if (performance.now() - wheelAt < 400) return; // cards slide under the pointer while scrolling or zooming; don't open them
		hidePeek(); peekId = id;
		const el = cardsLayer.createDiv({ cls: 'evra-card peek enter' + (ev.color ? ' tint' : '') + (isSel(id) ? ' sel' : '') });
		el.dataset.id = id;
		el.style.setProperty('--cc', col(ev.color));
		setHTML(el, cardHTML(ev, 'full'));
		el.style.setProperty('--lines', String(descLines(ev, G.vert ? Math.max(px(src, 'width'), S.cardWidth || 240) : 220)));
		const x = px(src, 'left'), y = px(src, 'top'), w = px(src, 'width'), h = px(src, 'height');
		let W: number, H: number, X: number, Y: number;
		if (G.vert) { W = Math.max(w, S.cardWidth || 240); H = cardSize(ev, W); X = ev.side === 'a' ? x + w - W : x; Y = y + h / 2 - 18; }
		else { W = 220; H = cardSize(ev, 220); X = x; Y = ev.side === 'a' ? y + h - H : y; }
		const tx = G.vert ? -V.x : 0, ty = G.vert ? 0 : -V.x;
		place(el, [clamp(X + tx, 6, G.W - W - 6) - tx, clamp(Y + ty, 6, G.H - H - 6) - ty, W, H]);
		el.addEventListener('pointerleave', () => { if (!drag && editing !== id) hidePeek(); });
		peekEl = el; dimEl.addClass('on');
	}
	function hidePeek() {
		win().clearTimeout(peekT);
		if (editing && editing === peekId) finishEdit(true);
		if (peekEl) { peekEl.remove(); peekEl = null; }
		peekId = null; dimEl.removeClass('on');
	}
	stage.addEventListener('pointerleave', () => { if (!drag) { tipEl.hidden = true; if (hoverB) { hoverB = null; invalidate(); } } });

	function startBound(b: Bound, alt: boolean, L: Local): Drag {
		const e = eraById(b.id), which = b.which, other = which === 'start' ? 'end' : 'start', bt = e[which];
		const R0 = yearStartT(S.range[0]), R1 = yearStartT(S.range[1]), parent = e.parent ? eraById(e.parent) : null;
		let group = [e], group2: Era[] = [];
		if (!alt) {
			group = [e, ...descendants(e).filter((d) => d[which] === bt)];
			const sib = S.eras.find((x) => x !== e && x.parent === e.parent && x[other] === bt);
			if (sib) group2 = [sib, ...descendants(sib).filter((d) => d[other] === bt)];
		}
		const gs = new Set(group.map((x) => x.id)), g2 = new Set(group2.map((x) => x.id));
		const kidsOf = (set: Set<string>) => S.eras.filter((k) => set.has(k.parent) && !set.has(k.id));
		let lo: number, hi: number;
		if (which === 'start') {
			hi = Math.min(...group.map((g) => g.end - 1), ...kidsOf(gs).map((k) => k.start));
			lo = parent ? parent.start : R0;
			if (group2.length) lo = Math.max(lo, ...group2.map((h) => h.start + 1), ...kidsOf(g2).map((k) => k.end));
			else { const prev = S.eras.filter((x) => x !== e && x.parent === e.parent && x.end <= bt).sort((p, q) => q.end - p.end)[0]; if (prev) lo = Math.max(lo, prev.end); }
		} else {
			lo = Math.max(...group.map((g) => g.start + 1), ...kidsOf(gs).map((k) => k.end));
			hi = parent ? parent.end : R1;
			if (group2.length) hi = Math.min(hi, ...group2.map((h) => h.end - 1), ...kidsOf(g2).map((k) => k.start));
			else { const next = S.eras.filter((x) => x !== e && x.parent === e.parent && x.start >= bt).sort((p, q) => p.start - q.start)[0]; if (next) hi = Math.min(hi, next.start); }
		}
		return { type: 'bound', which, other, bt, lo, hi, group: [...gs], group2: [...g2], before: null, start: L, moved: false };
	}

	stage.addEventListener('wheel', (e) => {
		e.preventDefault();
		if (!G) return;
		const L = local(e), unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? G.L : 1;
		wheelAt = e.timeStamp;
		if (e.ctrlKey || e.metaKey) { hidePeek(); zoomAt(L.s, clamp(Math.exp(-e.deltaY * unit * 0.008), 0.7, 1.4)); return; }
		const dy = e.deltaY * unit, dx = e.deltaX * unit;
		hidePeek();
		if (e.shiftKey && !dx) V.x += dy; // Shift + wheel scrolls across the timeline
		else if (G.vert) { V.v0 += ((G.rev ? -1 : 1) * dy) / V.scale; V.x += dx; }
		else V.v0 += (dy + (G.rev ? -1 : 1) * dx) / V.scale;
		repaint(); saveSoon();
	}, { passive: false });

	/* Double-clicks are detected here rather than with the browser's dblclick event. The browser only counts a
	   double-click when both clicks land on the same element, but eras, threads and dots are redrawn after every
	   click, so the second click always lands on a new element and the double-click never fires. */
	let clickDown: { x: number; y: number } = null, lastClick = { t: 0, x: 0, y: 0 };
	stage.addEventListener('pointerdown', (e) => { clickDown = e.button === 0 ? { x: e.clientX, y: e.clientY } : null; }, true);
	stage.addEventListener('pointerup', (e) => {
		const down = clickDown;
		clickDown = null;
		if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
		const now = e.timeStamp;
		if (now - lastClick.t < 500 && Math.hypot(e.clientX - lastClick.x, e.clientY - lastClick.y) < 8) { lastClick = { t: 0, x: 0, y: 0 }; onDoubleClick(e); }
		else lastClick = { t: now, x: e.clientX, y: e.clientY };
	});
	function onDoubleClick(e: PointerEvent) {
		// pointer capture (used for dragging) retargets events to the stage, so ask what is really under the pointer
		const hit = doc().elementFromPoint(e.clientX, e.clientY) || (e.target as Element);
		if (closest(hit, '.ui')) return;
		const th = attr(hit, 'data-thread');
		if (th) { startEdit(th); return; }
		const cardEl = closest(hit, '.evra-card,.ribbon');
		if (cardEl) {
			const id = cardEl.dataset.id;
			if (id.startsWith('g:')) { win().clearTimeout(groupClickT); closePop(); const g = LY.groups[id]; if (g) zoomToYear(g.year); return; }
			if (editing !== id) startEdit(id);
			return;
		}
		const L = local(e);
		if (Math.abs(L.c) < 14) return;
		addEvent(E.nearestYearStart(tAt(L.s)), L.c < 0 ? 'a' : 'b');
	}
	stage.addEventListener('click', (e) => {
		const a = closest(e.target, '[data-act]');
		if (!a) return;
		const ev = evById(closest(a, '.evra-card')?.dataset.id);
		if (!ev) return;
		sel = ev.id;
		if (a.dataset.act === 'open') host.openNote(ev.file, e);
		if (a.dataset.act === 'menu') { const r = a.getBoundingClientRect(), sr = stage.getBoundingClientRect(); openCardMenu(ev, { x: r.right - sr.left, y: r.bottom - sr.top + 4 }); }
		invalidate();
	});
	stage.addEventListener('contextmenu', (e) => { e.preventDefault(); if (!closest(e.target, '.ui')) openContextAt(local(e), e.target); });
	function openContextAt(L: Local, target: EventTarget) {
		const cardEl = closest(target, '.evra-card,.ribbon');
		if (cardEl) {
			if (cardEl.dataset.id.startsWith('g:')) { openGroupPanel(cardEl.dataset.id); return; }
			const ev = evById(cardEl.dataset.id);
			if (!ev) return;
			sel = ev.id; invalidate(); openCardMenu(ev, L);
			return;
		}
		const t = snap(tAt(L.s)), inside = E.erasAt(t);
		const eraTarget = attr(target, 'data-era');
		if (eraTarget) { openEraEditor(eraTarget, L); return; }
		lastPointerT = t;
		openPop(L, `<div class="evra-menu"><div class="meta">${esc(fmt(t))}</div><button data-m="add">Add an event here</button><button data-m="addspan">Add a span here</button><button data-m="addera">Add an era here</button><button data-m="now">Set “now” here</button>${clip ? '<button data-m="paste">Paste here <kbd>Ctrl V</kbd></button>' : ''}${inside.length ? '<hr>' : ''}${inside.map((x) => `<div class="erow"><button data-fit="${x.id}"><i style="--cc:${col(x.color)}"></i>Fit “${esc(x.name)}” to screen</button><button class="ibtn" data-era="${x.id}" title="Edit era" aria-label="Edit ${esc(x.name)}">${ICON.pen}</button></div>`).join('')}<hr><button data-m="fit">Fit everything <kbd>F</kbd></button></div>`, (p) => {
			qa(p, '[data-fit]').forEach((b) => (b.onclick = () => { closePop(); const x = eraById(b.dataset.fit); fitRange(x.start, x.end); }));
			const side: Side = Math.abs(L.c) < 14 ? 'b' : L.c < 0 ? 'a' : 'b', len = Math.max(Math.round(dpy()), snap((G.L * 0.15) / V.scale));
			q1(p, '[data-m=addspan]').onclick = () => {
				closePop();
				const before = snapshot(), ev: EvraEvent = { id: uid(), t, end: t + len, side, title: 'New span', text: '', color: null, file: null };
				fresh.add(ev.id); S.events.push(ev); ensureRange(ev); sel = ev.id; commit(before);
				raf(() => startEdit(ev.id));
			};
			q1(p, '[data-m=addera]').onclick = () => { closePop(); const era = createEra(t, t + len); if (era) openEraEditor(era.id, L); };
			const pb = q1(p, '[data-m=paste]');
			if (pb) pb.onclick = () => { closePop(); pasteClip(t); };
			q1(p, '[data-m=now]').onclick = () => { closePop(); setNow(t); };
			q1(p, '[data-m=add]').onclick = () => { closePop(); addEvent(t, side); };
			q1(p, '[data-m=fit]').onclick = () => { closePop(); fitAll(); };
			qa(p, '[data-era]').forEach((b) => (b.onclick = () => openEraEditor(b.dataset.era, L)));
		});
	}

	/* dragging notes in from the file explorer */
	stage.addEventListener('dragover', (e) => { e.preventDefault(); if (!G) return; const L = local(e); showTip(L, fmt(snap(tAt(L.s)))); });
	stage.addEventListener('dragleave', () => { tipEl.hidden = true; });
	stage.addEventListener('drop', (e) => {
		e.preventDefault(); tipEl.hidden = true;
		const links = host.linksFromDrop(e);
		if (!links.length || !G) return;
		const L = local(e), before = snapshot(), t = snap(tAt(L.s)), side: Side = Math.abs(L.c) < 14 ? 'b' : L.c < 0 ? 'a' : 'b', ids: string[] = [];
		links.forEach((link) => { const ev: EvraEvent = { id: uid(), t, side, title: '', text: '', color: null, file: link }; fresh.add(ev.id); S.events.push(ev); ensureRange(ev); ids.push(ev.id); });
		setSel(ids); commit(before);
		toast(links.length === 1 ? `Linked “${host.noteTitle(links[0])}”` : `Linked ${links.length} notes`, true);
	});

	/* ---------- actions ---------- */
	let justAdded: { id: string; before: string } = null;
	function addEvent(t: number, side: Side) {
		const before = snapshot(), ev: EvraEvent = { id: uid(), t, side, title: 'New event', text: '', color: null, file: null };
		fresh.add(ev.id); S.events.push(ev); ensureRange(ev); sel = ev.id; commit(before);
		justAdded = { id: ev.id, before };
		raf(() => startEdit(ev.id));
	}
	function zoomToEvent(ev: EvraEvent, cb?: () => void) {
		if (!ev) return;
		if (ev.end != null && !ev.oe) { fitRange(ev.t, ev.end, cb); return; }
		animView(ev.t, Math.max(V.scale, G.L / (dpy() * 6)), cb);
	}
	let editEl: HTMLElement = null, groupClickT = 0;
	const editBefore = new WeakMap<HTMLElement, string>(), focusOut = new WeakMap<HTMLElement, () => void>();
	const zoomToYear = (yr: number, cb?: () => void) => animView((yearStartT(yr) + yearStartT(yr + 1)) / 2, Math.max(V.scale, ((G.vert ? GROUP_H : 220) * 4.8) / dpy()), cb);
	// Edit a card in place. Starting an edit always saves the one in progress. Compact cards are edited in
	// their expanded hover view; cards hidden in a group or off screen are brought into view first.
	function startEdit(id: string, depth = 0) {
		if (editing === id) return;
		if (editing) finishEdit(true);
		const ev = evById(id);
		if (!ev) return;
		if (ev.file) { host.openNote(ev.file); return; }
		closePop(); sel = id;
		let el = peekId === id ? peekEl : null;
		if (!el && lod === 'compact' && cardEls.get(id)) { showPeek(id); el = peekId === id ? peekEl : null; }
		if (!el && lod === 'full') { editing = id; frame(); el = cardEls.get(id) || null; editing = null; }
		if (!el) {
			if (depth > 1) return;
			const g = Object.values(LY.groups || {}).find((x) => x.members.some((m) => m.id === id)), again = () => startEdit(id, depth + 1);
			if (g) zoomToYear(g.year, again); else zoomToEvent(ev, again);
			return;
		}
		editing = id; editEl = el;
		sigs.delete(el);
		setHTML(el, cardHTML(ev, 'full', true) + '<span class="cnt"></span>');
		el.addClass('editing');
		const tt = q1(el, '.tt'), bd = q1(el, '.bd');
		if (!ev.text) bd.empty();
		else bd.setText(ev.text);
		tt.contentEditable = 'plaintext-only';
		if (tt.contentEditable !== 'plaintext-only') tt.contentEditable = 'true';
		bd.contentEditable = tt.contentEditable;
		editBefore.set(el, snapshot());
		if (justAdded && justAdded.id === id && hist[hist.length - 1] === justAdded.before) { hist.pop(); editBefore.set(el, justAdded.before); onUndoChange(); } // adding and naming a card is one undo step
		justAdded = null;
		tt.focus();
		const r = doc().createRange(), s = win().getSelection();
		r.selectNodeContents(tt); s.removeAllRanges(); s.addRange(r);
		tt.onkeydown = (k) => { if (k.key === 'Enter') { k.preventDefault(); bd.focus(); } if (k.key === 'Escape') { k.preventDefault(); finishEdit(true); } };
		bd.onkeydown = (k) => { // Enter: save and write the next one
			if (k.key === 'Enter' && !k.shiftKey) { k.preventDefault(); finishEdit(true); addEvent(stepT(ev.end != null ? ev.end : ev.t, 1), ev.side); }
			if (k.key === 'Escape') { k.preventDefault(); finishEdit(true); }
		};
		const cnt = q1(el, '.cnt'), count = () => {
			let t = bd.innerText.replace(/\n$/, '');
			if (t.length > DESC_MAX) {
				t = t.slice(0, DESC_MAX); bd.innerText = t;
				const r2 = doc().createRange(), s2 = win().getSelection();
				r2.selectNodeContents(bd); r2.collapse(false); s2.removeAllRanges(); s2.addRange(r2);
			}
			cnt.textContent = `${t.length}/${DESC_MAX}`; cnt.toggleClass('full', t.length >= DESC_MAX);
		};
		bd.addEventListener('input', count); count();
		const onOut = () => later(() => { if (editing === id && editEl === el && !el.contains(doc().activeElement)) finishEdit(true); }, 0);
		el.addEventListener('focusout', onOut);
		focusOut.set(el, onOut);
		invalidate();
	}
	function finishEdit(save: boolean) {
		const id = editing, el = editEl;
		if (!id) return;
		editing = null; editEl = null;
		const ev = evById(id);
		if (el && ev) {
			if (save) {
				const tt = q1(el, '.tt'), bd = q1(el, '.bd');
				ev.title = (tt ? tt.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) : '') || 'Untitled';
				ev.text = bd ? bd.innerText.trim().slice(0, DESC_MAX) : '';
				commit(editBefore.get(el));
			}
			sigs.delete(el); const fo = focusOut.get(el); if (fo) el.removeEventListener('focusout', fo); el.removeClass('editing');
			if (el === peekEl) setHTML(el, cardHTML(ev, 'full'));
		}
		stage.focus({ preventScroll: true }); invalidate();
	}
	function deleteEvent(id: string) { const before = snapshot(); S.events = S.events.filter((e) => e.id !== id); if (sel === id) sel = null; commit(before); keepFocus(); toast('Deleted.', true); }
	/** A removed card may have had the focus: hand it back to the timeline so shortcuts (like Ctrl+Z) keep working. */
	const keepFocus = () => { const f = doc().activeElement; if (!root.contains(f) || cardsLayer.contains(f)) stage.focus({ preventScroll: true }); };
	function createEra(a: number, b: number): Era | null {
		let pid: string = null;
		const mid = (a + b) / 2;
		for (let g = 0; g < 64; g++) {
			const inside = S.eras.find((s) => s.parent === pid && s.start <= mid && s.end > mid);
			if (!inside) break;
			pid = inside.id; a = Math.max(a, inside.start); b = Math.min(b, inside.end);
		}
		S.eras.filter((s) => s.parent === pid).forEach((s) => { if (s.end <= mid) a = Math.max(a, s.end); if (s.start >= mid) b = Math.min(b, s.start); });
		if (b - a < 1) { toast('There’s no room for a new era there.'); return null; }
		const used = S.eras.filter((s) => s.parent === pid).map((s) => s.color), color = (S.palette.find((p) => !used.includes(p.id)) || S.palette[0])?.id || null;
		const before = snapshot(), era: Era = { id: uid(), parent: pid, name: 'New era', start: a, end: b, color };
		S.eras.push(era); commit(before);
		return era;
	}
	function openGroupPanel(gid: string) {
		const g = LY.groups && LY.groups[gid], el = cardEls.get(gid);
		if (!g) return;
		const r = el ? el.getBoundingClientRect() : null, sr = stage.getBoundingClientRect(), yr = yearStr(g.year);
		openPop(r ? { x: r.left - sr.left, y: r.top - sr.top } : { x: 40, y: 40 }, `<div class="evra-menu grp">
			<div class="gh"><span>${esc(yr)}</span><small>${g.members.length} events</small></div>
			${g.members.map((m) => `<div class="grow"><button class="go" data-ev="${m.id}"><i class="sw" style="--cc:${col(m.color)}"></i><span class="gt">${esc(titleOf(m))}</span><span class="gd">${esc(fmt(m.t))}</span></button><button class="ibtn" data-edit="${m.id}" title="Edit" aria-label="Edit ${esc(titleOf(m))}">${ICON.pen}</button></div>`).join('')}
			<hr><button data-m="spread">Spread them out <kbd>double-click</kbd></button><button data-m="add">Add an event in ${esc(yr)}</button></div>`, (p) => {
			qa(p, '[data-ev]').forEach((b) => (b.onclick = () => { closePop(); const id = b.dataset.ev; zoomToYear(g.year, () => { sel = id; invalidate(); }); }));
			qa(p, '[data-edit]').forEach((b) => (b.onclick = () => { closePop(); startEdit(b.dataset.edit); }));
			q1(p, '[data-m=spread]').onclick = () => { closePop(); zoomToYear(g.year); };
			q1(p, '[data-m=add]').onclick = () => { closePop(); addEvent(yearStartT(g.year), g.side); };
		});
	}

	/* ---------- the second calendar: a simple year count running alongside, e.g. another people's reckoning ---------- */
	const sec = () => S.cal.second;
	const secYear = (t: number) => Math.floor((t - sec().offset) / Math.max(1, sec().yearDays));
	const secLabel = (y: number) => tpl(sec().fmt || '{Y}', { Y: y, U: '' });

	/* ---------- settings panel ---------- */
	let sheetTab = 'calendar', lastTpl: HTMLInputElement = null, keepDates = true;
	function openSheet(tab?: string) { closePop(); if (tab) sheetTab = tab; sheet.hidden = false; renderSheet(); }
	function closeSheet() { const had = sheet.contains(doc().activeElement); sheet.hidden = true; if (had) stage.focus({ preventScroll: true }); }
	$('sheetClose').onclick = closeSheet;
	sheetBody.tabIndex = -1;
	// Enter saves a text or number field, as leaving it does
	sheetBody.addEventListener('keydown', (e) => { const el = e.target as HTMLElement; if (e.key === 'Enter' && el.instanceOf(HTMLInputElement) && /^(text|number)$/.test(el.type)) { e.preventDefault(); el.blur(); sheetBody.focus({ preventScroll: true }); } });
	$('sheetTabs').addEventListener('click', (e) => { const b = closest(e.target, '[data-tab]'); if (b) { sheetTab = b.dataset.tab; renderSheet(); } });
	function sampleT(kind: Kind) {
		const c = ci(), m = Math.min(3, c.M - 1), d = Math.min(13, S.cal.months[m].days - 1), y = 42 - S.cal.yearStart;
		return kind === 'day' ? toT(y, m, d) : kind === 'month' ? toT(y, m, 0) : toT(y, 0, 0);
	}
	function fmtPreview(kind: string) {
		const f = S.cal.fmt;
		if (kind === 'yearPos') return yearStr(42 - S.cal.yearStart);
		if (kind === 'yearNeg') return yearStr(-13 - S.cal.yearStart);
		if (kind === 'range') return fmtRange({ t: sampleT('day'), end: sampleT('day') + dpy() * 3 + 5 });
		if (kind === 'circa') return tpl(f.circa || DEFAULT_FMT.circa, { date: fmt(sampleT('day')) });
		if (kind === 'ongoing') return fmtRange({ t: sampleT('day'), end: sampleT('day') + 1, oe: true });
		if (kind === 'inter') { const mi = S.cal.months.findIndex((m) => m.inter); return mi < 0 ? 'Add a festival month to use this' : tpl(f.dateInter || DEFAULT_FMT.dateInter, vals(toT(42 - S.cal.yearStart, mi, 0))); }
		const v = vals(sampleT(kind as Kind));
		return tpl(kind === 'day' ? f.dateDay : kind === 'month' ? f.dateMonth : f.dateYear, v);
	}
	const field = (k: string, label: string, value: string, extra = '') => `<label class="fld"><span>${label}</span><input type="text" data-k="${k}" value="${esc(value)}" ${extra}></label>`;
	const X_BTN = ICON.x;
	function renderSheet() {
		qa($('sheetTabs'), '[data-tab]').forEach((b) => b.toggleClass('on', b.dataset.tab === sheetTab));
		const c = S.cal, o = S.opts, I = ci();
		let h = '';
		if (sheetTab === 'calendar') {
			h = `<section><h4>Start from</h4><div class="rowx"><select data-k="sPreset" aria-label="Calendar preset"><option value="">Choose a preset…</option>${Object.entries(PRESETS).map(([k, p]) => `<option value="${k}">${p.label}</option>`).join('')}</select></div></section>
			<section><h4>Months</h4><div class="msum">${I.M} ${I.M === 1 ? esc(c.units.month) : esc(c.units.month) + 's'} · ${I.Y}${I.Yavg !== I.Y ? ` (${+I.Yavg.toFixed(4)} on average)` : ''} ${esc(c.units.day)}s in a ${esc(c.units.year)}</div>
			<div class="mhead"><span></span><span>Name</span><span>${esc(cap(c.units.day))}s</span><span title="Festival days sit between months and belong to none">Fest.</span><span></span></div>
			<div class="mlist" data-k="mList">${c.months.map((m, i) => `<div class="mrow" draggable="true" data-i="${i}"><span class="grip" title="Drag to reorder" aria-hidden="true">⋮⋮</span><input type="text" data-name="${i}" value="${esc(m.name)}" placeholder="${esc(cap(c.units.month))} ${i + 1}" aria-label="Name of ${esc(c.units.month)} ${i + 1}"><input type="number" min="1" max="999" data-days="${i}" value="${m.days}" aria-label="Days in ${esc(m.name || c.units.month + ' ' + (i + 1))}"><input type="checkbox" class="fest" data-fest="${i}" ${m.inter ? 'checked' : ''} title="Festival days: outside any ${esc(c.units.month)}" aria-label="Festival days"><button class="ibtn" data-del="${i}" title="Remove" aria-label="Remove ${esc(m.name || c.units.month + ' ' + (i + 1))}" ${I.M === 1 ? 'disabled' : ''}>${X_BTN}</button></div>`).join('')}</div>
			<div class="rowx"><button class="btn" data-k="mAdd">Add a ${esc(c.units.month)}</button><button class="btn" data-k="mEven">Make all ${esc(c.units.month)}s equal</button></div>
			<label class="chk"><input type="checkbox" data-k="sKeep" ${keepDates ? 'checked' : ''}> Keep events on the same day when ${esc(c.units.month)}s change</label></section>
			<section><h4>Leap days</h4>${c.leaps.map((l) => `<div class="lrow" data-lp="${l.id}">Add <input type="number" min="1" data-lk="days" value="${l.days}"> ${esc(c.units.day)}(s) to <select data-lk="month">${c.months.map((m) => `<option value="${m.id}" ${m.id === l.month ? 'selected' : ''}>${esc(m.name || '(unnamed)')}</option>`).join('')}</select> every <input type="number" min="1" data-lk="every" value="${l.every}"> ${esc(c.units.years)}, except every <input type="number" min="0" data-lk="except" value="${l.except || ''}" placeholder="–">, unless every <input type="number" min="0" data-lk="unless" value="${l.unless || ''}" placeholder="–"><button class="ibtn" data-lpdel="${l.id}" aria-label="Remove leap rule">${X_BTN}</button></div>`).join('') || `<p class="note">Every ${esc(c.units.year)} has ${I.Y} ${esc(c.units.day)}s.</p>`}
			<div class="rowx"><button class="btn" data-k="lpAdd">Add a leap rule</button></div></section>
			<section><h4>Weekdays</h4><label class="fld"><span>Names, in order</span><textarea data-k="wkNames" placeholder="Moonday, Tidesday, …">${esc(c.weekdays.join(', '))}</textarea></label>
			${c.weekdays.length ? `<label class="fld"><span>${esc(fmt(0))} falls on</span><select data-k="wkStart">${c.weekdays.map((w, i) => `<option value="${i}" ${i === c.weekStart ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>` : ''}<p class="note">Use {W} or {Wo} in Formats to show them.</p></section>
			<section><h4>Unit names</h4><div class="grid2">${field('uDay', 'Day', c.units.day)}${field('uMonth', 'Month', c.units.month)}${field('uYear', 'Year', c.units.year)}${field('uYears', 'Years (plural)', c.units.years)}</div></section>
			<section><h4>Numbering</h4><label class="fld"><span>The first ${esc(c.units.year)} is numbered</span><input type="number" data-k="sYs" value="${c.yearStart}"></label>
			<label class="fld"><span>Within an era, ${esc(c.units.years)} count from</span><div class="seg txt">${([[1, '1'], [0, '0']] as [number, string][]).map(([v, l]) => `<button data-eb="${v}" class="${c.eraBase === v ? 'on' : ''}">${l}</button>`).join('')}</div></label><p class="note">Use {EY} and {E} in the year format for dates like “12 SA”. Set an era’s abbreviation in its editor.</p></section>
			<section><h4>Second calendar</h4><label class="chk"><input type="checkbox" data-k="s2on" ${c.second.on ? 'checked' : ''}> Show a second year count alongside</label>
			<div class="s2box ${c.second.on ? '' : 'off'}">${field('s2name', 'Name', c.second.name)}<div class="grid2"><label class="fld"><span>${esc(cap(c.units.day))}s in its ${esc(c.units.year)}</span><input type="number" min="1" data-k="s2days" value="${c.second.yearDays}"></label>${field('s2fmt', 'Year label', c.second.fmt, 'spellcheck="false"')}</div>
			<div class="fld"><span>Its ${esc(c.units.year)} 0 begins on</span>${dateFields('s2o', c.second.offset)}</div><label class="chk"><input type="checkbox" data-k="s2cards" ${c.second.onCards ? 'checked' : ''}> Show it on cards too</label></div></section>
			<section><h4>Import</h4><label class="fld"><span>Paste a Calendarium or Fantasy-Calendar export</span><textarea data-k="impTxt" placeholder='{"static": {"months": [...]}}' spellcheck="false"></textarea></label><div class="rowx"><button class="btn" data-k="impGo">Import calendar</button></div></section>`;
		} else if (sheetTab === 'formats') {
			h = `<section><h4>Tokens</h4><p class="note">Click a token to add it to the field you were last editing.</p><div class="chips">${TOKENS.map(([t, d]) => `<button data-tok="${t}" title="${esc(d)}">${t}</button>`).join('')}</div>
			<dl class="toks">${TOKENS.map(([t, d]) => `<dt>${t}</dt><dd>${esc(d)}</dd>`).join('')}</dl></section>
			${FMT_FIELDS.map(([title, rows]) => `<section><h4>${title}</h4>${rows.map(([k, label, kind]) => `<label class="fld"><span>${label}</span><input type="text" data-fmt="${k}" data-kind="${kind}" value="${esc(c.fmt[k])}" spellcheck="false"><output class="prev" data-prev="${kind}">${esc(fmtPreview(kind))}</output></label>`).join('')}
			${title === 'Spans' ? `<label class="chk"><input type="checkbox" data-k="sShort" ${c.fmt.shortRange ? 'checked' : ''}> Shorten whole-${esc(c.units.year)} spans (${esc(tpl(c.fmt.year, { Y: '30–44', U: cap(c.units.year) }))})</label>` : ''}</section>`).join('')}
			<div class="rowx"><button class="btn" data-k="fReset">Reset all formats</button></div>`;
		} else if (sheetTab === 'timeline') {
			h = `<section><h4>Name</h4>${field('tName', 'Timeline name', S.name)}</section>
			<section><h4>Direction</h4><div class="seg">${(Object.entries(ORIENT) as [Orientation, { rot: number; label: string }][]).map(([k, v]) => `<button data-o="${k}" class="${S.orientation === k ? 'on' : ''}" title="${v.label}" aria-label="${v.label}">${ICON.arrow(v.rot)}</button>`).join('')}</div><p class="note">${ORIENT[S.orientation].label}</p></section>
			<section><h4>Range</h4><div class="grid2"><label class="fld"><span>From ${esc(c.units.year)}</span><input type="number" data-k="r0" value="${S.range[0] + c.yearStart}"></label><label class="fld"><span>To ${esc(c.units.year)}</span><input type="number" data-k="r1" value="${S.range[1] + c.yearStart}"></label></div>
			<div class="rowx"><button class="btn" data-k="rFit">Fit the range to my events</button></div></section>
			<section><h4>Snapping</h4><div class="seg txt">${[['auto', 'Ruler'], ['d', cap(c.units.day)], ['m', cap(c.units.month)], ['y', cap(c.units.year)]].map(([k, l]) => `<button data-snap="${k}" class="${o.snapTo === k ? 'on' : ''}" ${k === 'm' && I.M === 1 ? 'disabled' : ''}>${esc(l)}</button>`).join('')}</div><p class="note">What dragged cards and new selections lock to. “Ruler” follows the marks on the line at the current zoom. Hold Alt to move by single ${esc(c.units.day)}s.</p></section>
			<section><h4>Now</h4><p class="note">Mark where the story is up to, like a campaign’s current date.</p>${dateFields('nw', S.now != null ? S.now : snap(tAt(G.L / 2)))}
			<div class="rowx"><button class="btn" data-k="nwSet">${S.now != null ? 'Update “now”' : 'Set “now”'}</button>${S.now != null ? '<button class="btn" data-k="nwGo">Go to now</button><button class="btn" data-k="nwClr">Clear</button>' : ''}</div>
			<label class="chk"><input type="checkbox" data-k="nwFade" ${o.fadeFuture ? 'checked' : ''}> Fade what hasn’t happened yet</label></section>
			<section><h4>Eras</h4><label class="chk"><input type="checkbox" data-k="oBands" ${o.bands ? 'checked' : ''}> Shade eras behind the timeline</label><label class="chk"><input type="checkbox" data-k="oSub" ${o.subLabels ? 'checked' : ''}> Show sub-era names</label></section>
			<section><h4>Export</h4><div class="rowx"><button class="btn" data-exp="table">Copy as a Markdown table</button><button class="btn" data-exp="outline">Copy as an outline by era</button><button class="btn" data-exp="file">Copy the timeline file</button><button class="btn" data-exp="embed">Copy an embed for this view</button></div>
			<div class="rowx"><button class="btn" data-exp="tableNote">Save the table as a note</button><button class="btn" data-exp="outlineNote">Save the outline as a note</button></div><p class="note">Notes are saved next to this timeline.</p></section>
			<section><h4>Defaults</h4><div class="rowx"><button class="btn" data-k="tDef">Use these settings for new timelines</button></div><p class="note">Saves this calendar, its formats, colors and card options as the starting point for every new timeline. You can clear them in the plugin’s settings.</p></section>
			<section><h4>Start over</h4><div class="rowx"><button class="btn" data-k="tNew">New empty timeline</button><button class="btn" data-k="tSample">Open the sample</button></div><p class="note">Both open a new timeline file; this one stays as it is.</p></section>`;
		} else if (sheetTab === 'colors') {
			const uses = (id: string) => { const e = S.events.filter((x) => x.color === id).length, r = S.eras.filter((x) => x.color === id).length; return [e && `${e} card${e === 1 ? '' : 's'}`, r && `${r} era${r === 1 ? '' : 's'}`].filter(Boolean).join(' · ') || 'Unused'; };
			h = `<section><h4>Color presets</h4><p class="note">Cards and eras use these presets. Change a preset and everything using it changes with it.</p>
			<div class="palhead"><span></span><span>Name</span><span>Hex</span><span></span></div>
			<div class="pal-list">${S.palette.map((p) => `<div class="palrow"><label class="pchip" style="--cc:${esc(hexOf(p))}" title="Pick a color"><input type="color" data-pc="${p.id}" value="${esc(hexOf(p))}" aria-label="Pick a color for ${esc(p.name)}"></label>
			<div class="pmeta"><input type="text" data-pn="${p.id}" value="${esc(p.name)}" aria-label="Preset name"><small>${uses(p.id)}${p.hex ? '' : ' · follows the theme'}</small></div>
			<input type="text" data-ph="${p.id}" value="${esc(hexOf(p))}" maxlength="7" spellcheck="false" aria-label="Hex code for ${esc(p.name)}">
			<button class="ibtn" data-pdel="${p.id}" title="Delete preset" aria-label="Delete ${esc(p.name)}" ${S.palette.length === 1 ? 'disabled' : ''}>${X_BTN}</button></div>`).join('')}</div>
			<div class="rowx"><button class="btn" data-k="palAdd">Add a color</button><button class="btn" data-k="palReset">Reset to the defaults</button></div></section>`;
		} else if (sheetTab === 'notes') {
			const sy = o.sync, sample = S.events.find((e) => e.id === sel && e.file) || [...S.events].sort((a, b) => a.t - b.t).find((e) => e.file);
			const shown = sample ? SYNC_FIELDS.filter(([k]) => sy.fields[k].on && sy.fields[k].key.trim()).map(([k]) => { const v = syncValue(k, sample, S, E); return v == null || (Array.isArray(v) && !v.length) ? '' : `${sy.fields[k].key.trim()}: ${Array.isArray(v) ? `[${v.join(', ')}]` : String(v)}`; }).filter(Boolean).join('\n') : '';
			const cands = candidates();
			h = `<section><h4>Linked notes</h4><label class="chk"><input type="checkbox" data-k="syOn" ${sy.on ? 'checked' : ''}> Write timeline properties into linked notes</label>
			<p class="note">Adds properties to each linked note and keeps them current as you move its card, change eras or edit the calendar. Editing the year, month or day in a note moves its card. Only notes linked from this timeline are changed.</p></section>
			<section class="${sy.on ? '' : 'off'}"><h4>Properties to sync</h4><div class="syhead"><span></span><span>Field</span><span>Property name</span></div>
			${SYNC_FIELDS.map(([k, label]) => `<div class="syrow"><input type="checkbox" data-syf="${k}" ${sy.fields[k].on ? 'checked' : ''} aria-label="Sync ${esc(label)}"><span>${esc(label)}</span><input type="text" data-syk="${k}" value="${esc(sy.fields[k].key)}" spellcheck="false" aria-label="Property name for ${esc(label)}"></div>`).join('')}
			${sample ? `<div class="fld"><span>How “${esc(titleOf(sample))}” will start</span><pre class="fmprev">${esc(shown ? `---\n${shown}\n---` : 'No properties selected')}</pre></div>` : '<p class="note">Link a note to a card to see a preview.</p>'}</section>
			<section><h4>Create cards from notes</h4><p class="note">Finds notes that aren’t on the timeline yet but have a year (and optionally month and day) in their properties, or a date like “14 Frost 412”.</p>
			<div class="cfn">${cands.length ? `${cands.slice(0, 200).map((x) => `<label class="chk"><input type="checkbox" data-cfn="${esc(x.link)}" ${x.tick ? 'checked' : ''}> ${esc(x.title)} <small class="cfn-date">${esc(fmt(x.t))}</small></label>`).join('')}<div class="rowx"><button class="btn" data-k="cfnGo">Create ${Math.min(200, cands.length)} card${cands.length === 1 ? '' : 's'}</button></div>` : '<p class="note">No dated notes are waiting.</p>'}</div></section>
			<section><h4>Clean up</h4><div class="rowx"><button class="btn" data-k="syStrip">Remove timeline properties from linked notes</button></div><p class="note">Turning sync off leaves notes as they are. Use this to take the properties back out.</p></section>`;
		} else {
			h = `<section><h4>Size</h4><label class="fld"><span>Card width <output class="cwv">${S.cardWidth || 240}px</output></span><input type="range" min="160" max="360" step="10" data-k="cw" value="${S.cardWidth || 240}"></label>
			<label class="fld"><span>Description lines, at most</span><div class="seg txt">${([[0, 'None'], [2, '2'], [4, '4'], [99, 'All']] as [number, string][]).map(([n, l]) => `<button data-lines="${n}" class="${o.cardLines === n ? 'on' : ''}">${l}</button>`).join('')}</div></label><p class="note">Cards grow to fit their description (up to ${DESC_MAX} characters) and shrink to a single title line when there's none.</p></section>
			<section><h4>Spans</h4><div class="seg txt">${[['threads', 'Threads'], ['blocks', 'Blocks']].map(([k, l]) => `<button data-spans="${k}" class="${o.spanStyle === k ? 'on' : ''}">${l}</button>`).join('')}</div><p class="note">${o.spanStyle === 'blocks' ? 'Each span is a tinted block from its start to its end, with its card pinned inside.' : 'Each span is a thread that leaves the line at its start and rejoins it at its end. Its name pins to the edge while you scroll through it.'}</p></section>
			<section><h4>Color</h4><label class="chk"><input type="checkbox" data-k="oTint" ${o.tint ? 'checked' : ''}> Tint cards with their color</label></section>
			<section><h4>Grouping</h4><label class="fld"><span>Group a ${esc(c.units.year)} into one card when it has more than</span><div class="seg txt">${([[0, 'Never'], [2, '2'], [3, '3'], [5, '5'], [8, '8']] as [number, string][]).map(([n, l]) => `<button data-grp="${n}" class="${o.groupOver === n ? 'on' : ''}">${l}</button>`).join('')}</div></label><p class="note">Only while zoomed out. Zooming in spreads the group back into separate cards.</p></section>`;
		}
		const scroll = sheetBody.scrollTop;
		const act = doc().activeElement as HTMLElement, hadFocus = sheet.contains(act);
		// remember which control had focus (by its data-* key) so a redraw can put the user back on it
		const fa = hadFocus && sheetBody.contains(act) && act !== sheetBody ? Array.from(act.attributes).find((a) => a.name.startsWith('data-')) : null;
		const focusSel = fa ? `[${fa.name}="${CSS.escape(fa.value)}"]` : null;
		setHTML(sheetBody, h);
		const again = focusSel && q1<HTMLElement>(sheetBody, focusSel);
		if (again) again.focus({ preventScroll: true });
		else if (hadFocus && !sheet.contains(doc().activeElement)) sheetBody.focus({ preventScroll: true }); // keep keyboard shortcuts working
		qa(sheetBody, '.mrow').forEach((r) => (r.draggable = true));
		sheetBody.scrollTop = scroll;
		bindSheet();
	}
	// Every control applies live. Text fields record one undo step per edit, when they lose focus.
	function bindSheet() {
		const q = <T extends HTMLElement = HTMLElement>(s: string) => q1<T>(sheetBody, s), qq = <T extends HTMLElement = HTMLElement>(s: string) => qa<T>(sheetBody, s);
		const k = <T extends HTMLElement = HTMLElement>(key: string) => q<T>(`[data-k="${key}"]`);
		const step = (fn: () => void) => { const before = snapshot(); fn(); commit(before); };
		// commit without a snapshot records no undo step, so at least make sure the change is saved
		const commitOrSave = (before: string) => { commit(before); if (!before) host.requestSave(); };
		const calStep = (fn: () => void) => step(() => { const old = JSON.parse(JSON.stringify(S.cal)) as EvraDoc['cal']; fn(); normCal(S.cal); E.reset(); if (keepDates) E.remapDates(old, S.cal); });
		// redraw: labels elsewhere in the panel use this value, so draw it again once the edit is done
		const liveText = (el: HTMLInputElement | HTMLTextAreaElement, apply: (v: string) => void, after?: () => void, redraw = false) => {
			let before: string = null;
			el.addEventListener('focus', () => { before = snapshot(); if (el.dataset.fmt) lastTpl = el as HTMLInputElement; });
			el.addEventListener('input', () => { apply(el.value); E.reset(); invalidate(); if (after) after(); });
			el.addEventListener('change', () => {
				const changed = before !== snapshot();
				commitOrSave(before);
				before = snapshot();
				// after the event, so focus has already moved on to wherever the user tabbed or clicked
				if (redraw && changed) later(() => { if (!sheet.hidden) renderSheet(); }, 0);
			});
		};
		const refreshPrev = () => qq('[data-prev]').forEach((o) => (o.textContent = fmtPreview(o.dataset.prev)));
		const int = (v: string) => parseInt(v, 10);
		// calendar
		const ps = k<HTMLSelectElement>('sPreset');
		if (ps) ps.onchange = () => {
			const p = PRESETS[ps.value];
			if (!p) return;
			calStep(() => {
				S.cal.months = p.months.map(([name, days]) => ({ id: uid(), name, days }));
				S.cal.leaps = p.leap ? [{ id: uid(), month: S.cal.months[p.leap.month].id, days: 1, every: p.leap.every, except: p.leap.except, unless: p.leap.unless, off: 0 }] : [];
				if (p.weekdays) S.cal.weekdays = p.weekdays;
			});
			toast(`Calendar set to ${p.label.toLowerCase()}.`, true); renderSheet();
		};
		qq<HTMLInputElement>('[data-name]').forEach((el) => liveText(el, (v) => { S.cal.months[+el.dataset.name].name = v; }, undefined, true));
		qq<HTMLInputElement>('[data-days]').forEach((el) => (el.onchange = () => {
			const n = int(el.value);
			if (!(n >= 1)) { el.value = String(S.cal.months[+el.dataset.days].days); toast('A month needs at least one day.'); return; }
			calStep(() => { S.cal.months[+el.dataset.days].days = n; }); renderSheet();
		}));
		qq('[data-del]').forEach((el) => (el.onclick = () => { calStep(() => { S.cal.months.splice(+el.dataset.del, 1); }); renderSheet(); }));
		const add = k('mAdd');
		if (add) add.onclick = () => { calStep(() => { const l = S.cal.months[S.cal.months.length - 1]; S.cal.months.push({ id: uid(), name: '', days: l ? l.days : 30 }); }); renderSheet(); const ins = qq('[data-name]'); ins[ins.length - 1].focus(); };
		const even = k('mEven');
		if (even) even.onclick = () => { const d = Math.round(ci().Y / S.cal.months.length); calStep(() => S.cal.months.forEach((m) => (m.days = d))); renderSheet(); };
		const keep = k<HTMLInputElement>('sKeep');
		if (keep) keep.onchange = () => { keepDates = keep.checked; };
		const list = k('mList');
		if (list) {
			let from: number = null;
			list.addEventListener('dragstart', (e) => { const r = closest(e.target, '.mrow'); from = r ? +r.dataset.i : null; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', ''); if (r) r.addClass('dragging'); });
			list.addEventListener('dragover', (e) => { e.preventDefault(); qa(list, '.mrow').forEach((r) => r.removeClass('over')); const r = closest(e.target, '.mrow'); if (r) r.addClass('over'); });
			list.addEventListener('drop', (e) => {
				e.preventDefault();
				const r = closest(e.target, '.mrow');
				if (from == null || !r) return;
				const to = +r.dataset.i;
				if (to !== from) calStep(() => { const [m] = S.cal.months.splice(from, 1); S.cal.months.splice(to, 0, m); });
				from = null; renderSheet();
			});
			list.addEventListener('dragend', () => renderSheet());
		}
		([['uDay', 'day'], ['uMonth', 'month'], ['uYear', 'year'], ['uYears', 'years']] as [string, keyof typeof DEFAULT_UNITS][]).forEach(([s, u]) => { const el = k<HTMLInputElement>(s); if (el) liveText(el, (v) => { S.cal.units[u] = v.trim() || DEFAULT_UNITS[u]; }, undefined, true); });
		qq<HTMLInputElement>('[data-fest]').forEach((el) => (el.onchange = () => { calStep(() => { S.cal.months[+el.dataset.fest].inter = el.checked; }); renderSheet(); }));
		qq('[data-lp]').forEach((row) => qa<HTMLInputElement | HTMLSelectElement>(row, '[data-lk]').forEach((el) => (el.onchange = () => {
			const l = S.cal.leaps.find((x) => x.id === row.dataset.lp), key = el.dataset.lk as 'month' | 'days' | 'every' | 'except' | 'unless';
			calStep(() => { if (key === 'month') l.month = el.value; else l[key] = Math.max(key === 'every' || key === 'days' ? 1 : 0, int(el.value) || 0); });
			renderSheet();
			// accepted either way, but the counts only add up when each number is a multiple of the one before
			const yrs = S.cal.units.years;
			if (l.except && l.except % l.every) toast(`“Except every ${l.except}” isn’t a multiple of “every ${l.every}”, so it skips ${yrs} that never had a leap day.`);
			else if (l.unless && !l.except) toast('“Unless every” does nothing without an “except every”.');
			else if (l.unless && l.unless % l.except) toast(`“Unless every ${l.unless}” isn’t a multiple of “except every ${l.except}”, so it adds back ${yrs} that were never skipped.`);
		})));
		qq('[data-lpdel]').forEach((b) => (b.onclick = () => { calStep(() => { S.cal.leaps = S.cal.leaps.filter((x) => x.id !== b.dataset.lpdel); }); renderSheet(); }));
		const lpa = k('lpAdd');
		if (lpa) lpa.onclick = () => { calStep(() => { const m = S.cal.months[Math.min(1, S.cal.months.length - 1)]; S.cal.leaps.push({ id: uid(), month: m.id, days: 1, every: 4, except: 0, unless: 0, off: 0 }); }); renderSheet(); };
		const wn = k<HTMLTextAreaElement>('wkNames');
		if (wn) wn.onchange = () => { step(() => { S.cal.weekdays = wn.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean); S.cal.weekStart = Math.min(S.cal.weekStart, Math.max(0, S.cal.weekdays.length - 1)); }); renderSheet(); };
		const ws = k<HTMLSelectElement>('wkStart');
		if (ws) ws.onchange = () => step(() => { S.cal.weekStart = +ws.value; });
		qq('[data-eb]').forEach((b) => (b.onclick = () => { step(() => { S.cal.eraBase = b.dataset.eb === '0' ? 0 : 1; }); renderSheet(); }));
		const s2 = S.cal.second, s2on = k<HTMLInputElement>('s2on');
		if (s2on) {
			s2on.onchange = () => { step(() => { s2.on = s2on.checked; }); renderSheet(); };
			const s2c = k<HTMLInputElement>('s2cards'), s2d = k<HTMLInputElement>('s2days');
			s2c.onchange = () => step(() => { s2.onCards = s2c.checked; });
			s2d.onchange = () => { const v = Math.max(1, Math.min(1e6, int(s2d.value) || 1)); s2d.value = String(v); step(() => { s2.yearDays = v; }); };
			liveText(k<HTMLInputElement>('s2name'), (v) => { s2.name = v; });
			liveText(k<HTMLInputElement>('s2fmt'), (v) => { s2.fmt = v; });
			qq('[data-d^="s2o"]').forEach((el) => (el.onchange = () => { const t = readDate(sheetBody, 's2o'); if (t != null) step(() => { s2.offset = t; }); }));
		}
		const ig = k('impGo');
		if (ig) ig.onclick = () => {
			const r = parseCalendarImport(k<HTMLTextAreaElement>('impTxt').value);
			if (typeof r === 'string') { toast(r); return; }
			// the import replaces the whole structure: nothing is kept from the old months, leap rules or week
			calStep(() => { S.cal.months = r.months; S.cal.leaps = r.leaps || []; S.cal.weekdays = r.weekdays || []; S.cal.weekStart = 0; });
			toast(`Imported ${r.months.length} months${r.leaps.length ? `, ${r.leaps.length} leap rule${r.leaps.length > 1 ? 's' : ''}` : ''}${r.weekdays.length ? ` and a ${r.weekdays.length}-day week` : ''}.`, true);
			renderSheet();
		};
		const ys = k<HTMLInputElement>('sYs');
		// the same limits normDoc applies, so what's shown live is what the file reopens with
		if (ys) ys.onchange = () => { const v = Math.max(-1e12, Math.min(1e12, int(ys.value) || 0)); ys.value = String(v); step(() => { S.cal.yearStart = v; }); };
		// formats
		qq<HTMLInputElement>('[data-fmt]').forEach((el) => liveText(el, (v) => { (S.cal.fmt as unknown as Record<string, string>)[el.dataset.fmt] = v; }, refreshPrev));
		qq('[data-tok]').forEach((b) => (b.onclick = () => {
			const el = lastTpl && sheetBody.contains(lastTpl) ? lastTpl : q<HTMLInputElement>('[data-fmt]');
			if (!el) return;
			const a = el.selectionStart ?? el.value.length, z = el.selectionEnd ?? a, tok = b.dataset.tok;
			el.focus();
			el.value = el.value.slice(0, a) + tok + el.value.slice(z);
			el.setSelectionRange(a + tok.length, a + tok.length);
			el.dispatchEvent(new Event('input')); el.dispatchEvent(new Event('change'));
		}));
		const sh = k<HTMLInputElement>('sShort');
		if (sh) sh.onchange = () => { step(() => { S.cal.fmt.shortRange = sh.checked; }); refreshPrev(); };
		const fr = k('fReset');
		if (fr) fr.onclick = () => { step(() => { S.cal.fmt = { ...DEFAULT_FMT }; }); renderSheet(); };
		// timeline
		const nm = k<HTMLInputElement>('tName');
		if (nm) liveText(nm, (v) => { S.name = v.trim() || 'Untitled'; });
		qq('[data-o]').forEach((b) => (b.onclick = () => { setOrientation(b.dataset.o as Orientation); renderSheet(); }));
		const rangeChange = () => {
			const ys_ = S.cal.yearStart;
			let a = int(k<HTMLInputElement>('r0').value) - ys_, b = int(k<HTMLInputElement>('r1').value) - ys_;
			if (!Number.isFinite(a) || !Number.isFinite(b)) { toast('Enter a year.'); renderSheet(); return; } // renderSheet puts the old value back
			const far = (y: number) => Math.abs(y + ys_) > 1e9 || !okDay(yearStartT(y)); // past what a reopened file keeps
			if (far(a) || far(b)) { toast('That year is too far out.'); renderSheet(); return; }
			if (!(b > a)) { toast('The range has to end after it starts.'); renderSheet(); return; }
			const cb = contentBounds();
			if (cb && (yearStartT(a) > cb[0] || yearStartT(b) < cb[1])) { a = Math.min(a, yearOf(cb[0])); b = Math.max(b, yearOf(cb[1]) + 1); toast('Kept the range wide enough for existing events and eras.'); }
			step(() => { S.range = [a, b]; }); renderSheet();
		};
		if (k('r0')) { k('r0').onchange = rangeChange; k('r1').onchange = rangeChange; }
		const rf = k('rFit');
		if (rf) rf.onclick = () => {
			const cb = contentBounds();
			if (!cb) { toast('Add an event first.'); return; }
			step(() => { S.range = [yearOf(cb[0]), Math.max(yearOf(cb[0]) + 1, yearStartT(yearOf(cb[1])) === cb[1] ? yearOf(cb[1]) : yearOf(cb[1]) + 1)]; });
			renderSheet(); fitAll();
		};
		qq('[data-snap]').forEach((b) => (b.onclick = () => { step(() => { S.opts.snapTo = b.dataset.snap as EvraDoc['opts']['snapTo']; }); renderSheet(); }));
		const nws = k('nwSet');
		if (nws) {
			nws.onclick = () => { const t = readDate(sheetBody, 'nw'); if (t != null) { setNow(t); renderSheet(); } };
			const g = k('nwGo'); if (g) g.onclick = goToNow;
			const c = k('nwClr'); if (c) c.onclick = () => { setNow(null); renderSheet(); };
			const nf = k<HTMLInputElement>('nwFade');
			nf.onchange = () => step(() => { S.opts.fadeFuture = nf.checked; });
		}
		const ob = k<HTMLInputElement>('oBands'); if (ob) ob.onchange = () => step(() => { S.opts.bands = ob.checked; });
		const osb = k<HTMLInputElement>('oSub'); if (osb) osb.onchange = () => step(() => { S.opts.subLabels = osb.checked; });
		const td = k('tDef');
		if (td) td.onclick = () => {
			host.saveDefaults(JSON.parse(JSON.stringify({ cal: S.cal, palette: S.palette, opts: { ...S.opts, sync: { ...S.opts.sync, written: [], notes: [] } }, cardWidth: S.cardWidth, orientation: S.orientation })) as import('./types').TimelineDefaults)
				.then(() => toast('New timelines will start with these settings.'), () => toast('Couldn’t save the defaults.'));
		};
		qq('[data-exp]').forEach((b) => (b.onclick = () => {
			const x = b.dataset.exp;
			if (x === 'table') copyOut(exportMarkdownTable(), 'the Markdown table');
			if (x === 'outline') copyOut(exportOutline(), 'the outline');
			if (x === 'file') copyOut(JSON.stringify(S, null, '\t'), 'the timeline file');
			if (x === 'embed') copyOut(embedCode(), 'the embed code');
			if (x === 'tableNote') void host.saveAsNote(`${S.name} (table)`, exportMarkdownTable() + '\n');
			if (x === 'outlineNote') void host.saveAsNote(`${S.name} (outline)`, exportOutline() + '\n');
		}));
		const tn = k('tNew'); if (tn) tn.onclick = () => host.newTimeline();
		const tsm = k('tSample'); if (tsm) tsm.onclick = () => host.sampleTimeline();
		// cards
		const cw = k<HTMLInputElement>('cw');
		if (cw) {
			let before: string = null;
			// snapshot at the first input of a drag or key press, so arrow keys get an undo step too
			cw.oninput = () => { before = before ?? snapshot(); S.cardWidth = +cw.value; q('.cwv').textContent = cw.value + 'px'; invalidate(); };
			cw.onchange = () => { commitOrSave(before); before = null; };
		}
		qq('[data-lines]').forEach((b) => (b.onclick = () => { step(() => { S.opts.cardLines = +b.dataset.lines; }); renderSheet(); }));
		qq('[data-spans]').forEach((b) => (b.onclick = () => { noAnim = true; step(() => { S.opts.spanStyle = b.dataset.spans === 'blocks' ? 'blocks' : 'threads'; }); renderSheet(); }));
		// colors: the picker updates everything live; one undo step per change
		qq<HTMLInputElement>('[data-pc]').forEach((el) => {
			let before: string = null;
			const p = S.palette.find((x) => x.id === el.dataset.pc);
			el.addEventListener('focus', () => { before = snapshot(); });
			el.addEventListener('pointerdown', () => { before = before ?? snapshot(); });
			// the native picker can keep sending changes after the first one (and after a redraw), so snapshot again when needed
			el.addEventListener('input', () => { before = before ?? snapshot(); p.hex = el.value; closest(el, '.pchip').style.setProperty('--cc', el.value); const hx = q<HTMLInputElement>(`[data-ph="${p.id}"]`); if (hx) hx.value = el.value; invalidate(); });
			el.addEventListener('change', () => { commitOrSave(before); before = null; renderSheet(); });
		});
		qq<HTMLInputElement>('[data-ph]').forEach((el) => (el.onchange = () => {
			const p = S.palette.find((x) => x.id === el.dataset.ph), hx = normHex(el.value);
			if (!hx) { toast('Use a hex code like #3a9d5d.'); el.value = hexOf(p); return; }
			step(() => { p.hex = hx; }); renderSheet();
		}));
		qq<HTMLInputElement>('[data-pn]').forEach((el) => (el.onchange = () => { const p = S.palette.find((x) => x.id === el.dataset.pn); step(() => { p.name = el.value.trim() || 'Untitled color'; }); renderSheet(); }));
		qq('[data-pdel]').forEach((b) => (b.onclick = () => {
			const id = b.dataset.pdel, p = S.palette.find((x) => x.id === id), n = S.events.filter((x) => x.color === id).length + S.eras.filter((x) => x.color === id).length;
			step(() => { S.palette = S.palette.filter((x) => x.id !== id); S.events.forEach((x) => { if (x.color === id) x.color = null; }); S.eras.forEach((x) => { if (x.color === id) x.color = null; }); });
			toast(`Deleted “${p.name}”${n ? `; ${n} item${n === 1 ? '' : 's'} now have no color` : ''}.`, true); renderSheet();
		}));
		const pa = k('palAdd');
		if (pa) pa.onclick = () => {
			const hx = hslHex(Math.floor(Math.random() * 360), 55, 55);
			step(() => { S.palette.push({ id: uid(), name: 'New color', hex: hx }); });
			renderSheet();
			const ns = qq<HTMLInputElement>('[data-pn]');
			ns[ns.length - 1].focus(); ns[ns.length - 1].select();
		};
		const pr = k('palReset');
		if (pr) pr.onclick = () => {
			const keepIds = new Set(defaultPalette().map((p) => p.id));
			step(() => { S.palette = defaultPalette(); S.events.forEach((x) => { if (x.color && !keepIds.has(x.color)) x.color = null; }); S.eras.forEach((x) => { if (x.color && !keepIds.has(x.color)) x.color = null; }); });
			renderSheet(); toast('Colors reset. Undo to go back.', true);
		};
		// notes
		const syOn = k<HTMLInputElement>('syOn');
		if (syOn) syOn.onchange = () => { step(() => { S.opts.sync.on = syOn.checked; }); renderSheet(); if (syOn.checked) toast('Linked notes now carry timeline properties.'); };
		qq<HTMLInputElement>('[data-syf]').forEach((b) => (b.onchange = () => { step(() => { S.opts.sync.fields[b.dataset.syf as keyof EvraDoc['opts']['sync']['fields']].on = b.checked; }); renderSheet(); }));
		qq<HTMLInputElement>('[data-syk]').forEach((el) => (el.onchange = () => {
			const key = el.dataset.syk as keyof EvraDoc['opts']['sync']['fields'], v = el.value.trim().replace(/\s+/g, '-');
			if (!v) { el.value = S.opts.sync.fields[key].key; toast('A property needs a name.'); return; }
			step(() => { S.opts.sync.fields[key].key = v; }); renderSheet();
		}));
		const cg = k('cfnGo');
		if (cg) cg.onclick = () => {
			const links = new Set(qq<HTMLInputElement>('[data-cfn]').filter((x) => x.checked).map((x) => x.dataset.cfn));
			createFromNotes(candidates().filter((x) => links.has(x.link))); renderSheet();
		};
		const sst = k('syStrip');
		if (sst) sst.onclick = () => { void host.stripSyncedProps(S).then((n) => toast(n ? `Removed timeline properties from ${n} note${n === 1 ? '' : 's'}.` : 'No notes had timeline properties.')); };
		const ot = k<HTMLInputElement>('oTint'); if (ot) ot.onchange = () => step(() => { S.opts.tint = ot.checked; });
		qq('[data-grp]').forEach((b) => (b.onclick = () => { step(() => { S.opts.groupOver = +b.dataset.grp; }); renderSheet(); }));
	}

	/* ---------- search and commands ----------
	   Ctrl/⌘ K searches cards, eras and notes, and jumps to any date you type ("412", "Frost 412", "14 Frost, Year 412").
	   ">" in search runs commands; they are also in Obsidian's command palette. */
	let flashT = 0, flash: { t: number } = null;
	function flashAt(t: number) { flash = { t }; win().clearTimeout(flashT); flashT = later(() => { flash = null; invalidate(); }, 1800); invalidate(); }
	function goToDate(t: number) { animView(t, V.scale, () => flashAt(t)); }
	function zoomToSelection() {
		const ids = selIds();
		if (!ids.length) return;
		const evs = ids.map(evById).filter(Boolean), a = Math.min(...evs.map((e) => e.t)), b = Math.max(...evs.map((e) => (e.end != null && !e.oe ? e.end : e.t)));
		if (b - a < dpy() * 0.5) animView((a + b) / 2, Math.max(V.scale, G.L / (dpy() * 6))); else fitRange(a, b);
	}
	const middleT = () => snap(tAt(G.L / 2));
	const ACTIONS: Record<string, () => void> = {
		'new-event': () => addEvent(middleT(), 'b'),
		'search': () => openPalette(''),
		'go-to-date': () => openPalette('', 'Type a date, like 412 or 14 Frost 412'),
		'fit-all': () => fitAll(),
		'zoom-selection': () => zoomToSelection(),
		'zoom-in': () => animView(V.v0 + G.L / 2 / V.scale, V.scale * 1.6),
		'zoom-out': () => animView(V.v0 + G.L / 2 / V.scale, V.scale / 1.6),
		'direction-ttb': () => setOrientation('ttb'), 'direction-btt': () => setOrientation('btt'),
		'direction-ltr': () => setOrientation('ltr'), 'direction-rtl': () => setOrientation('rtl'),
		'spans-threads': () => { const b = snapshot(); S.opts.spanStyle = 'threads'; noAnim = true; commit(b); },
		'spans-blocks': () => { const b = snapshot(); S.opts.spanStyle = 'blocks'; noAnim = true; commit(b); },
		'select-all': () => selectAll(),
		'duplicate': () => duplicateSel(),
		'undo': () => undo(), 'redo': () => redoF(),
		'settings-calendar': () => openSheet('calendar'), 'settings-formats': () => openSheet('formats'), 'settings-timeline': () => openSheet('timeline'),
		'settings-cards': () => openSheet('cards'), 'settings-colors': () => openSheet('colors'), 'settings-notes': () => openSheet('notes'),
		'save-view': () => openViews({ x: G.W - 340, y: 80 }),
		'filter': () => openFilter({ x: G.W - 360, y: 80 }),
		'copy-table': () => copyOut(exportMarkdownTable(), 'the Markdown table'),
		'copy-outline': () => copyOut(exportOutline(), 'the outline'),
		'copy-embed': () => copyOut(embedCode(), 'the embed code'),
		'create-from-notes': () => openSheet('notes'),
		'go-to-now': () => goToNow(),
		'set-now': () => setNow(middleT()),
		'shortcuts': () => openHelp({ x: G.W - 340, y: 60 }),
	};
	const pal = $('palette'), palIn = $<HTMLInputElement>('palIn'), palList = $('palList');
	interface PalItem { kind: string; label: string; meta: string; color?: string; rank?: number; run: () => void }
	let palItems: PalItem[] = [], palSel = 0;
	function openPalette(q: string, placeholder?: string) {
		closePop(); pal.hidden = false; palIn.value = q;
		palIn.placeholder = placeholder || 'Search cards, eras and notes, or type a date. Start with > for commands';
		renderPalette(); palIn.focus();
	}
	function closePalette() { pal.hidden = true; stage.focus({ preventScroll: true }); }
	function renderPalette() {
		const raw = palIn.value, cmd = raw.startsWith('>'), q = (cmd ? raw.slice(1) : raw).trim().toLowerCase(), items: PalItem[] = [];
		const hit = (s: string) => !q || String(s).toLowerCase().includes(q);
		const cmdItem = (c: (typeof TIMELINE_COMMANDS)[number]): PalItem => ({ kind: 'Command', label: c.name, meta: c.key, run: ACTIONS[c.id] });
		if (cmd) TIMELINE_COMMANDS.forEach((c) => { if (hit(c.name)) items.push(cmdItem(c)); });
		else {
			const t = E.parseDateQuery(raw);
			if (t != null) items.push({ kind: 'Go to', label: fmt(t), meta: 'Date', run: () => goToDate(t) });
			if (q) {
				// names that start with the search come first, then names containing it, then matches in descriptions and tags
				const rank = (name: string) => { const n = name.toLowerCase(); return n.startsWith(q) ? 0 : new RegExp('\\b' + q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(n) ? 1 : n.includes(q) ? 2 : 3; };
				S.events.forEach((ev) => { const title = titleOf(ev); if (hit(title) || hit(plainOf(descOf(ev))) || (ev.tags || []).some(hit)) items.push({ kind: 'Card', label: title, meta: ev.end != null ? fmtRange(ev) : fmt(ev.t), color: col(ev.color), rank: rank(title), run: () => { setSel([ev.id]); zoomToEvent(ev); } }); });
				S.eras.forEach((e) => { if (hit(e.name)) items.push({ kind: 'Era', label: e.name, meta: `${fmt(e.start)} – ${fmt(e.end)}`, color: col(e.color), rank: rank(e.name), run: () => fitRange(e.start, e.end) }); });
				host.searchNotes(q, 30).forEach((n) => items.push({ kind: 'Note', label: n.title, meta: S.events.some((e) => e.file && host.sameNote(e.file, n.link)) ? 'Linked' : 'Not on the timeline', rank: rank(n.title) + 0.5, run: () => host.openNote(n.link) }));
				items.sort((a, b) => (a.rank ?? -1) - (b.rank ?? -1));
			}
			if (!q && t == null) TIMELINE_COMMANDS.slice(0, 6).forEach((c) => items.push(cmdItem(c)));
		}
		palItems = items.slice(0, 60); palSel = 0; paintPalette();
	}
	function paintPalette() {
		setHTML(palList, palItems.length
			? palItems.map((it, i) => `<button class="pi ${i === palSel ? 'on' : ''}" data-i="${i}" role="option" aria-selected="${i === palSel}"><span class="pk">${it.kind}</span>${it.color ? `<i style="--cc:${it.color}"></i>` : ''}<span class="pl">${esc(it.label)}</span><span class="pm">${esc(it.meta || '')}</span></button>`).join('')
			: '<div class="pe">Nothing matches. Try a card title, an era, a note, or a date like 412.</div>');
		const on = q1(palList, '.on');
		if (on) on.scrollIntoView({ block: 'nearest' });
	}
	palIn.addEventListener('input', renderPalette);
	palIn.addEventListener('keydown', (e) => {
		if (e.key === 'ArrowDown') { e.preventDefault(); palSel = Math.min(palItems.length - 1, palSel + 1); paintPalette(); }
		else if (e.key === 'ArrowUp') { e.preventDefault(); palSel = Math.max(0, palSel - 1); paintPalette(); }
		else if (e.key === 'Enter') { e.preventDefault(); const it = palItems[palSel]; if (it) { closePalette(); it.run(); } }
		else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); }
	});
	palList.addEventListener('click', (e) => { const b = closest(e.target, '[data-i]'); if (!b) return; const it = palItems[+b.dataset.i]; closePalette(); it.run(); });
	pal.addEventListener('pointerdown', (e) => { if (e.target === pal) closePalette(); });

	/* ---------- minimap ----------
	   A thin strip along the edge showing the whole range: era colors, a tick per card, "now", and the part you're looking at. */
	const mm = $('minimap'), mmc = q1<HTMLCanvasElement>(mm, 'canvas'), mmBase = createEl('canvas');
	let mmKey = '', mmSize = { w: 0, h: 0 }, mmAccent = '', mmAccentEpoch = -1;
	const mmRo = new ResizeObserver(() => { mmSize = { w: mm.clientWidth, h: mm.clientHeight }; mmKey = ''; repaint(); });
	mmRo.observe(mm);
	function renderMinimap() {
		const R0 = yearStartT(S.range[0]), R1 = yearStartT(S.range[1]), vert = G.vert;
		mm.className = 'ui minimap ' + (vert ? 'mv' : 'mh');
		const { w, h } = mmSize, dpr = win().devicePixelRatio || 1;
		if (!w || !h) return;
		const W = Math.round(w * dpr), H = Math.round(h * dpr);
		if (mmc.width !== W || mmc.height !== H) { mmc.width = W; mmc.height = H; }
		const len = vert ? h : w, span = Math.max(1, R1 - R0), pos = (t: number) => { const f = ((t - R0) / span) * len; return G.rev ? len - f : f; };
		const css = (v: string) => (v.startsWith('var(') ? win().getComputedStyle(root).getPropertyValue(v.slice(4, -1)).trim() : v);
		// the whole range is drawn once into a cached layer, and redrawn only when the timeline or the size changes
		const key = [W, H, S.orientation, R0, R1, docEpoch, cssEpoch].join('|');
		if (key !== mmKey) {
			mmKey = key;
			mmBase.width = W; mmBase.height = H;
			const b = mmBase.getContext('2d'), colors = new Map<string, string>();
			const fill = (color: string) => { let v = colors.get(color); if (v == null) { v = css(color); colors.set(color, v); } return v; };
			b.setTransform(dpr, 0, 0, dpr, 0, 0);
			const rect = (a: number, z: number, x0: number, x1: number, color: string, alpha: number) => {
				b.globalAlpha = alpha; b.fillStyle = fill(color);
				const p = Math.min(pos(a), pos(z)), q = Math.abs(pos(z) - pos(a));
				if (vert) b.fillRect(x0, p, x1 - x0, Math.max(1, q)); else b.fillRect(p, x0, Math.max(1, q), x1 - x0);
			};
			const cross = vert ? w : h;
			S.eras.filter((e) => !e.parent).forEach((e) => rect(e.start, e.end, 0, cross, col(e.color), 0.28));
			S.events.forEach((e) => rect(e.t, e.end != null && !e.oe ? e.end : e.t + span / len, e.side === 'a' ? cross * 0.15 : cross * 0.55, e.side === 'a' ? cross * 0.45 : cross * 0.85, col(e.color), e.end != null ? 0.5 : 0.95));
			if (S.now != null) rect(S.now, S.now + (span / len) * 2, 0, cross, 'var(--evra-now)', 1);
		}
		const c = mmc.getContext('2d');
		c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, W, H); c.globalAlpha = 1; c.drawImage(mmBase, 0, 0);
		c.setTransform(dpr, 0, 0, dpr, 0, 0);
		if (mmAccentEpoch !== cssEpoch) { mmAccent = css('var(--evra-accent)'); mmAccentEpoch = cssEpoch; }
		c.globalAlpha = 1; c.strokeStyle = mmAccent; c.lineWidth = 1.5;
		const a = pos(V.v0), b = pos(V.v0 + G.L / V.scale), lo = clamp(Math.min(a, b), 0, len), hi = clamp(Math.max(a, b), 0, len);
		if (vert) c.strokeRect(1, lo, w - 2, Math.max(4, hi - lo)); else c.strokeRect(lo, 1, Math.max(4, hi - lo), h - 2);
		c.globalAlpha = 0.12; c.fillStyle = mmAccent;
		if (vert) c.fillRect(1, lo, w - 2, Math.max(4, hi - lo)); else c.fillRect(lo, 1, Math.max(4, hi - lo), h - 2);
		c.globalAlpha = 1;
	}
	mm.addEventListener('pointerdown', (e) => {
		e.stopPropagation(); mm.setPointerCapture(e.pointerId);
		const go = (ev: PointerEvent) => {
			const r = mm.getBoundingClientRect(), len = G.vert ? r.height : r.width, f = clamp((G.vert ? ev.clientY - r.top : ev.clientX - r.left) / len, 0, 1);
			const R0 = yearStartT(S.range[0]), R1 = yearStartT(S.range[1]), t = R0 + (G.rev ? 1 - f : f) * (R1 - R0);
			V.v0 = t - G.L / 2 / V.scale; repaint(); saveSoon();
		};
		go(e);
		const mv = (ev: PointerEvent) => go(ev), up = () => { mm.removeEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => mm.removeEventListener(t, up)); };
		mm.addEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => mm.addEventListener(t, up));
	});

	/* ---------- saved views ---------- */
	function saveView(name: string) {
		const b = snapshot();
		(S.views = S.views || []).push({ id: uid(), name: name || `View ${S.views.length + 1}`, a: tAt(G.rev ? G.L : 0), b: tAt(G.rev ? 0 : G.L), x: V.x });
		commit(b); toast(`Saved “${S.views[S.views.length - 1].name}”.`, true);
	}
	function openView(v: SavedView) { animView((v.a + v.b) / 2, G.L / Math.max(1, v.b - v.a), () => { V.x = v.x || 0; invalidate(); }); }
	function openViews(at: At) {
		const vs = S.views || [];
		openPop(at, `<div class="evra-menu views"><div class="fh"><strong>Saved views</strong></div>${vs.map((v) => `<div class="erow"><button data-v="${v.id}">${esc(v.name)}<small>${esc(fmt(v.a))} – ${esc(fmt(v.b))}</small></button><button class="ibtn" data-vdel="${v.id}" aria-label="Delete ${esc(v.name)}">${X_BTN}</button></div>`).join('') || '<p class="note">Save what you’re looking at to come back to it in one click.</p>'}
			<hr><div class="vnew"><input type="text" data-k="vname" placeholder="Name this view" aria-label="View name"><button class="btn" data-k="vsave">Save</button></div></div>`, (p) => {
			qa(p, '[data-v]').forEach((b) => (b.onclick = () => { closePop(); openView(vs.find((v) => v.id === b.dataset.v)); }));
			qa(p, '[data-vdel]').forEach((b) => (b.onclick = () => { const bf = snapshot(); S.views = vs.filter((v) => v.id !== b.dataset.vdel); commit(bf); closePop(); openViews(at); }));
			const n = q1<HTMLInputElement>(p, '[data-k=vname]'), sv = () => { saveView(n.value.trim()); closePop(); };
			q1(p, '[data-k=vsave]').onclick = sv;
			n.onkeydown = (ke) => { if (ke.key === 'Enter') sv(); };
		});
	}

	/* ---------- creating cards from notes ---------- */
	function candidates() {
		const linked = new Set(S.events.map((e) => e.file).filter(Boolean));
		// notes carrying timeline properties are ticked at first; ones with just a generic year or date (books, films…) only when there are few
		const keys = new Set(['timeline', ...Object.values(S.opts.sync.fields).map((f) => f.key.toLowerCase())].filter((k) => k.startsWith('timeline')));
		const list = host.candidateNotes(linked).map((x) => ({ link: x.link, title: x.title, t: noteDateOf(x.props, S, E), strong: Object.keys(x.props).some((k) => keys.has(k.toLowerCase())) })).filter((x) => x.t != null).sort((a, b) => a.t - b.t);
		return list.map((x) => ({ ...x, tick: x.strong || list.length <= 12 }));
	}
	function createFromNotes(list: { link: string; t: number }[]) {
		if (!list.length) return;
		const b = snapshot(), ids: string[] = [];
		list.forEach((x, i) => { const ev: EvraEvent = { id: uid(), t: x.t, side: i % 2 ? 'a' : 'b', title: '', text: '', color: null, file: x.link }; fresh.add(ev.id); S.events.push(ev); ensureRange(ev); ids.push(ev.id); });
		setSel(ids); commit(b);
		toast(`Created ${ids.length} card${ids.length === 1 ? '' : 's'} from notes.`, true);
		zoomToSelection();
	}
	// A note's year, month and day properties move its card (the span keeps its length)
	function syncFromNote(link: string) {
		const sy = S.opts.sync;
		if (!sy || !sy.on) return;
		const ev = [...S.events].sort((a, b) => a.t - b.t).find((e) => e.file && host.sameNote(e.file, link));
		if (!ev) return;
		const t = dateFromProps(host.noteProps(ev.file), S, E, ev);
		if (t == null) return;
		const before = snapshot(), dt = t - ev.t;
		ev.t = t;
		if (ev.end != null) ev.end += dt;
		ensureRange(ev); commit(before);
		toast(`Moved “${titleOf(ev)}” to ${fmt(ev.t)}`);
	}

	/* ---------- export ---------- */
	const linkOrTitle = (e: EvraEvent) => (e.file ? `[[${e.file}${host.noteTitle(e.file) !== e.file ? '|' + host.noteTitle(e.file) : ''}]]` : e.title || 'Untitled');
	function exportMarkdownTable() {
		return '| Date | Event | Side | Tags |\n|---|---|---|---|\n' + [...S.events].sort((a, b) => a.t - b.t)
			.map((e) => `| ${evDate(e)} | ${linkOrTitle(e).replace(/\|/g, '\\|')} | ${e.side === 'a' ? (G.vert ? 'Left' : 'Top') : G.vert ? 'Right' : 'Bottom'} | ${(e.tags || []).map((t) => '#' + t).join(' ')} |`).join('\n');
	}
	function exportOutline() {
		const lines = [`# ${S.name}`, ''], used = new Set<string>();
		const walk = (parent: string | null, lvl: number) => S.eras.filter((e) => (e.parent || null) === parent).sort((a, b) => a.start - b.start).forEach((e) => {
			lines.push(`${'#'.repeat(Math.min(6, lvl + 1))} ${e.name} (${fmt(e.start)} – ${fmt(e.end)})`);
			const kids = S.eras.filter((x) => x.parent === e.id);
			S.events.filter((ev) => !used.has(ev.id) && ev.t >= e.start && ev.t < e.end && !kids.some((kk) => ev.t >= kk.start && ev.t < kk.end)).sort((a, b) => a.t - b.t)
				.forEach((ev) => { used.add(ev.id); lines.push(`- ${evDate(ev)}: ${linkOrTitle(ev)}`); });
			lines.push('');
			walk(e.id, lvl + 1);
		});
		walk(null, 1);
		const rest = S.events.filter((ev) => !used.has(ev.id)).sort((a, b) => a.t - b.t);
		if (rest.length) { lines.push('## Outside any era'); rest.forEach((ev) => lines.push(`- ${evDate(ev)}: ${linkOrTitle(ev)}`)); }
		return lines.join('\n');
	}
	function embedCode() { const a = tAt(G.rev ? G.L : 0), b = tAt(G.rev ? 0 : G.L); return '```evra\ntimeline: ' + host.fileName() + '\nfrom: ' + (yearOf(a) + S.cal.yearStart) + '\nto: ' + (yearOf(b) + 1 + S.cal.yearStart) + '\n```'; }
	function copyOut(textOut: string, what: string) {
		navigator.clipboard.writeText(textOut).then(() => toast(`Copied ${what}.`), () => showCopyBox(textOut, what));
	}
	function showCopyBox(textOut: string, what: string) {
		openPop({ x: 120, y: 80 }, `<div class="evra-menu copybox"><div class="fh"><strong>${esc(what)}</strong></div><textarea readonly>${esc(textOut)}</textarea><p class="note">Select all and copy.</p></div>`, (p) => { const t = q1<HTMLTextAreaElement>(p, 'textarea'); t.focus(); t.select(); });
	}

	/* ---------- popovers ---------- */
	function openPop(at: At, html: string, bind?: (p: HTMLElement) => void, onClose?: () => void) {
		closePop();
		setHTML(pop, html);
		pop.hidden = false; popOnClose = onClose || null;
		const w = pop.offsetWidth, h = pop.offsetHeight;
		pop.setCssStyles({ left: clamp(at.x, 8, G.W - w - 8) + 'px', top: clamp(at.y, 8, G.H - h - 8) + 'px' });
		if (bind) bind(pop);
		// keyboard users land in the popover (unless it focused something itself)
		if (!pop.contains(doc().activeElement)) q1(pop, 'button, input, select, textarea')?.focus({ preventScroll: true });
	}
	function closePop() {
		if (pop.hidden) return;
		const f = popOnClose, had = pop.contains(doc().activeElement);
		popOnClose = null; pop.hidden = true; pop.empty();
		if (had) stage.focus({ preventScroll: true }); // the focus was in the popover: give it back to the timeline, so shortcuts keep working
		if (f) f();
	}
	const onDocPointer = (e: PointerEvent) => { if (!pop.hidden && !pop.contains(e.target as Node) && !closest(e.target, '[data-pop-toggle]')) closePop(); };
	const swatchRow = (cur: string | null) => `<div class="swatches" role="group" aria-label="Color">${[{ id: '', name: 'No color' }, ...S.palette].map((p) => `<button class="swb ${p.id ? '' : 'none'} ${(cur || '') === p.id ? 'on' : ''}" data-color="${p.id}" style="--cc:${p.id ? col(p.id) : 'transparent'}" title="${esc(p.name)}" aria-label="${esc(p.name)}"></button>`).join('')}<label class="swb add" title="New color preset…"><input type="color" data-newcolor value="#7c8cff" aria-label="New color preset"></label></div>`;
	// Same color behaviour for cards and eras. commitNow: record an undo step per pick (the era editor records one when it closes)
	function bindSwatches(p: HTMLElement, apply: (id: string | null) => void, commitNow: boolean) {
		const run = (fn: () => void) => { const before = commitNow ? snapshot() : null; fn(); if (commitNow) commit(before); else invalidate(); };
		qa(p, '.swb[data-color]').forEach((b) => (b.onclick = () => { run(() => apply(b.dataset.color || null)); qa(p, '.swb').forEach((x) => x.toggleClass('on', x === b)); }));
		const nc = q1<HTMLInputElement>(p, '[data-newcolor]');
		if (nc) nc.onchange = () => {
			const pre = { id: uid(), name: 'Custom ' + (S.palette.length + 1), hex: normHex(nc.value) };
			run(() => { S.palette.push(pre); apply(pre.id); });
			closePop(); toast('Added a color preset. Rename it in Settings → Colors.');
		};
	}
	function openCardMenu(ev: EvraEvent, at: At) {
		const span = ev.end != null, many = selIds().length > 1 && selIds().includes(ev.id) ? selIds().map(evById) : null;
		if (many) {
			openPop(at, `<div class="evra-menu"><div class="meta">${many.length} cards selected</div>${swatchRow(null)}<button data-m="flip">Move to other side</button><button data-m="copy">Copy <kbd>Ctrl C</kbd></button><button data-m="dup">Duplicate <kbd>Ctrl D</kbd></button><button data-m="zoom">Zoom to them <kbd>Z</kbd></button><hr><button data-m="del" class="danger">Delete ${many.length} cards <kbd>⌫</kbd></button></div>`, (p) => {
				bindSwatches(p, (id) => many.forEach((x) => (x.color = id)), true);
				const on = (m: string, fn: () => void) => { q1(p, `[data-m=${m}]`).onclick = () => { closePop(); fn(); }; };
				on('flip', () => { const b = snapshot(); many.forEach((x) => (x.side = x.side === 'a' ? 'b' : 'a')); commit(b); });
				on('copy', copySel); on('dup', duplicateSel); on('zoom', zoomToSelection); on('del', deleteSel);
			});
			return;
		}
		const U = S.cal.units;
		const circaOpts: [number, string][] = [[0, 'Exact'], [ci().avgM, '± 1 ' + U.month], [dpy(), '± 1 ' + U.year], [dpy() * 5, '± 5 ' + U.years], [dpy() * 10, '± 10 ' + U.years], [dpy() * 50, '± 50 ' + U.years], [dpy() * 100, '± 100 ' + U.years]];
		const pinTo = S.events.filter((x) => x.id !== ev.id && !dependsOn(x, ev.id)).sort((a, b) => a.t - b.t);
		openPop(at, `<div class="evra-menu">${swatchRow(ev.color)}
			${ev.file ? '' : '<button data-m="edit">Edit <kbd>↵</kbd></button>'}
			${ev.file ? '<button data-m="open">Open note</button><button data-m="unlink">Unlink note</button>' : '<button data-m="convert">Convert to note</button><button data-m="link">Link to note…</button>'}
			<div class="dl">Icon</div><div class="icons">${ICONS.map((g) => `<button data-icon="${g}" class="${ev.icon === g ? 'on' : ''}" aria-label="Icon ${g}">${g}</button>`).join('')}<button data-icon="" class="${ev.icon ? '' : 'on'}" aria-label="No icon">–</button></div>
			<div class="dl">Tags</div><input type="text" data-k="ctags" value="${esc((ev.tags || []).join(', '))}" placeholder="war, salt, river" aria-label="Tags">
			<hr>
			<button data-m="span">${span ? 'Make it a single moment' : 'Make it a span'}</button>
			${span ? `<button data-m="os">Unknown start <span>${ev.os ? '✓' : ''}</span></button><button data-m="oe">Ongoing <span>${ev.oe ? '✓' : ''}</span></button>` : ''}
			${span ? `<button data-m="life">Someone’s life <span>${ev.life ? '✓' : ''}</span></button>` : `<div class="mi"><span>Approximate</span><select data-m="circa" aria-label="How approximate">${circaOpts.map(([v, l]) => `<option value="${Math.round(v)}" ${Math.round(v) === Math.round(ev.circa || 0) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`}
			${ev.rel ? `<div class="meta">↳ ${esc(relText(ev))}</div><button data-m="unpin">Unpin from ${esc(evById(ev.rel.to) ? titleOf(evById(ev.rel.to)) : '')}</button>` : `<div class="mi"><span>Pin relative to</span><select data-m="pin" aria-label="Pin relative to"><option value="">Choose…</option>${pinTo.map((x) => `<option value="${x.id}">${esc(titleOf(x))}</option>${x.end != null ? `<option value="${x.id}:end">${esc(titleOf(x))} (its end)</option>` : ''}`).join('')}</select></div>`}
			${lives().filter((x) => x.id !== ev.id).length ? `<div class="dl">People involved</div><div class="ppl">${lives().filter((x) => x.id !== ev.id).map((x) => `<label><input type="checkbox" data-person="${x.id}" ${(ev.people || []).includes(x.id) ? 'checked' : ''}> ${esc(titleOf(x))}</label>`).join('')}</div>` : ''}
			<button data-m="flip">Move to other side</button>
			<button data-m="dup">Duplicate</button>
			<hr><button data-m="del" class="danger">Delete <kbd>⌫</kbd></button></div>`, (p) => {
			const act = (fn: () => void) => () => { const before = snapshot(); fn(); commit(before); };
			bindSwatches(p, (id) => { ev.color = id; }, true);
			qa(p, '[data-icon]').forEach((b) => (b.onclick = () => { const bf = snapshot(); if (b.dataset.icon) ev.icon = b.dataset.icon; else delete ev.icon; commit(bf); qa(p, '[data-icon]').forEach((x) => x.toggleClass('on', x === b)); }));
			const tg = q1<HTMLInputElement>(p, '[data-k=ctags]');
			const saveTags = () => { const bf = snapshot(), list = [...new Set(tg.value.split(',').map((x) => x.trim().replace(/^#/, '').replace(/\s+/g, '-')).filter(Boolean))]; if (list.length) ev.tags = list; else delete ev.tags; commit(bf); };
			tg.onchange = saveTags;
			tg.onkeydown = (ke) => { if (ke.key === 'Enter') { saveTags(); closePop(); } };
			const on = (m: string, fn: () => void) => { const b = q1(p, `[data-m=${m}]`); if (b) b.onclick = fn; };
			on('edit', () => { closePop(); startEdit(ev.id); });
			on('open', () => { closePop(); host.openNote(ev.file); });
			on('unlink', () => { closePop(); act(() => { ev.title = host.noteTitle(ev.file); const src = noteSrc(ev); if (src) ev.text = plainOf(noteExcerpt(src)); ev.file = null; })(); }); // a missing note leaves the card's own text as it was
			on('convert', () => {
				closePop();
				void host.createNote((ev.title || 'Untitled').trim(), ev.text || '').then((link) => { if (!link) return; act(() => { ev.file = link; })(); toast(`Created ${link}.md`); });
			});
			on('link', () => { closePop(); host.pickNote((link) => act(() => { ev.file = link; })()); });
			on('span', () => { closePop(); act(() => { if (span) { delete ev.end; delete ev.os; delete ev.oe; delete ev.life; } else { ev.end = yearLater(ev.t); ensureRange(ev); } })(); });
			on('os', () => { closePop(); act(() => { if (ev.os) delete ev.os; else ev.os = true; })(); });
			on('oe', () => { closePop(); act(() => { if (ev.oe) delete ev.oe; else ev.oe = true; })(); });
			on('flip', () => { closePop(); act(() => { ev.side = ev.side === 'a' ? 'b' : 'a'; })(); });
			on('life', () => { closePop(); act(() => { if (ev.life) delete ev.life; else ev.life = true; })(); });
			on('unpin', () => { closePop(); act(() => { delete ev.rel; })(); });
			const cz = q1<HTMLSelectElement>(p, '[data-m=circa]');
			if (cz) cz.onchange = () => act(() => { const v = +cz.value; if (v) ev.circa = v; else delete ev.circa; })();
			const pn = q1<HTMLSelectElement>(p, '[data-m=pin]');
			if (pn) pn.onchange = () => {
				if (!pn.value) return;
				const [to, from] = pn.value.split(':');
				closePop(); act(() => { ev.rel = { to, from: from === 'end' ? 'end' : 'start' }; })();
				toast(relText(ev) ? `Pinned: ${relText(ev)}` : 'Pinned', true);
			};
			qa<HTMLInputElement>(p, '[data-person]').forEach((c) => (c.onchange = () => act(() => {
				const set = new Set(ev.people || []);
				if (c.checked) set.add(c.dataset.person); else set.delete(c.dataset.person);
				if (set.size) ev.people = [...set]; else delete ev.people;
			})()));
			on('dup', () => {
				closePop();
				const before = snapshot(), c: EvraEvent = { ...(JSON.parse(JSON.stringify(ev)) as EvraEvent), id: uid(), t: stepT(ev.t, 1) };
				if (c.end != null) c.end += c.t - ev.t;
				fresh.add(c.id); S.events.push(c); ensureRange(c); sel = c.id; commit(before);
			});
			on('del', () => { closePop(); deleteEvent(ev.id); });
		});
	}
	function dateFields(key: string, t: number) {
		const p = parts(t), c = S.cal;
		return `<div class="dfs"><input type="number" data-d="${key}Y" value="${p.yr + c.yearStart}" aria-label="${esc(cap(c.units.year))}">${ci().M > 1 ? `<select data-d="${key}M" aria-label="${esc(cap(c.units.month))}">${c.months.map((m, i) => `<option value="${i}" ${i === p.m ? 'selected' : ''}>${esc(monthName(i))}</option>`).join('')}</select>` : ''}<input type="number" min="1" data-d="${key}D" value="${p.d + 1}" aria-label="${esc(cap(c.units.day))}"></div>`;
	}
	function readDate(p: HTMLElement, key: string): number | null {
		const y = parseInt(q1<HTMLInputElement>(p, `[data-d="${key}Y"]`).value, 10), ms = q1<HTMLSelectElement>(p, `[data-d="${key}M"]`), m = ms ? +ms.value : 0;
		const d = Math.max(1, parseInt(q1<HTMLInputElement>(p, `[data-d="${key}D"]`).value, 10) || 1);
		return isNaN(y) || Math.abs(y) > 1e9 ? null : toT(y - S.cal.yearStart, m, d - 1); // toT clamps the day to that year's real month length (keeps leap days)
	}
	function openEraEditor(id: string, at: At) {
		const e = eraById(id);
		if (!e) return;
		const dep = eraDepths()[id], before = snapshot();
		openPop(at, `<div class="evra-menu eraed"><input type="text" data-k="eraName" value="${esc(e.name)}" aria-label="Era name"><div class="meta">${dep === 1 ? 'Era' : 'Sub-era, level ' + dep}</div>
			<div class="dl">Abbreviation, for {E}</div><input type="text" data-k="eraAbbr" value="${esc(e.abbr || '')}" placeholder="${esc(eraAbbr({ name: e.name }))}" aria-label="Era abbreviation">
			<div class="dl">Starts</div>${dateFields('s', e.start)}<div class="dl">Ends</div>${dateFields('e', e.end)}
			${swatchRow(e.color)}<hr><button data-m="sub">Add a sub-era inside it</button><button data-m="del" class="danger">Delete era</button></div>`, (p) => {
			const inp = q1<HTMLInputElement>(p, '[data-k=eraName]');
			inp.focus(); inp.select();
			inp.oninput = () => { e.name = inp.value || 'Untitled era'; invalidate(); };
			const ab = q1<HTMLInputElement>(p, '[data-k=eraAbbr]');
			ab.oninput = () => { if (ab.value.trim()) e.abbr = ab.value.trim(); else delete e.abbr; invalidate(); };
			inp.onkeydown = (k) => { if (k.key === 'Enter' || k.key === 'Escape') closePop(); };
			bindSwatches(p, (c) => { e.color = c; }, false);
			// typed dates obey the same rules as dragging: inside the parent, clear of neighbours, shared edges move together
			const apply = (which: 'start' | 'end', key: string) => {
				const nt = readDate(p, key);
				if (nt == null) return;
				if (!e.parent) ensureRange({ t: nt });
				const b = startBound({ id, which, s: 0, dep }, false, null), v = clamp(nt, b.lo, b.hi);
				b.group.forEach((i) => (eraById(i)[which] = v)); b.group2.forEach((i) => (eraById(i)[b.other] = v));
				if (v !== nt) toast('Kept inside its parent era and clear of its neighbours.');
				invalidate();
				const box = createDiv();
				setHTML(box, dateFields(key, v));
				q1(p, `[data-d="${key}Y"]`).parentElement.replaceWith(box.firstElementChild);
				bindDates();
			};
			const bindDates = () => { ['s', 'e'].forEach((k) => qa(p, `[data-d^="${k}"]`).forEach((el) => (el.onchange = () => apply(k === 's' ? 'start' : 'end', k)))); };
			bindDates();
			q1(p, '[data-m=sub]').onclick = () => { // fill the biggest gap inside it that no sub-era covers yet
				commit(before); popOnClose = null; closePop();
				const kids = S.eras.filter((x) => x.parent === id).sort((x, y) => x.start - y.start);
				let best: [number, number] = null, cur = e.start;
				[...kids, { start: e.end, end: e.end }].forEach((k) => { if (k.start - cur > (best ? best[1] - best[0] : 0)) best = [cur, k.start]; cur = Math.max(cur, k.end); });
				if (!best || best[1] - best[0] < 1) { toast(`“${e.name}” is already full of sub-eras. Shrink one first.`); return; }
				const bf = snapshot(), era: Era = { id: uid(), parent: id, name: 'New sub-era', start: best[0], end: best[1], color: S.palette.find((p_) => p_.id !== e.color)?.id || null };
				S.eras.push(era); commit(bf); fitRange(e.start, e.end); openEraEditor(era.id, at);
			};
			q1(p, '[data-m=del]').onclick = () => {
				const kids = S.eras.filter((x) => x.parent === id).length;
				S.eras.forEach((x) => { if (x.parent === id) x.parent = e.parent; });
				S.eras = S.eras.filter((x) => x.id !== id);
				popOnClose = null; closePop(); commit(before);
				toast(kids ? 'Era deleted. Its sub-eras moved up a level.' : 'Era deleted.', true);
			};
		}, () => commit(before));
	}
	function eraHome(a: number, b: number) { // where createEra would put an era for [a, b]: its parent, or null for the top level
		let pid: string = null;
		const mid = (a + b) / 2;
		for (let g = 0; g < 64; g++) { const inside = S.eras.find((x) => x.parent === pid && x.start <= mid && x.end > mid); if (!inside) break; pid = inside.id; }
		return pid ? eraById(pid) : null;
	}
	function openCreatePop(at: At, a: number, b: number) {
		const home = eraHome(a, b);
		openPop(at, `<div class="evra-menu"><div class="meta">${esc(fmt(a))} – ${esc(fmt(b))}</div><button data-m="era">${home ? `New sub-era of “${esc(home.name)}”` : 'New era'}</button><button data-m="span">New span</button></div>`, (p) => {
			q1(p, '[data-m=era]').onclick = () => { closePop(); const era = createEra(a, b); if (era) openEraEditor(era.id, at); };
			q1(p, '[data-m=span]').onclick = () => {
				closePop();
				const before = snapshot(), side: Side = S.events.filter((x) => x.side === 'a').length < S.events.filter((x) => x.side === 'b').length ? 'a' : 'b';
				const ev: EvraEvent = { id: uid(), t: a, end: b, side, title: 'New span', text: '', color: null, file: null };
				fresh.add(ev.id); S.events.push(ev); sel = ev.id; commit(before);
				raf(() => startEdit(ev.id));
			};
		});
	}
	function setOrientation(o: Orientation) {
		const span = G.L / V.scale, tc = V.v0 + span / 2, before = snapshot();
		noAnim = true; V.x = 0; S.orientation = o; G = geo(); lastL = G.L; V.scale = G.L / span; V.v0 = tc - span / 2;
		commit(before); saveSoon();
	}
	function openHelp(at: At) {
		const rows = [['Double-click', 'Edit a card, or add one on empty space'], ['Drag the line', 'Select a stretch of time for an era or span'], ['Drag a card', 'Change its date; across the line to switch sides'],
			['Drag a dot', 'Pull a moment into a span, or resize a span'], ['Drag an era edge', 'Anywhere across the timeline. Alt splits shared edges'], ['Shift + click · Shift + drag', 'Select several cards'],
			['Right-click', 'Card options, or add, paste and fit eras here'], ['Ctrl/⌘ K  ·  /', 'Search, or type a date to jump there'], ['Ctrl/⌘ P', 'All commands (search “Evra”)'],
			['J · K', 'Next or previous card'], ['E · ↵', 'Edit (↵ in a description saves and starts the next card)'], ['S · L', 'Make a span · link or options'], ['0 – 9', 'Color preset (0 clears)'],
			['↑ ↓ ← →', 'Nudge, or switch sides'], ['Ctrl/⌘ C · V · D', 'Copy, paste at the pointer, duplicate'], ['Ctrl/⌘ A · ⌫', 'Select all · delete'], ['N · G · Z · F', 'New card · go to date · zoom to selection · fit all'], ['Ctrl/⌘ Z', 'Undo (Shift to redo)']];
		openPop(at, `<div class="evra-help"><h4>Using the timeline</h4><dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`);
	}
	$('ctrls').addEventListener('click', (e) => {
		const b = closest(e.target, '[data-c]');
		if (!b) return;
		const c = b.dataset.c, r = b.getBoundingClientRect(), sr = stage.getBoundingClientRect(), at = { x: r.left - sr.left - 310, y: r.top - sr.top - 200 };
		if (c === 'in') ACTIONS['zoom-in']();
		if (c === 'out') ACTIONS['zoom-out']();
		if (c === 'fit') fitAll();
		if (c === 'views') { if (!pop.hidden) closePop(); else openViews({ x: r.left - sr.left - 290, y: Math.max(8, r.top - sr.top - 120) }); }
		if (c === 'filter') { if (!pop.hidden) closePop(); else openFilter({ x: r.left - sr.left - 300, y: Math.max(8, r.top - sr.top - 300) }); }
		if (c === 'orient') { const order: Orientation[] = ['ttb', 'ltr', 'btt', 'rtl'], o = order[(order.indexOf(S.orientation) + 1) % 4]; setOrientation(o); toast(ORIENT[o].label); }
		if (c === 'settings') { if (sheet.hidden) openSheet(); else closeSheet(); }
		if (c === 'help') { if (!pop.hidden) closePop(); else openHelp(at); }
	});
	$('crumb').addEventListener('click', (e) => {
		const sb = closest(e.target, '[data-sib]');
		if (sb) {
			const me = eraById(sb.dataset.sib), sibs = S.eras.filter((x) => x.parent === me.parent).sort((a, b) => a.start - b.start), r = sb.getBoundingClientRect(), sr = stage.getBoundingClientRect();
			openPop({ x: r.left - sr.left - 20, y: r.bottom - sr.top + 6 }, `<div class="evra-menu">${sibs.map((x) => `<div class="erow"><button data-go="${x.id}"><i style="--cc:${col(x.color)}"></i>${esc(x.name)}${x.id === me.id ? ' ·' : ''}</button></div>`).join('')}</div>`,
				(p) => qa(p, '[data-go]').forEach((b) => (b.onclick = () => { closePop(); const x = eraById(b.dataset.go); fitRange(x.start, x.end); })));
			return;
		}
		const b = closest(e.target, '[data-era]');
		if (b) { const era = eraById(b.dataset.era); fitRange(era.start, era.end); }
	});
	$('extS').onclick = () => { const before = snapshot(); S.range[0] -= 10; commit(before); };
	$('extE').onclick = () => { const before = snapshot(); S.range[1] += 10; commit(before); };
	$('xthumb').addEventListener('pointerdown', (e) => {
		e.stopPropagation();
		const th = e.currentTarget as HTMLElement, start = G.vert ? e.clientX : e.clientY, x0 = V.x, C = G.C - 28;
		const tl = G.vert ? th.offsetWidth : th.offsetHeight, kk = (V.xmax - V.xmin) / Math.max(1, C - tl);
		th.setPointerCapture(e.pointerId);
		const mv = (m: PointerEvent) => { V.x = x0 + ((G.vert ? m.clientX : m.clientY) - start) * kk; repaint(); };
		const up = () => { th.removeEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => th.removeEventListener(t, up)); saveSoon(); };
		th.addEventListener('pointermove', mv); ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => th.addEventListener(t, up));
	});
	function toast(msg: string, canUndo?: boolean) {
		const t = $('toast');
		setHTML(t, `<span>${esc(msg)}</span>${canUndo ? '<button type="button">Undo</button>' : ''}`);
		t.hidden = false; t.toggleClass('act', !!canUndo);
		if (canUndo) q1(t, 'button').onclick = () => { t.hidden = true; undo(); };
		win().clearTimeout(toastT);
		toastT = later(() => (t.hidden = true), canUndo ? 5000 : 2200);
	}

	/* ---------- keyboard: only while the timeline has focus ---------- */
	root.addEventListener('keydown', (e) => {
		if (!pal.hidden || e.defaultPrevented) return;
		if (!pop.hidden && pop.contains(e.target as Node)) { // inside a menu: arrows move between its controls, and Escape closes it
			if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); return; }
			const tag = (e.target as HTMLElement).tagName;
			if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && tag !== 'SELECT' && tag !== 'TEXTAREA') {
				e.preventDefault(); e.stopPropagation();
				const all = qa(pop, 'button:not([disabled]), input, select, textarea'), i = all.indexOf(e.target as HTMLElement);
				all[(i + (e.key === 'ArrowDown' ? 1 : all.length - 1)) % all.length]?.focus();
			}
			return;
		}
		const tg = e.target as HTMLElement, typing = tg.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(tg.tagName), mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
		const done = () => { e.preventDefault(); e.stopPropagation(); };
		if (mod && k === 'k' && !e.shiftKey && !e.altKey) { done(); openPalette(''); return; }
		if (typing) return;
		if (mod && k === 'z') { done(); if (e.shiftKey) redoF(); else undo(); return; }
		if (mod && k === 'y') { done(); redoF(); return; }
		if (mod && k === 'a') { done(); selectAll(); return; }
		if (mod && k === 'c') { if (selIds().length) { e.stopPropagation(); copySel(); } return; }
		if (mod && k === 'v') { done(); pasteClip(lastPointerT); return; }
		if (mod && k === 'd') { done(); duplicateSel(); return; }
		if (mod || e.altKey && !/^Arrow/.test(e.key)) return;
		if (e.key === 'Escape') { if (!pop.hidden || sel) { e.stopPropagation(); closePop(); setSel([]); } else if (!sheet.hidden) { e.stopPropagation(); closeSheet(); } return; }
		if (e.key === '/') { done(); openPalette(''); return; }
		if (e.key === '?') { done(); openHelp({ x: G.W - 340, y: 60 }); return; }
		if (k === 'g') { done(); ACTIONS['go-to-date'](); return; }
		if (k === 'f') { done(); fitAll(); return; }
		if (e.key === '.') { done(); goToNow(); return; }
		if (k === 'b') { done(); openViews({ x: G.W - 340, y: 80 }); return; }
		if (k === 'n') { done(); addEvent(snap(lastPointerT != null ? lastPointerT : tAt(G.L / 2)), 'b'); return; }
		if (k === 'j') { done(); stepSel(1); return; }
		if (k === 'k') { done(); stepSel(-1); return; }
		if (e.key === '+' || e.key === '=') { done(); ACTIONS['zoom-in'](); return; }
		if (e.key === '-') { done(); ACTIONS['zoom-out'](); return; }
		const ev = sel && evById(sel);
		if (!ev) return;
		if (k === 'z') { done(); zoomToSelection(); return; }
		if (e.key === 'Delete' || e.key === 'Backspace') { done(); deleteSel(); return; }
		if (e.key === 'Enter' || k === 'e') { done(); startEdit(ev.id); return; }
		if (k === 's') { done(); toggleSpanSel(); return; }
		if (k === 'l') { done(); const el = cardEls.get(ev.id), r = el ? el.getBoundingClientRect() : null, sr = stage.getBoundingClientRect(); openCardMenu(ev, r ? { x: r.left - sr.left, y: r.bottom - sr.top + 4 } : { x: 80, y: 80 }); return; }
		if (/^[0-9]$/.test(e.key)) { done(); colorSel(+e.key); return; }
		const along: Record<string, number> = G.vert ? { ArrowDown: 1, ArrowUp: -1 } : { ArrowRight: 1, ArrowLeft: -1 };
		const across: Record<string, Side> = G.vert ? { ArrowLeft: 'a', ArrowRight: 'b' } : { ArrowUp: 'a', ArrowDown: 'b' };
		if (along[e.key]) { done(); nudgeSel(along[e.key] * (G.rev ? -1 : 1), e.altKey); }
		else if (across[e.key]) { done(); const before = snapshot(); selIds().forEach((id) => (evById(id).side = across[e.key])); commit(before); }
	});

	/* ---------- start ---------- */
	const ro = new ResizeObserver(() => { stageRect = null; stageSize = null; noAnim = true; invalidate(); });
	ro.observe(stage);
	listen(doc(), 'pointerdown', onDocPointer, true);
	// The first frame with a size decides the starting view: the workspace's saved view, the file's, or everything
	function start() {
		started = true; lastL = G.L;
		if (savedView && savedView.scale) { V.v0 = savedView.v0; V.scale = savedView.scale; V.x = savedView.x || 0; }
		else if (S.lastView) { V.scale = fitScale(S.lastView[0], S.lastView[1]); V.v0 = (S.lastView[0] + S.lastView[1]) / 2 - G.L / 2 / V.scale; }
		else fitAll(true);
	}
	invalidate();

	return {
		setDoc(d: EvraDoc) {
			if (JSON.stringify(d) === snapshot()) return;
			const first = !started;
			S = d; E.reset(); docEpoch++;
			if (sel && !evById(sel)) sel = null;
			if (editing && !evById(editing)) { editing = null; editEl = null; }
			hist = []; redo = []; onUndoChange();
			noAnim = true; tagKey = ''; crumbKey = '';
			if (!sheet.hidden) renderSheet();
			if (first) started = false;
			invalidate();
		},
		getDoc: () => S,
		run(id: string) { const f = ACTIONS[id]; if (f && G) { root.focus(); f(); } },
		undo, redo: redoF,
		canUndo: () => hist.length > 0,
		canRedo: () => redo.length > 0,
		getViewState: () => (started ? { v0: V.v0, scale: V.scale, x: V.x } : savedView),
		setViewState(v: ViewState) {
			if (!v || !(v.scale > 0)) return;
			savedView = v;
			if (started) { V.v0 = v.v0; V.scale = v.scale; V.x = v.x || 0; invalidate(); }
		},
		focusEvent(id: string) {
			const ev = evById(id);
			if (!ev) return;
			const go = () => { setSel([ev.id]); zoomToEvent(ev); };
			if (started) go(); else raf(() => raf(go));
		},
		notesChanged() { invalidate(); },
		noteChanged(link: string) { noteCache.delete(link); linkSets.delete(link); syncFromNote(link); invalidate(); },
		cssChanged() { cssEpoch++; measureFont = ''; family = ''; serif = ''; measureCache.clear(); tagKey = ''; if (!sheet.hidden) renderSheet(); invalidate(); },
		focus() { if (!root.contains(doc().activeElement)) stage.focus({ preventScroll: true }); },
		flush() { if (editing) finishEdit(true); },
		relinkHistory(from: string[], to: string) {
			const fix = (json: string) => {
				if (!from.some((f) => json.includes(JSON.stringify(f)))) return json;
				const d = JSON.parse(json) as EvraDoc;
				d.events.forEach((e) => { if (e.file && from.includes(e.file)) e.file = to; });
				return JSON.stringify(d);
			};
			hist = hist.map(fix); redo = redo.map(fix);
		},
		destroy() {
			destroyed = true;
			if (editing) finishEdit(true);
			win().cancelAnimationFrame(rafId); win().cancelAnimationFrame(animId);
			[toastT, flashT, viewSaveT, peekT, groupClickT].forEach((t) => win().clearTimeout(t));
			ro.disconnect(); mmRo.disconnect();
			cleanups.forEach((f) => f());
			root.empty();
		},
	};
}
