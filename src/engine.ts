import type { Calendar, Era, EvraDoc, EvraEvent, Formats, LeapRule } from './types';

/* The calendar engine.
   Months each have their own length. Dates are stored as a count of days from year 0, day 1.
   Leap rules add days to a month in some years; festival months hold days that belong to no month.
   Every label comes from an editable template; the tokens are listed in TOKENS. */

export const uid = (): string => Math.random().toString(36).slice(2, 9);
/** A year typed or read from a note that the date maths can use: a whole number within a billion of zero. */
export const saneYear = (y: number): boolean => Number.isSafeInteger(y) && Math.abs(y) <= 1e9;
export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : '');
/** Any plain value as text; objects become empty. */
export const str = (v: unknown): string => (typeof v === 'string' ? v : typeof v === 'number' || typeof v === 'boolean' ? String(v) : '');
export const esc = (s: unknown): string =>
	str(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export const DEFAULT_FMT: Formats = {
	year: '{U} {Y}', yearNeg: '{U} −{Y}', dateDay: '{D} {M}, {year}', dateMonth: '{M}, {year}', dateYear: '{year}',
	dateInter: '{M}, {year}', circa: 'c. {date}', tickYear: '{year}', tickMonth: '{M}', tickDay: '{D} {Mo}',
	range: '{start} – {end}', ongoing: 'ongoing', shortRange: true,
};

export const TOKENS: [string, string][] = [
	['{year}', 'the year, using the year format'], ['{Y}', 'year number'], ['{U}', 'year unit name'], ['{M}', 'month name'],
	['{Mo}', 'short month'], ['{m}', 'month number'], ['{D}', 'day'], ['{Do}', 'day as 1st, 2nd'], ['{W}', 'weekday'],
	['{Wo}', 'short weekday'], ['{EY}', 'year within its era'], ['{E}', 'era abbreviation'], ['{EN}', 'era name'],
];

/** Fill a template: {name} is replaced by vals[name]; unknown tokens stay as they are. */
export function tpl(template: string, v: Record<string, unknown>): string {
	return str(template)
		.replace(/\{(\w+)\}/g, (m: string, k: string) => (v[k] != null ? str(v[k]) : m))
		.replace(/\s{2,}/g, ' ')
		.trim();
}

export const ordinal = (n: number): string =>
	n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] || 'th');

export const eraAbbr = (e: { name: string; abbr?: string }): string =>
	e.abbr || e.name.split(/\s+/).filter((w) => w && !/^(the|of|a|an)$/i.test(w)).map((w) => w[0]).join('').toUpperCase();

interface LeapInfo extends LeapRule { mi: number }
export interface CalInfo {
	cum: number[];
	Y: number; // base year length
	Yavg: number; // average year length, once leap years are counted
	M: number;
	avgM: number;
	maxM: number;
	leaps: LeapInfo[];
	lensCache: Map<number, number[]>;
	startCache: Map<number, number>;
}
export interface Parts { yr: number; r: number; m: number; d: number }
export interface TickSpec { u: 'd' | 'm' | 'y'; k: number; len: number }

const fdiv = (a: number, n: number) => Math.floor(a / n);
// how many k in [a, b) with k ≡ off (mod n)
const multIn = (a: number, b: number, n: number, off: number) => fdiv(b - 1 - off, n) - fdiv(a - 1 - off, n);
const leapsIn = (r: LeapRule, a: number, b: number) =>
	multIn(a, b, r.every, r.off || 0) - (r.except ? multIn(a, b, r.except, r.off || 0) - (r.unless ? multIn(a, b, r.unless, r.off || 0) : 0) : 0);
export const isLeap = (r: LeapRule, y: number): boolean => {
	const on = (n: number) => (((y - (r.off || 0)) % n) + n) % n === 0;
	return on(r.every) && !(r.except && on(r.except) && !(r.unless && on(r.unless)));
};

/** Static facts about any calendar, not only the current document's. */
export function calInfo(cal: Calendar): CalInfo {
	const cum: number[] = [];
	let Y = 0;
	cal.months.forEach((m) => { cum.push(Y); Y += m.days; });
	const leaps = (cal.leaps || [])
		.map((r) => ({ ...r, mi: cal.months.findIndex((m) => m.id === r.month) }))
		.filter((r) => r.mi >= 0 && r.every > 0 && r.days);
	const Yavg = Y + leaps.reduce((a, r) => a + r.days * (1 / r.every - (r.except ? 1 / r.except : 0) + (r.except && r.unless ? 1 / r.unless : 0)), 0);
	return { cum, Y, Yavg, M: cal.months.length, avgM: Y / cal.months.length, maxM: Math.max(...cal.months.map((m) => m.days)), leaps, lensCache: new Map(), startCache: new Map() };
}

export type Engine = ReturnType<typeof makeEngine>;

/** Every date function, reading the calendar, eras and formats of whatever document getDoc returns. */
/** Put eras back in order after their dates moved: each inside its parent, siblings in date order without overlapping,
    and none empty. Worked top-down, so a parent is settled before its children are fitted into it. Only when a parent
    has fewer days than children can some still overlap. */
export function repairEras(eras: Era[]): void {
	const kids = new Map<string | null, Era[]>(), ids = new Set(eras.map((e) => e.id));
	for (const e of eras) { const k = e.parent != null && ids.has(e.parent) ? e.parent : null; kids.set(k, [...(kids.get(k) || []), e]); }
	const seen = new Set<string>();
	const fit = (parent: Era | null) => {
		const list = (kids.get(parent ? parent.id : null) || []).filter((e) => !seen.has(e.id)).sort((a, b) => a.start - b.start || a.end - b.end);
		const lo = parent ? parent.start : -Infinity, hi = parent ? parent.end : Infinity;
		// forward: inside the parent, after the previous sibling, at least a day long
		let floor = lo;
		for (const e of list) {
			e.start = Math.max(e.start, floor);
			e.end = Math.max(Math.min(e.end, hi), e.start + 1);
			floor = e.end;
		}
		// backward: whatever ran past the parent's end is pulled back, a day each if need be
		let ceil = hi;
		for (let i = list.length - 1; i >= 0 && list[i].end > ceil; i--) {
			const e = list[i];
			e.end = ceil;
			if (e.start >= e.end) e.start = Math.max(lo, e.end - 1);
			if (e.start >= e.end) e.end = e.start + 1; // no room left in the parent
			ceil = e.start;
		}
		for (const e of list) { seen.add(e.id); fit(e); }
	};
	fit(null);
}

export function makeEngine(getDoc: () => EvraDoc) {
	// Facts about each calendar (the document's, or an old copy being remapped) are computed once per calendar object.
	// Anything that edits the months or leap rules in place calls reset().
	let infoCache = new WeakMap<Calendar, CalInfo>(), CI: CalInfo = null, ciCal: Calendar = null;
	const S = () => getDoc();
	const ci = (cal: Calendar = S().cal): CalInfo => {
		if (CI && cal === ciCal) return CI;
		let r = infoCache.get(cal);
		if (!r) { r = calInfo(cal); infoCache.set(cal, r); }
		CI = r; ciCal = cal;
		return r;
	};
	const reset = () => { infoCache = new WeakMap(); CI = null; ciCal = null; };
	function yearStartC(y: number, cal: Calendar = S().cal): number {
		const c = ci(cal);
		if (!c.leaps.length) return y * c.Y;
		const hit = c.startCache.get(y);
		if (hit != null) return hit;
		let t = y * c.Y;
		for (const r of c.leaps) t += r.days * (y >= 0 ? leapsIn(r, 0, y) : -leapsIn(r, y, 0));
		if (c.startCache.size > 5000) c.startCache.clear();
		c.startCache.set(y, t);
		return t;
	}
	function monthLens(y: number, cal: Calendar = S().cal): number[] {
		const c = ci(cal);
		if (!c.leaps.length) return cal.months.map((m) => m.days);
		const hit = c.lensCache.get(y);
		if (hit) return hit;
		const lens = cal.months.map((m) => m.days);
		for (const r of c.leaps) if (isLeap(r, y)) lens[r.mi] += r.days;
		if (c.lensCache.size > 5000) c.lensCache.clear();
		c.lensCache.set(y, lens);
		return lens;
	}
	function yearOfC(t: number, cal: Calendar = S().cal): number {
		const c = ci(cal);
		let y = Math.floor(t / c.Yavg);
		if (!Number.isFinite(y)) return 0;
		// Past 2^53, y + 1 === y and the loops below would never end; the first guess is as close as it gets.
		// The guess is only ever a few years off, so the bounds are generous.
		if (y + 1 === y || y - 1 === y) return y;
		for (let g = 0; g < 1000 && yearStartC(y, cal) > t; g++) y--;
		for (let g = 0; g < 1000 && yearStartC(y + 1, cal) <= t; g++) y++;
		return y;
	}
	const yearStartT = (y: number) => yearStartC(y, S().cal);
	const yearOf = (t: number) => yearOfC(t, S().cal);
	const dpy = () => ci().Yavg; // average year length: for scales and rough spacing only
	function partsC(t: number, cal: Calendar): Parts {
		const y = yearOfC(t, cal), r = t - yearStartC(y, cal), lens = monthLens(y, cal);
		let m = 0, acc = 0;
		while (m + 1 < lens.length && acc + lens[m] <= r) { acc += lens[m]; m++; }
		return { yr: y, r, m, d: r - acc };
	}
	const parts = (t: number) => partsC(t, S().cal);
	const toT = (yr: number, m: number, d: number, cal: Calendar = S().cal): number => {
		const lens = monthLens(yr, cal);
		let acc = 0;
		for (let i = 0; i < m; i++) acc += lens[i];
		return yearStartC(yr, cal) + acc + Math.min(d, lens[m] - 1);
	};
	const nearestYearStart = (t: number) => { const y = yearOf(t), a = yearStartT(y), b = yearStartT(y + 1); return t - a <= b - t ? a : b; };

	// the top-level era a moment falls in, and the year within it
	function eraTopAt(t: number): Era {
		let best: Era = null;
		for (const e of S().eras) if (!e.parent && e.start <= t && e.end > t) best = e;
		return best;
	}
	function eraVals(t: number, yr: number) {
		const e = eraTopAt(t), c = S().cal;
		if (!e) return { EY: yr + c.yearStart, E: '', EN: '' };
		return { EY: yr - yearOf(e.start) + (c.eraBase ?? 1), E: eraAbbr(e), EN: e.name };
	}
	const weekday = (t: number) => {
		const c = S().cal, w = c.weekdays || [];
		return w.length ? w[(((t + (c.weekStart || 0)) % w.length) + w.length) % w.length] : '';
	};
	function monthName(m: number): string {
		const c = S().cal, x = c.months[m];
		return (x && x.name.trim()) || cap(c.units.month) + ' ' + (m + 1);
	}
	function yearStr(yr: number, t?: number): string {
		const c = S().cal, n = yr + c.yearStart, f = c.fmt, U = cap(c.units.year), ev = eraVals(t != null ? t : yearStartT(yr), yr);
		return n < 0 ? tpl(f.yearNeg, { Y: -n, U, ...ev }) : tpl(f.year, { Y: n, U, ...ev });
	}
	function vals(t: number) {
		const c = S().cal, p = parts(t), M = monthName(p.m), W = weekday(t);
		return {
			year: yearStr(p.yr, t), Y: Math.abs(p.yr + c.yearStart), U: cap(c.units.year), M, Mo: M.slice(0, 3), m: p.m + 1, D: p.d + 1,
			Do: ordinal(p.d + 1), W, Wo: W.slice(0, 3), ...eraVals(t, p.yr), r: p.r, d: p.d, inter: c.months[p.m] && c.months[p.m].inter,
		};
	}
	function fmt(t: number): string {
		const v = vals(t), f = S().cal.fmt;
		if (v.r === 0) return tpl(f.dateYear, v);
		if (v.inter) return tpl(f.dateInter || DEFAULT_FMT.dateInter, v);
		if (v.d === 0 && ci().M > 1) return tpl(f.dateMonth, v);
		return tpl(f.dateDay, v);
	}
	function fmtRange(ev: Pick<EvraEvent, 't' | 'end' | 'os' | 'oe'>): string {
		const c = S().cal, f = c.fmt, a = parts(ev.t), b = parts(ev.end), ys = c.yearStart;
		if (f.shortRange && !ev.os && !ev.oe && a.r === 0 && b.r === 0 && a.yr + ys >= 0) {
			const ea = eraVals(ev.t, a.yr), eb = eraVals(ev.end, b.yr);
			if (ea.E === eb.E) return tpl(f.year, { Y: `${a.yr + ys}–${b.yr + ys}`, U: cap(c.units.year), EY: `${ea.EY}–${eb.EY}`, E: ea.E, EN: ea.EN });
		}
		return tpl(f.range, { start: ev.os ? '…' : fmt(ev.t), end: ev.oe ? f.ongoing || 'ongoing' : fmt(ev.end) });
	}
	function evDate(ev: EvraEvent): string {
		if (ev.end != null) return fmtRange(ev);
		const d = fmt(ev.t);
		return ev.circa ? tpl(S().cal.fmt.circa || DEFAULT_FMT.circa, { date: d }) : d;
	}
	function tickLabel(t: number): string {
		const v = vals(t), f = S().cal.fmt;
		if (v.r === 0) return tpl(f.tickYear, v);
		if (v.d === 0) return tpl(f.tickMonth, v);
		return tpl(f.tickDay, v);
	}
	function tickSpecs(): TickSpec[] {
		const c = ci(), out: TickSpec[] = [];
		[1, 5, 10].forEach((k) => { if (k < c.maxM) out.push({ u: 'd', k, len: k }); });
		if (c.M > 1) [1, 2, 3, 4, 6].forEach((k) => { if (k < c.M && c.M % k === 0) out.push({ u: 'm', k, len: c.avgM * k }); });
		[1, 2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 1e4, 2.5e4, 5e4, 1e5, 2.5e5, 1e6].forEach((k) => out.push({ u: 'y', k, len: c.Yavg * k }));
		return out;
	}
	const RANK = { d: 0, m: 1, y: 2 };
	const divides = (mi: TickSpec, ma: TickSpec) => RANK[mi.u] < RANK[ma.u] || (mi.u === ma.u && ma.k % mi.k === 0);
	/** The ruler's marks at a zoom level (pixels per day). */
	function pickTicks(scale: number): { major: TickSpec; minor: TickSpec } {
		const st = tickSpecs();
		let major = st[st.length - 1];
		for (const s of st) if (s.len * scale >= 74) { major = s; break; }
		let minor: TickSpec = null;
		for (const s of st) if (s.len < major.len && divides(s, major) && s.len * scale >= 16) { minor = s; break; }
		return { major, minor };
	}
	function genTicks(sp: TickSpec, t0: number, t1: number, max = 800): number[] {
		const out: number[] = [];
		if (sp.u === 'y') {
			let y = Math.ceil(yearOf(t0) / sp.k) * sp.k;
			if (yearStartT(y) < t0) y += sp.k;
			for (let g = 0; yearStartT(y) <= t1 && out.length < max && g < max; y += sp.k, g++) out.push(yearStartT(y));
			return out;
		}
		for (let y = yearOf(t0), y1 = yearOf(t1), g = 0; y <= y1 && out.length < max && g < max; y++, g++) {
			const lens = monthLens(y);
			let base = yearStartT(y);
			for (let m = 0; m < lens.length; base += lens[m], m++) {
				if (sp.u === 'm') { if (m % sp.k === 0 && base >= t0 && base <= t1) out.push(base); continue; }
				for (let d = 0; d < lens[m] && out.length < max; d += sp.k) { const t = base + d; if (t >= t0 && t <= t1) out.push(t); }
			}
		}
		return out;
	}
	// what dragging and new selections snap to; set by the view each frame
	let snapSpec: TickSpec = { u: 'y', k: 1, len: 360 };
	const setSnap = (s: TickSpec) => { snapSpec = s; };
	function snap(t: number, fine?: boolean): number {
		if (fine) return Math.round(t);
		const sp = snapSpec;
		let best = Math.round(t), bd = Infinity;
		for (const x of genTicks(sp, t - sp.len * 1.5, t + sp.len * 1.5, 400)) { const d = Math.abs(x - t); if (d < bd) { bd = d; best = x; } }
		return best;
	}
	function stepT(t: number, dir: number): number {
		const ts = genTicks(snapSpec, t - snapSpec.len * 2.5, t + snapSpec.len * 2.5, 400);
		if (dir > 0) { const n = ts.find((x) => x > t); return n != null ? n : t + 1; }
		for (let i = ts.length - 1; i >= 0; i--) if (ts[i] < t) return ts[i];
		return t - 1;
	}
	// Keep every event on the same named day when months change length, move or disappear
	function remapDates(oldCal: Calendar, newCal: Calendar) {
		const idx = new Map(newCal.months.map((m, i) => [m.id, i]));
		const f = (t: number) => {
			const p = partsC(t, oldCal), om = oldCal.months[p.m];
			const nm = idx.has(om.id) ? idx.get(om.id) : Math.min(p.m, newCal.months.length - 1);
			return toT(p.yr, nm, p.d, newCal);
		};
		const d = S();
		d.events.forEach((e) => {
			e.t = f(e.t);
			if (e.end != null) e.end = Math.max(e.t + 1, f(e.end));
			if (e.rel && e.rel.at != null) e.rel.at = f(e.rel.at); // where the anchor was last seen moves with it, or the pin would shift the card again
		});
		// Era edges: a year start stays a year start, and the end (the day after the era) goes where the era's last day goes, so a
		// year-long era still ends at the year's end when months move. Moved or dropped months can still make eras overlap
		// or leave their parents: repairEras puts them back in order.
		const edge = (t: number, last: boolean) => {
			const p = partsC(t, oldCal);
			if (p.m === 0 && p.d === 0) return yearStartC(p.yr, newCal);
			return last ? f(t - 1) + 1 : f(t);
		};
		d.eras.forEach((e) => {
			const a = edge(e.start, false), b = edge(e.end, true);
			[e.start, e.end] = a < b ? [a, b] : [Math.min(a, b - 1), Math.max(a + 1, b)]; // months swapped under it: cover both ends
		});
		repairEras(d.eras);
	}
	// Depths are cached against the eras array, its length and each era's id and parent (compared without allocating),
	// so the many erasAt calls in one frame don't rebuild them. Treat the result as read-only.
	let depCache: { eras: Era[]; ids: string[]; parents: string[]; d: Record<string, number> } = null;
	function eraDepths(): Record<string, number> {
		const eras = S().eras, dc = depCache;
		if (dc && dc.eras === eras && dc.ids.length === eras.length) {
			let same = true;
			for (let i = 0; i < eras.length && same; i++) same = eras[i].id === dc.ids[i] && (eras[i].parent || null) === dc.parents[i];
			if (same) return dc.d;
		}
		const by: Record<string, Era> = {}, d: Record<string, number> = {};
		eras.forEach((e) => (by[e.id] = e));
		eras.forEach((e) => { let k = 1, p = e, g = 0; while (p.parent && by[p.parent] && g++ < 64) { k++; p = by[p.parent]; } d[e.id] = k; });
		depCache = { eras, ids: eras.map((e) => e.id), parents: eras.map((e) => e.parent || null), d };
		return d;
	}
	/** Every era a moment falls in, outermost first. */
	function erasAt(t: number): Era[] {
		const d = eraDepths();
		return S().eras.filter((e) => e.start <= t && e.end > t).sort((a, b) => d[a.id] - d[b.id]);
	}
	/** Read a typed date: "412", "Frost 412", "14 Frost, Year 412", "-30". */
	function parseDateQuery(q: string): number {
		const c = S().cal;
		q = q.trim().toLowerCase();
		if (!q) return null;
		// year-month(-day), as in ISO dates: "2024-05-01", "2024/05/01", "2024-05"; the month is a 1-based number into this calendar's months
		const iso = /^(-?\d{1,9})([-/])(\d{1,2})(?:\2(\d{1,2}))?(?![\d/-])/.exec(q);
		if (iso) {
			const y = Number(iso[1]), mo = Number(iso[3]) - 1, d = iso[4] != null ? Math.max(0, Number(iso[4]) - 1) : 0;
			if (!saneYear(y) || mo < 0 || mo >= c.months.length) return null;
			return toT(y - c.yearStart, mo, d);
		}
		const negWord = c.fmt.yearNeg ? /\{Y\}\s+(\S+)/.exec(c.fmt.yearNeg) : null;
		// the word as a whole token, so "BE" doesn't match inside "Ember" or "September"
		const neg = /(^|\s)[-−]\s*\d/.test(q) || (!!negWord && new RegExp('(^|[\\s,])' + negWord[1].toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([\\s,.]|$)').test(q));
		const nums = (q.match(/\d+/g) || []).map(Number);
		if (!nums.length) return null;
		let m = -1;
		if (ci().M > 1) c.months.forEach((x, i) => {
			const n = monthName(i).toLowerCase();
			if (m < 0 && (q.includes(n) || (n.length > 3 && new RegExp('\\b' + n.slice(0, 3).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(q)))) m = i;
		});
		let y: number, d = 0;
		if (m >= 0 && nums.length >= 2) { d = Math.max(0, nums[0] - 1); y = nums[nums.length - 1]; }
		else y = nums[nums.length - 1];
		if (!saneYear(y)) return null;
		if (neg) y = -y;
		return toT(y - c.yearStart, Math.max(0, m), d);
	}
	return {
		ci, reset, yearStartC, monthLens, yearOfC, yearStartT, yearOf, dpy, partsC, parts, toT, nearestYearStart, eraTopAt, eraVals,
		weekday, monthName, yearStr, vals, fmt, fmtRange, evDate, tickLabel, pickTicks, genTicks, setSnap, snap, stepT, remapDates,
		eraDepths, erasAt, parseDateQuery,
	};
}
