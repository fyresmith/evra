import { clamp, DEFAULT_FMT, makeEngine, str, uid } from './engine';
import type { Calendar, ColorPreset, Era, EvraDoc, EvraEvent, Formats, LeapRule, Month, Opts, SecondCalendar, SyncField, SyncKey, SyncOpts, TimelineDefaults, Units } from './types';

/* Creating, upgrading and checking timeline documents. */

// Color presets. The six built-ins follow the light or dark theme until you give them a hex of your own.
export const defaultPalette = (): ColorPreset[] =>
	[['1', 'Red'], ['2', 'Orange'], ['3', 'Yellow'], ['4', 'Green'], ['5', 'Cyan'], ['6', 'Purple']].map(([id, name]): ColorPreset => ({ id, name, hex: null }));

export const SYNC_FIELDS: [SyncKey, string, string, boolean][] = [
	['date', 'Date', 'timeline-date', true], ['year', 'Year', 'timeline-year', true], ['month', 'Month', 'timeline-month', true],
	['day', 'Day', 'timeline-day', false], ['end', 'End date (spans)', 'timeline-end', false], ['era', 'Era', 'timeline-era', true],
	['subera', 'Sub-era', 'timeline-sub-era', false], ['eras', 'All eras, as a list', 'timeline-eras', false], ['timeline', 'Timeline name', 'timeline', false],
];
export const defaultSync = (): SyncOpts => ({
	on: false,
	fields: Object.fromEntries(SYNC_FIELDS.map(([k, , key, on]) => [k, { on, key }])) as SyncOpts['fields'],
	written: [],
	notes: [],
});

export const DEFAULT_OPTS: Omit<Opts, 'sync'> = { spanStyle: 'threads', groupOver: 3, snapTo: 'auto', bands: true, subLabels: true, cardLines: 99, tint: true, v: 2 };
export const DEFAULT_UNITS = { day: 'day', month: 'month', year: 'year', years: 'years' };

const int = (v: unknown, dflt: number): number => { const n = parseInt(str(v), 10); return isNaN(n) ? dflt : n; };
/** Dates are day counts; anything this far out (about 2.7 trillion years) is a typo or a broken file, and the date maths can't stay exact past it. */
export const DAY_LIMIT = 1e15;
/** A usable day count: a finite number within DAY_LIMIT. */
export const okDay = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < DAY_LIMIT;

/** Older or hand-written calendars, before months had their own lengths. */
interface RawCal extends Partial<Omit<Calendar, 'months' | 'leaps'>> {
	months?: (Month | string)[];
	leaps?: Partial<LeapRule>[];
	dpm?: number; mpy?: number; prefix?: string; suffix?: string; unit?: string;
}

type Loose = Record<string, unknown>;
/** A plain object (not an array). */
const isObj = (v: unknown): v is Loose => !!v && typeof v === 'object' && !Array.isArray(v);
/** A whole number from a number or numeric text, kept within lo..hi; dflt when there's none. */
const num = (v: unknown, dflt: number, lo: number, hi: number): number => { const n = int(v, dflt); return Number.isFinite(n) ? clamp(n, lo, hi) : dflt; };
/** An id from a string or number, or a new one. */
const idOf = (v: unknown): string => (typeof v === 'string' && v ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : uid());
/** Ids, each one unique: a repeat (5 and "5" count as the same) gets a fresh id; references to it keep meaning the first. */
const uniqueIds = () => { const seen = new Set<string>(); return (v: unknown): string => { let id = idOf(v); while (seen.has(id)) id = uid(); seen.add(id); return id; }; };
const text = (v: unknown, dflt: string): string => (typeof v === 'string' ? v : dflt);
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT_SECOND:SecondCalendar = { on: false, name: 'Second calendar', yearDays: 400, offset: 0, fmt: '{Y} SR', onCards: true };

export function normCal(raw: unknown): Calendar {
	const c = (isObj(raw) ? raw : {}) as RawCal;
	const prefix = text(c.prefix, ''), suffix = text(c.suffix, '');
	if (!Array.isArray(c.months) || typeof c.months[0] === 'string' || c.dpm) {
		const names = (Array.isArray(c.months) ? c.months : []) as unknown[];
		const n = num(c.mpy, 0, 0, 1000) || Math.min(names.length, 1000) || 12, dpm = Math.max(1, num(c.dpm, 30, -1e6, 1e6) || 30);
		c.months = Array.from({ length: n }, (_, i) => ({ id: uid(), name: typeof names[i] === 'string' ? names[i] : '', days: dpm }));
	}
	let months = (c.months as Month[]).filter((m) => isObj(m));
	if (!months.length) months = [{ id: uid(), name: '', days: 360 }];
	months.forEach((m) => { m.id = idOf(m.id); m.days = Math.max(1, num(m.days, 30, -1e6, 1e6) || 30); m.name = str(m.name); m.inter = !!m.inter; });
	if (!isObj(c.units)) { const u = (prefix || 'year').toLowerCase(); c.units = { day: 'day', month: 'month', year: u, years: u + 's' }; }
	const units = { ...DEFAULT_UNITS, ...c.units } as Units & Loose;
	for (const k of Object.keys(DEFAULT_UNITS) as (keyof Units)[]) if (typeof units[k] !== 'string') units[k] = DEFAULT_UNITS[k];
	if (!isObj(c.fmt)) c.fmt = { year: [prefix ? '{U}' : '', '{Y}', suffix].filter(Boolean).join(' ') } as Calendar['fmt'];
	const fmt = { ...DEFAULT_FMT, ...c.fmt } as Formats & Loose;
	for (const k of Object.keys(DEFAULT_FMT) as (keyof Formats)[]) if (typeof fmt[k] !== typeof DEFAULT_FMT[k]) (fmt as Loose)[k] = DEFAULT_FMT[k];
	const s2 = { ...DEFAULT_SECOND, ...(isObj(c.second) ? c.second : {}) } as SecondCalendar & Loose;
	s2.on = bool(s2.on, false); s2.name = text(s2.name, DEFAULT_SECOND.name); s2.fmt = text(s2.fmt, DEFAULT_SECOND.fmt); s2.onCards = bool(s2.onCards, true);
	if (!(okDay(s2.yearDays) && s2.yearDays > 0)) s2.yearDays = DEFAULT_SECOND.yearDays;
	if (!okDay(s2.offset)) s2.offset = 0;
	const cal: Calendar = {
		months,
		units,
		fmt,
		yearStart: num(c.yearStart, 0, -1e12, 1e12),
		leaps: (Array.isArray(c.leaps) ? c.leaps : []).filter((r) => isObj(r) && (typeof r.month === 'string' || typeof r.month === 'number') && r.month !== '').map((r) => ({
			...r, id: idOf(r.id), month: String(r.month), days: num(r.days, 1, -1e6, 1e6) || 1, every: Math.max(1, num(r.every, 4, -1e9, 1e9) || 4),
			except: num(r.except, 0, 0, 1e9), unless: num(r.unless, 0, 0, 1e9), off: num(r.off, 0, -1e9, 1e9),
		})).filter((r) => months.some((m) => m.id === r.month)), // a rule for a month that's gone would otherwise show on the wrong one
		weekdays: Array.isArray(c.weekdays) ? c.weekdays.map((w) => str(w)) : [],
		weekStart: num(c.weekStart, 0, -1e9, 1e9),
		eraBase: c.eraBase === 0 ? 0 : 1,
		second: s2,
	};
	// keep the same object, so anything holding the calendar sees the update; unknown fields are kept
	for (const k of ['dpm', 'mpy', 'prefix', 'suffix', 'unit']) delete (c as Record<string, unknown>)[k];
	return Object.assign(c as unknown as Calendar, cal);
}

/** A color preset id, or null. */
const colorOf = (v: unknown): string | null => (typeof v === 'string' ? v : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);

/** Parents must be other eras that exist, and no era may be its own ancestor: a cycle is broken at the era that closes it. */
function fixEraParents(eras: Era[]): void {
	const by = new Map(eras.map((e) => [e.id, e]));
	eras.forEach((e) => { if (e.parent != null && (e.parent === e.id || !by.has(e.parent))) e.parent = null; });
	const done = new Set<string>();
	for (const e of eras) {
		const path = new Set<string>();
		let p = e;
		while (p && p.parent != null && !done.has(p.id)) {
			path.add(p.id);
			const up = by.get(p.parent);
			if (path.has(up.id)) { p.parent = null; break; }
			p = up;
		}
		path.forEach((id) => done.add(id));
	}
}

/** The range in years: two whole numbers, end after start. Otherwise years 0 to 10, widened to hold every event and era. */
function normRange(d: EvraDoc): [number, number] {
	const E = makeEngine(() => d), lim = DAY_LIMIT / Math.max(1, E.dpy());
	const r = Array.isArray(d.range) && d.range.length === 2 ? d.range.map((x) => (typeof x === 'number' && Number.isFinite(x) ? Math.round(x) : NaN)) : [];
	if (r.length === 2 && Math.abs(r[0]) < lim && Math.abs(r[1]) < lim && r[1] > r[0]) return [r[0], r[1]];
	let a = E.yearStartT(0), b = E.yearStartT(10);
	d.events.forEach((e) => { a = Math.min(a, e.t); b = Math.max(b, e.end ?? e.t); });
	d.eras.forEach((e) => { a = Math.min(a, e.start); b = Math.max(b, e.end); });
	const y0 = E.yearOf(a), y1 = E.yearOf(b);
	return [y0, Math.max(y0 + 1, E.yearStartT(y1) === b ? y1 : y1 + 1)];
}

/** Fill in anything a document is missing, so older and hand-edited files open. */
export function normDoc(raw: unknown, fallbackName = 'Untitled'): EvraDoc {
	const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<EvraDoc>;
	const palette = (Array.isArray(d.palette) ? d.palette : []).filter((p) => isObj(p) && (typeof p.id === 'string' || typeof p.id === 'number') && p.id !== '')
		.map((p): ColorPreset => ({ ...p, id: String(p.id), name: text(p.name, typeof p.name === 'number' ? String(p.name) : 'Untitled color'), hex: typeof p.hex === 'string' && HEX.test(p.hex) ? p.hex : null }));
	d.palette = palette.length ? palette : defaultPalette();
	d.cal = normCal(d.cal);
	const o = (isObj(d.opts) ? d.opts : {}) as Partial<Opts>;
	const ds = defaultSync(), sy = (isObj(o.sync) ? o.sync : {}) as Partial<SyncOpts>;
	const fields = { ...ds.fields, ...(isObj(sy.fields) ? sy.fields : {}) } as Record<string, unknown>;
	for (const k of Object.keys(fields)) {
		const f = fields[k], dflt = (ds.fields as Record<string, SyncField>)[k];
		if (!isObj(f)) { if (dflt) fields[k] = dflt; else delete fields[k]; continue; }
		const key = typeof f.key === 'string' ? f.key : dflt ? dflt.key : null;
		if (key == null) { delete fields[k]; continue; }
		fields[k] = { ...f, on: bool(f.on, dflt ? dflt.on : false), key };
	}
	const strs = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
	o.sync = { ...ds, ...sy, on: bool(sy.on, false), fields: fields as SyncOpts['fields'], written: strs(sy.written), notes: strs(sy.notes) };
	if (o.v !== 2) { o.cardLines = 99; o.v = 2; }
	const count = (v: unknown, dflt: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(v, 1e6) : dflt);
	o.cardLines = count(o.cardLines, DEFAULT_OPTS.cardLines);
	o.groupOver = count(o.groupOver, DEFAULT_OPTS.groupOver);
	if (!['threads', 'blocks'].includes(o.spanStyle)) o.spanStyle = DEFAULT_OPTS.spanStyle;
	if (!['auto', 'd', 'm', 'y'].includes(o.snapTo)) o.snapTo = DEFAULT_OPTS.snapTo;
	for (const k of ['bands', 'subLabels', 'tint'] as const) o[k] = bool(o[k], DEFAULT_OPTS[k]);
	if ('fadeFuture' in o && typeof o.fadeFuture !== 'boolean') delete o.fadeFuture;
	d.opts = { ...DEFAULT_OPTS, ...o } as Opts;
	d.name = typeof d.name === 'string' ? d.name : fallbackName;
	if (!['ttb', 'btt', 'ltr', 'rtl'].includes(d.orientation)) d.orientation = 'ttb';
	d.cardWidth = clamp(int(d.cardWidth, 240) || 240, 160, 360); // the card-width slider's range
	const eraId = uniqueIds(), evId = uniqueIds();
	d.eras = (Array.isArray(d.eras) ? d.eras : []).filter((e) => isObj(e) && okDay(e.start) && okDay(e.end))
		.map((e): Era => {
			const x: Era = { ...e, id: eraId(e.id), parent: typeof e.parent === 'string' || typeof e.parent === 'number' ? String(e.parent) : null, name: str(e.name) || (typeof e.name === 'string' ? '' : 'Untitled era'), color: colorOf(e.color) };
			if (x.end < x.start) [x.start, x.end] = [x.end, x.start];
			if ('abbr' in x && typeof x.abbr !== 'string') delete x.abbr;
			return x;
		})
		.filter((e) => e.end > e.start);
	fixEraParents(d.eras);
	d.events = (Array.isArray(d.events) ? d.events : []).filter((e) => isObj(e) && okDay(e.t))
		.map((e): EvraEvent => ({ ...e, id: evId(e.id), side: e.side === 'a' ? 'a' : 'b', title: str(e.title), text: str(e.text), color: colorOf(e.color), file: typeof e.file === 'string' ? e.file : null }));
	d.events.forEach((e) => {
		if ('end' in e && !(okDay(e.end) && e.end > e.t)) delete e.end; // a span that ends where it starts, or before, is a moment
		for (const k of ['os', 'oe', 'life'] as const) if (k in e && typeof e[k] !== 'boolean') delete e[k];
		if ('icon' in e && typeof e.icon !== 'string') delete e.icon;
		for (const k of ['tags', 'people'] as const) {
			if (!(k in e)) continue;
			if (Array.isArray(e[k])) e[k] = e[k].filter((x) => typeof x === 'string'); else delete e[k];
		}
		if ('circa' in e && !(okDay(e.circa) && e.circa > 0)) delete e.circa;
		if ('rel' in e) {
			const r = e.rel as unknown;
			if (!isObj(r) || typeof r.to !== 'string' || (r.from !== 'start' && r.from !== 'end')) delete e.rel;
			else { if ('offset' in r && !okDay(r.offset)) delete r.offset; if ('at' in r && !okDay(r.at)) delete r.at; }
		}
	});
	if ('now' in d && d.now !== null && !okDay(d.now)) d.now = null;
	if (!Array.isArray(d.views)) delete d.views;
	else d.views = d.views.filter((v) => v && typeof v === 'object' && okDay(v.a) && okDay(v.b));
	if ('lastView' in d && !(Array.isArray(d.lastView) && d.lastView.length === 2 && okDay(d.lastView[0]) && okDay(d.lastView[1]))) delete d.lastView;
	if ('forkAt' in d && !okDay(d.forkAt)) delete d.forkAt;
	d.range = normRange(d as EvraDoc);
	d.format = 'evra';
	d.version = 1;
	return d as EvraDoc;
}

export function defaultCal(): Calendar {
	return normCal({ dpm: 30, mpy: 12, months: ['Thaw', 'Seedfall', 'Bloom', 'Greening', 'Highsun', 'Longday', 'Ember', 'Harvest', 'Fading', 'Frost', 'Deepnight', 'Stillwater'], prefix: 'Year', suffix: '' });
}

/** A new, empty timeline: ten years to start, using the saved defaults if there are any. */
export function emptyDoc(name: string, defaults?: TimelineDefaults | null): EvraDoc {
	const d = defaults ? (JSON.parse(JSON.stringify(defaults)) as TimelineDefaults) : null;
	return normDoc({ name, cal: d ? d.cal : defaultCal(), palette: d ? d.palette : undefined, opts: d ? d.opts : undefined, range: [0, 10], orientation: d ? d.orientation : 'ttb', cardWidth: d ? d.cardWidth : 240, eras: [], events: [] }, name);
}

/* ---------- presets ---------- */
export const PRESETS: Record<string, { label: string; months: [string, number][]; leap?: { month: number; every: number; except: number; unless: number }; weekdays?: string[] }> = {
	twelve: { label: 'Twelve months of 30 days', months: ['Thaw', 'Seedfall', 'Bloom', 'Greening', 'Highsun', 'Longday', 'Ember', 'Harvest', 'Fading', 'Frost', 'Deepnight', 'Stillwater'].map((n): [string, number] => [n, 30]) },
	gregorian: { label: 'Gregorian, with leap years and weekdays', months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]], leap: { month: 1, every: 4, except: 100, unless: 400 }, weekdays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] },
	earth: { label: 'Earth-like (365 days)', months: [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]] },
	moons: { label: 'Thirteen moons of 28 days', months: ['Wolf', 'Snow', 'Worm', 'Seed', 'Flower', 'Rose', 'Thunder', 'Grain', 'Harvest', 'Hunter', 'Frost', 'Long Night', 'Ice'].map((n): [string, number] => [n + ' Moon', 28]) },
	seasons: { label: 'Four seasons of 91 days', months: [['Spring', 91], ['Summer', 91], ['Autumn', 91], ['Winter', 91]] },
	years: { label: 'Years only, no months', months: [['', 365]] },
};

/* ---------- calendar import (Calendarium, Fantasy-Calendar) ---------- */
function leapFromIntervals(list: { n: number; ex: boolean }[]) { // [{n, ex}] -> every / except / unless
	const nums = list.filter((x) => x.n > 0).sort((a, b) => a.n - b.n), every = nums.find((x) => !x.ex);
	const except = nums.find((x) => x.ex && (!every || x.n > every.n)), unless = except && nums.find((x) => !x.ex && x.n > except.n);
	return every ? { every: every.n, except: except ? except.n : 0, unless: unless ? unless.n : 0 } : null;
}
type Json = Record<string, unknown>;
const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : null);
/** Months, leap days and weekdays from a Calendarium or Fantasy-Calendar export, or an error message. */
export function parseCalendarImport(txt: string): { months: Month[]; leaps: LeapRule[]; weekdays: string[] } | string {
	let o: unknown;
	try { o = JSON.parse(txt); } catch { return 'That isn’t valid JSON.'; }
	try { return readCalendarImport(o); } catch { return 'Couldn’t read that calendar.'; }
}
// Exports vary a lot, so every list may be missing, a lone value or hold nulls: take only what looks right
function readCalendarImport(o: unknown): { months: Month[]; leaps: LeapRule[]; weekdays: string[] } | string {
	const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
	if (Array.isArray(o)) o = o[0];
	let j = obj(o);
	if (j && Array.isArray(j.calendars)) j = obj(j.calendars[0]);
	if (j && j.data && !j.static && !j.static_data) j = obj(j.data);
	const sd = j && obj(j.static_data);
	const st = j && (obj(j.static) || (sd && obj(sd.year_data)) || sd);
	if (!st) return 'Couldn’t find a calendar in that file. Paste a Calendarium or Fantasy-Calendar export.';
	const src = arr(st.months ?? st.timespans).map(obj).filter(Boolean);
	if (!src.length) return 'That calendar has no months.';
	const months: Month[] = src.map((m) => ({ id: uid(), name: str(m.name), days: Math.max(1, int(m.length ?? m.days, 1) || 1), inter: /intercalary/i.test(str(m.type)) }));
	const leapSrc = arr(st.leapDays ?? st.leap_days ?? (sd && sd.leap_days)).map(obj).filter(Boolean);
	const leaps: LeapRule[] = leapSrc.map((l) => {
		const v = l.interval;
		const iv = typeof v === 'string'
			? v.split(',').map((x) => ({ n: parseInt(x.replace(/[!+]/g, ''), 10), ex: x.trim().startsWith('!') }))
			: typeof v === 'number' ? [{ n: v, ex: false }]
				: arr(v).map((x) => ({ n: int(obj(x) ? obj(x).interval : x, 0), ex: !!(obj(x) && obj(x).exclusive) }));
		const rule = leapFromIntervals(iv), mi = int(l.timespan ?? l.month ?? 0, 0);
		return rule && months[mi] ? { id: uid(), month: months[mi].id, days: 1, off: int(l.offset, 0), ...rule } : null;
	}).filter(Boolean);
	const weekdays = arr(st.weekdays ?? st.global_week).map((w) => (typeof w === 'string' ? w : obj(w) ? str(obj(w).name) : '')).filter(Boolean);
	return { months, leaps, weekdays };
}

/* ---------- the sample world ---------- */
const D = (y: number, m = 0, d = 0) => y * 360 + m * 30 + d;
export const SAMPLE_NOTES: Record<string, string> = {
	'Veld': 'River city at the mouth of the Sallow, built on salt and fish. Founded by the fisher-clans in Year 0.\n\nSee [[Queen Isolde]] and [[The Long War]].\n\n## The war years\n```evra\ntimeline: Chronicle of Veld\nera: Reign of Ash\n```\n',
	'The Salt Moot': '---\nyear: 12\nmonth: Bloom\n---\nThe clans gather at the salt flats and agree to one harbour-master.\n',
	'Battle of the Shoals': '---\ntimeline-year: 36\ntimeline-month: Ember\nday: 9\n---\nThe Heron’s predecessor runs aground mid-battle; both fleets lose a third of their ships.\n',
	'Queen Isolde': 'First crowned ruler of Veld. Took the throne in Year 22 after the clan moots failed to agree on anything for a decade.\n\nHer rule is remembered as the **Reign of Ash**: long, stubborn, and mostly at war. See [[The Long War]].\n',
	'The Long War': 'Fourteen years of war between Veld and the Ashen League over the salt tolls of the Sallow.\n\n## Key events\n- [[Fall of the River Keep]]\n- [[Treaty of Sallow]]\n',
	'Mira Ashdown': 'Cartographer, born in the war years. Her charts of the delta shoals are still used by river pilots.\n\nSailed on [[The Heron]]. Founded [[The Archive]].\n',
	'Fall of the River Keep': 'The Keep falls after a four-month siege, opened from within by agents of the [[Pale Court]]. The Ashen League holds the river mouth for six years.\n',
	'Treaty of Sallow': 'Ends [[The Long War]]. Veld keeps the river mouth; the League keeps the salt flats. Signed on a barge mid-river so neither side had to cross.\n',
	'The Heron': '---\ncover: "[[The Heron.svg]]"\n---\nThree-masted survey ship. Spent three years charting the outer delta with [[Mira Ashdown]] aboard.\n',
	'The Archive': 'Library and sky-record office in the old customs house of Veld.\n',
	'Pale Court': 'A secret society said to meet beneath the River Keep. Everything about it is disputed, including whether it exists.\n',
};
export const SAMPLE_COVER = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 70"><rect width="240" height="70" fill="#254f63"/><path d="M0 52 Q30 44 60 52 T120 52 T180 52 T240 52 V70 H0z" fill="#1d3d4d"/><path d="M112 16 L112 48 M112 18 L138 44 H112 M110 24 L90 44 H110" stroke="#e8dcc0" stroke-width="2" fill="#e8dcc0" fill-opacity=".85"/><path d="M84 48 H146 L138 56 H92z" fill="#c9a36b"/></svg>\n';

export function sampleDoc(link: (name: string) => string = (n) => n): EvraDoc {
	const e = (o: Partial<EvraEvent>): EvraEvent => ({ id: uid(), side: 'a', title: '', text: '', color: null, t: 0, ...o, file: o.file ? link(o.file) : null });
	const doc = normDoc({
		name: 'Chronicle of Veld', cal: defaultCal(), range: [0, 80], orientation: 'ttb', cardWidth: 240,
		eras: [
			{ id: 'k', parent: null, name: 'The Kindling', start: D(0), end: D(22), color: '2' },
			{ id: 'k1', parent: 'k', name: 'Founding', start: D(0), end: D(8), color: '3' },
			{ id: 'k2', parent: 'k', name: 'River Compacts', start: D(8), end: D(22), color: '5' },
			{ id: 's', parent: null, name: 'The Second Age', start: D(22), end: D(80), color: '5' },
			{ id: 's1', parent: 's', name: 'Reign of Ash', start: D(22), end: D(47), color: '1' },
			{ id: 's1a', parent: 's1', name: 'Siege Winter', start: D(37, 9), end: D(39, 3), color: '6' },
			{ id: 's1b', parent: 's1a', name: 'Hunger Moon', start: D(38, 10), end: D(38, 11), color: '2' },
			{ id: 's2', parent: 's', name: 'The Quiet Years', start: D(47), end: D(68), color: '4' },
			{ id: 's2a', parent: 's2', name: 'Heron Years', start: D(50), end: D(54), color: '5' },
			{ id: 's3', parent: 's', name: 'Restoration', start: D(68), end: D(80), color: '6' },
		],
		events: [
			e({ t: D(0), side: 'a', file: 'Veld', color: '2' }),
			e({ t: D(3), end: D(9), side: 'a', title: 'Raising the River Keep', text: 'Stone hauled downriver from the Sallow quarries. Three winters of work.', color: '3' }),
			e({ t: D(8, 4, 2), side: 'b', title: 'First River Compact', text: 'Fisher-clans and the salt guild agree on tolls at the mouth of the Sallow.', color: '5' }),
			e({ t: D(15, 6, 12), side: 'a', title: 'The Great Flood', text: 'The Sallow breaks its banks. The lower market is lost; the Keep holds.', color: '5' }),
			e({ t: D(20), end: D(34), os: true, side: 'a', title: 'Whispers of the Pale Court', text: 'Rumors of a hidden court beneath the Keep. No one agrees when they began.', color: '6' }),
			e({ t: D(22), side: 'b', file: 'Queen Isolde', color: '6' }),
			e({ t: D(30), end: D(44, 2), side: 'a', file: 'The Long War', color: '1', icon: '⚔', tags: ['war'] }),
			e({ t: D(33, 7, 3), end: D(80), oe: true, side: 'b', file: 'Mira Ashdown', color: '3', life: true }),
			e({ t: D(37, 9), side: 'b', title: 'Siege of the Keep begins', text: 'Ashen banners on the east bank before the first frost.', color: '1' }),
			e({ t: D(38, 0, 14), side: 'a', file: 'Fall of the River Keep', color: '1', icon: '⚑', tags: ['war', 'keep'] }),
			e({ t: D(41, 3), end: D(43), side: 'a', title: 'Plague of Salt', text: 'Brine-fever spreads through the camps on both banks of the river.', color: '3' }),
			e({ t: D(44, 2, 20), side: 'b', file: 'Treaty of Sallow', color: '4' }),
			e({ t: D(47), side: 'b', title: 'Death of Isolde', text: 'The queen dies at Sallowmere. The regency council takes the seal.' }),
			e({ t: D(49, 5), side: 'b', title: 'Mira\'s first chart', text: 'The first survey of the delta shoals, drawn by [[Mira Ashdown]] from a borrowed skiff.', circa: 360, color: '3' }),
			e({ t: D(50, 3), end: D(53, 8), side: 'a', file: 'The Heron', color: '5' }),
			e({ t: D(55, 9), side: 'b', title: 'The pale comet', text: 'Seen for forty nights. The Archive begins keeping sky records.', color: '2' }),
			e({ t: D(61, 4), side: 'a', title: 'Founding of the Archive', text: 'Mira gives her charts to the city; the old customs house becomes a library.', color: '4' }),
			e({ t: D(68), side: 'b', title: 'Restoration Charter', text: 'The river cities sign a common charter. The Keep is rebuilt as a lighthouse.', color: '4' }),
		],
		lastView: [D(29), D(47)], now: D(52, 3, 9),
	});
	const find = (t: string) => doc.events.find((x) => x.title === t);
	find('Founding of the Archive').rel = { to: find('The pale comet').id, from: 'start' }; // the Archive was founded because of the comet
	return doc;
}

const sameJSON = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const idList = (v: unknown): v is { id: string }[] => Array.isArray(v) && v.every((x) => isObj(x) && typeof x.id === 'string');

/** A three-way merge, for a file changed outside while this copy had unsaved changes: base is the file as last loaded
    or saved. Lists of things with ids (cards, eras, colors, months…) merge item by item, other objects key by key, and
    anything else takes the side that changed it; when both changed the same value, ours (what is on screen) wins.
    An item deleted on one side stays deleted unless the other side changed it. */
export function mergeDocs(base: unknown, ours: unknown, theirs: unknown): unknown {
	if (sameJSON(ours, theirs) || sameJSON(base, theirs)) return ours;
	if (sameJSON(base, ours)) return theirs;
	if (isObj(ours) && isObj(theirs)) {
		const b = isObj(base) ? base : {}, out: Record<string, unknown> = {};
		for (const k of new Set([...Object.keys(theirs), ...Object.keys(ours)])) {
			const v = mergeDocs(b[k], ours[k], theirs[k]);
			if (v !== undefined) out[k] = v;
		}
		return out;
	}
	if (idList(ours) && idList(theirs)) {
		const bm = new Map((idList(base) ? base : []).map((x) => [x.id, x])), om = new Map(ours.map((x) => [x.id, x])), tm = new Map(theirs.map((x) => [x.id, x]));
		const out: unknown[] = [];
		// kept unless the other side deleted it without this side changing it
		const keep = (x: { id: string }) => !bm.has(x.id) || !sameJSON(bm.get(x.id), x);
		// the order is theirs unless this side reordered (months, colors…): then ours, with their new items after
		const order = (l: { id: string }[]) => l.filter((x) => bm.has(x.id)).map((x) => x.id).join('\n');
		const baseOrder = idList(base) ? order(base.filter((x) => om.has(x.id))) : '';
		const [first, second, firstOurs] = baseOrder !== order(ours) ? [ours, theirs, true] : [theirs, ours, false];
		const inFirst = firstOurs ? om : tm;
		for (const x of first) {
			const o = om.get(x.id), t = tm.get(x.id);
			if (o && t) out.push(mergeDocs(bm.get(x.id), o, t)); else if (keep(x)) out.push(x);
		}
		for (const x of second) if (!inFirst.has(x.id) && keep(x)) out.push(x);
		return out;
	}
	return ours;
}
