import { DEFAULT_FMT, str, uid } from './engine';
import type { Calendar, ColorPreset, EvraDoc, EvraEvent, LeapRule, Month, Opts, SyncKey, SyncOpts, TimelineDefaults } from './types';

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

/** Older or hand-written calendars, before months had their own lengths. */
interface RawCal extends Partial<Omit<Calendar, 'months' | 'leaps'>> {
	months?: (Month | string)[];
	leaps?: Partial<LeapRule>[];
	dpm?: number; mpy?: number; prefix?: string; suffix?: string; unit?: string;
}

export function normCal(raw: unknown): Calendar {
	const c = (raw && typeof raw === 'object' ? raw : {}) as RawCal;
	if (!Array.isArray(c.months) || typeof c.months[0] === 'string' || c.dpm) {
		const names = (Array.isArray(c.months) ? c.months : []) as string[], n = c.mpy || names.length || 12, dpm = c.dpm || 30;
		c.months = Array.from({ length: n }, (_, i) => ({ id: uid(), name: typeof names[i] === 'string' ? names[i] : '', days: dpm }));
	}
	let months = (c.months as Month[]).filter((m) => m && typeof m === 'object');
	if (!months.length) months = [{ id: uid(), name: '', days: 360 }];
	months.forEach((m) => { m.id = m.id ? String(m.id) : uid(); m.days = Math.max(1, int(m.days, 30) || 30); m.name = m.name == null ? '' : String(m.name); m.inter = !!m.inter; });
	if (!c.units) { const u = (c.prefix || 'year').toLowerCase(); c.units = { day: 'day', month: 'month', year: u, years: u + 's' }; }
	c.units = { ...DEFAULT_UNITS, ...c.units };
	if (!c.fmt) c.fmt = { year: [c.prefix ? '{U}' : '', '{Y}', c.suffix || ''].filter(Boolean).join(' ') } as Calendar['fmt'];
	const cal: Calendar = {
		months,
		units: c.units,
		fmt: { ...DEFAULT_FMT, ...c.fmt },
		yearStart: int(c.yearStart, 0),
		leaps: (c.leaps || []).filter((r) => r && r.month).map((r) => ({
			id: r.id || uid(), month: String(r.month), days: int(r.days, 1) || 1, every: Math.max(1, int(r.every, 4) || 4),
			except: int(r.except, 0), unless: int(r.unless, 0), off: int(r.off, 0),
		})),
		weekdays: Array.isArray(c.weekdays) ? c.weekdays.map(String) : [],
		weekStart: int(c.weekStart, 0),
		eraBase: c.eraBase === 0 ? 0 : 1,
		second: { on: false, name: 'Second calendar', yearDays: 400, offset: 0, fmt: '{Y} SR', onCards: true, ...(c.second || {}) },
	};
	// keep the same object, so anything holding the calendar sees the update; unknown fields are kept
	for (const k of ['dpm', 'mpy', 'prefix', 'suffix', 'unit']) delete (c as Record<string, unknown>)[k];
	return Object.assign(c as unknown as Calendar, cal);
}

/** Fill in anything a document is missing, so older and hand-edited files open. */
export function normDoc(raw: unknown, fallbackName = 'Untitled'): EvraDoc {
	const d = (raw && typeof raw === 'object' ? raw : {}) as Partial<EvraDoc>;
	if (!Array.isArray(d.palette) || !d.palette.length) d.palette = defaultPalette();
	d.palette = d.palette.filter((p) => p && p.id).map((p) => ({ id: String(p.id), name: String(p.name ?? 'Untitled color'), hex: p.hex || null }));
	d.cal = normCal(d.cal);
	const o = (d.opts || {}) as Partial<Opts>;
	if (!o.sync) o.sync = defaultSync();
	const ds = defaultSync();
	o.sync = { ...ds, ...o.sync, fields: { ...ds.fields, ...(o.sync.fields || {}) } };
	if (!Array.isArray(o.sync.written)) o.sync.written = [];
	if (!Array.isArray(o.sync.notes)) o.sync.notes = [];
	if (o.v !== 2) { o.cardLines = 99; o.v = 2; }
	d.opts = { ...DEFAULT_OPTS, ...o } as Opts;
	d.name = typeof d.name === 'string' ? d.name : fallbackName;
	if (!Array.isArray(d.range) || d.range.length !== 2 || !(d.range[1] > d.range[0])) d.range = [0, 10];
	d.range = [int(d.range[0], 0), int(d.range[1], 10)];
	if (!['ttb', 'btt', 'ltr', 'rtl'].includes(d.orientation)) d.orientation = 'ttb';
	d.cardWidth = int(d.cardWidth, 240) || 240;
	d.eras = (Array.isArray(d.eras) ? d.eras : []).filter((e) => e && typeof e.start === 'number' && typeof e.end === 'number')
		.map((e) => ({ ...e, id: e.id ? String(e.id) : uid(), parent: e.parent ?? null, name: String(e.name ?? 'Untitled era'), color: e.color ?? null }));
	d.events = (Array.isArray(d.events) ? d.events : []).filter((e) => e && typeof e.t === 'number')
		.map((e): EvraEvent => ({ ...e, id: e.id ? String(e.id) : uid(), side: e.side === 'a' ? 'a' : 'b', title: String(e.title ?? ''), text: String(e.text ?? ''), color: e.color ?? null, file: e.file ?? null }));
	if (d.events.some((e) => e.end != null && typeof e.end !== 'number')) d.events.forEach((e) => { if (e.end != null && typeof e.end !== 'number') delete e.end; });
	if (!Array.isArray(d.views)) delete d.views;
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
	if (Array.isArray(o)) o = o[0];
	let j = obj(o);
	if (j && Array.isArray(j.calendars)) j = obj(j.calendars[0]);
	if (j && j.data && !j.static && !j.static_data) j = obj(j.data);
	const sd = j && obj(j.static_data);
	const st = j && (obj(j.static) || (sd && obj(sd.year_data)) || sd);
	if (!st) return 'Couldn’t find a calendar in that file. Paste a Calendarium or Fantasy-Calendar export.';
	const src = (st.months || st.timespans) as Json[];
	if (!Array.isArray(src) || !src.length) return 'That calendar has no months.';
	const months: Month[] = src.map((m) => ({ id: uid(), name: str(m.name), days: Math.max(1, int(m.length ?? m.days, 1) || 1), inter: /intercalary/i.test(str(m.type)) }));
	const leapSrc = (st.leapDays || st.leap_days || (sd && sd.leap_days) || []) as Json[];
	const leaps: LeapRule[] = leapSrc.map((l) => {
		const iv = typeof l.interval === 'string'
			? l.interval.split(',').map((x) => ({ n: parseInt(x.replace(/[!+]/g, ''), 10), ex: x.trim().startsWith('!') }))
			: ((l.interval || []) as Json[]).map((x) => ({ n: int(obj(x) ? x.interval : x, 0), ex: !!(obj(x) && x.exclusive) }));
		const rule = leapFromIntervals(iv), mi = int(l.timespan ?? l.month ?? 0, 0);
		return rule && months[mi] ? { id: uid(), month: months[mi].id, days: 1, off: int(l.offset, 0), ...rule } : null;
	}).filter(Boolean);
	const wk = (st.weekdays || st.global_week || []) as unknown[];
	const weekdays = wk.map((w) => (typeof w === 'string' ? w : obj(w) ? str(obj(w).name) : '')).filter(Boolean);
	return { months, leaps, weekdays };
}

/* ---------- the sample world ---------- */
const D = (y: number, m = 0, d = 0) => y * 360 + m * 30 + d;
export const SAMPLE_NOTES: Record<string, string> = {
	'Veld': '# Veld\nRiver city at the mouth of the Sallow, built on salt and fish. Founded by the fisher-clans in Year 0.\n\nSee [[Queen Isolde]] and [[The Long War]].\n\n## The war years\n```evra\ntimeline: Chronicle of Veld\nera: Reign of Ash\n```\n',
	'The Salt Moot': '---\nyear: 12\nmonth: Bloom\n---\n# The Salt Moot\nThe clans gather at the salt flats and agree to one harbour-master.\n',
	'Battle of the Shoals': '---\ntimeline-year: 36\ntimeline-month: Ember\nday: 9\n---\n# Battle of the Shoals\nThe Heron’s predecessor runs aground mid-battle; both fleets lose a third of their ships.\n',
	'Queen Isolde': '# Queen Isolde\nFirst crowned ruler of Veld. Took the throne in Year 22 after the clan moots failed to agree on anything for a decade.\n\nHer rule is remembered as the **Reign of Ash**: long, stubborn, and mostly at war. See [[The Long War]].\n',
	'The Long War': '# The Long War\nFourteen years of war between Veld and the Ashen League over the salt tolls of the Sallow.\n\n## Key events\n- [[Fall of the River Keep]]\n- [[Treaty of Sallow]]\n',
	'Mira Ashdown': '# Mira Ashdown\nCartographer, born in the war years. Her charts of the delta shoals are still used by river pilots.\n\nSailed on [[The Heron]]. Founded [[The Archive]].\n',
	'Fall of the River Keep': '# Fall of the River Keep\nThe Keep falls after a four-month siege, opened from within by agents of the [[Pale Court]]. The Ashen League holds the river mouth for six years.\n',
	'Treaty of Sallow': '# Treaty of Sallow\nEnds [[The Long War]]. Veld keeps the river mouth; the League keeps the salt flats. Signed on a barge mid-river so neither side had to cross.\n',
	'The Heron': '---\ncover: "[[The Heron.svg]]"\n---\n# The Heron\nThree-masted survey ship. Spent three years charting the outer delta with [[Mira Ashdown]] aboard.\n',
	'The Archive': '# The Archive\nLibrary and sky-record office in the old customs house of Veld.\n',
	'Pale Court': '# Pale Court\nA secret society said to meet beneath the River Keep. Everything about it is disputed, including whether it exists.\n',
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
