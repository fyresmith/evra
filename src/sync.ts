import { clamp, eraAbbr, saneYear, str, type Engine } from './engine';
import { SYNC_FIELDS } from './model';
import type { EvraDoc, EvraEvent, SyncKey } from './types';

/* Note properties (optional, off by default).
   When turned on, each linked note gets timeline properties in its frontmatter that stay in step with its card.
   Editing the year, month or day in the note moves the card. Only notes the timeline links to are touched. */

export type PropValue = string | number | string[] | null;

export function syncValue(k: SyncKey, ev: EvraEvent, doc: EvraDoc, E: Engine): PropValue {
	const p = E.parts(ev.t), path = E.erasAt(ev.t);
	switch (k) {
		case 'date': return ev.end != null ? E.fmtRange(ev) : E.fmt(ev.t);
		case 'year': return p.yr + doc.cal.yearStart;
		case 'month': return E.ci().M > 1 ? E.monthName(p.m) : null;
		case 'day': return p.d + 1;
		case 'end': return ev.end == null ? null : ev.oe ? doc.cal.fmt.ongoing || 'ongoing' : E.fmt(ev.end);
		case 'era': return path[0] ? path[0].name : null;
		case 'subera': return path.length > 1 ? path[path.length - 1].name : null;
		case 'eras': return path.map((e) => e.name);
		case 'timeline': return doc.name;
	}
}

/** The fields being synced, as [field, property name]. */
export function liveFields(doc: EvraDoc): [SyncKey, string][] {
	const sy = doc.opts.sync;
	return SYNC_FIELDS.filter(([k]) => sy.fields[k].on && sy.fields[k].key.trim()).map(([k]): [SyncKey, string] => [k, sy.fields[k].key.trim()]);
}

/** What a note's properties should be. null removes a property. ev null: the note is no longer linked. */
export function desiredProps(doc: EvraDoc, E: Engine, ev: EvraEvent | null): Record<string, PropValue> {
	const sy = doc.opts.sync, live = liveFields(doc), liveKeys = new Set(live.map((x) => x[1])), props: Record<string, PropValue> = {};
	(sy.written || []).filter((k) => !liveKeys.has(k)).forEach((k) => (props[k] = null));
	live.forEach(([k, key]) => (props[key] = ev ? syncValue(k, ev, doc, E) : null));
	return props;
}

const norm = (v: unknown): string => (v == null || v === '' || (Array.isArray(v) && !v.length) ? '' : Array.isArray(v) ? JSON.stringify(v.map(String)) : str(v));
export const sameValue = (a: unknown, b: unknown): boolean => norm(a) === norm(b);

/** Apply desired properties to a frontmatter object. Returns true when something changed. Property names match in any
    capitalisation, as they are read: a note's "Timeline-Year" is written in place, never joined by a "timeline-year". */
export function applyProps(fm: Record<string, unknown>, props: Record<string, PropValue>): boolean {
	let changed = false;
	for (const [k, v] of Object.entries(props)) {
		const variants = Object.keys(fm).filter((x) => x.toLowerCase() === k.toLowerCase());
		const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
		if (empty) { variants.forEach((x) => delete fm[x]); changed ||= variants.length > 0; continue; }
		const key = variants.includes(k) ? k : variants[0] ?? k;
		for (const x of variants) if (x !== key) { delete fm[x]; changed = true; } // copies differing only in case
		if (!sameValue(fm[key], v)) { fm[key] = v; changed = true; }
	}
	return changed;
}

export function needsWrite(fm: Record<string, unknown> | undefined, props: Record<string, PropValue>): boolean {
	return applyProps({ ...(fm || {}) }, props);
}

const lower = (fm: Record<string, unknown>) => Object.fromEntries(Object.entries(fm || {}).map(([k, v]) => [k.toLowerCase(), v]));

/** A note's year, month and day properties, as a new date for its card (the span keeps its length), or null. */
export function dateFromProps(fm: Record<string, unknown>, doc: EvraDoc, E: Engine, ev: EvraEvent): number | null {
	const sy = doc.opts.sync, f = sy.fields, cur = E.parts(ev.t), pr = fm || {}, low = lower(pr);
	let yr = cur.yr, m = cur.m, d = cur.d;
	// the exact key first, then any capitalisation of it, as noteDateOf reads them
	const get = (key: string): unknown => (pr[key] != null ? pr[key] : low[key.toLowerCase()]);
	if (f.year.on && get(f.year.key) != null) { const n = parseInt(str(get(f.year.key)), 10); if (saneYear(n)) yr = n - doc.cal.yearStart; }
	if (f.month.on && get(f.month.key) != null && E.ci().M > 1) {
		const v = str(get(f.month.key)).toLowerCase(), i = doc.cal.months.findIndex((x, j) => E.monthName(j).toLowerCase() === v), n = parseInt(v, 10);
		m = i >= 0 ? i : n >= 1 && n <= E.ci().M ? n - 1 : m;
	}
	if (f.day.on && get(f.day.key) != null) { const n = parseInt(str(get(f.day.key)), 10); if (n >= 1) d = n - 1; }
	// toT keeps the day within this month in this year, so a leap day stays a leap day
	const t = E.toT(yr, m, d);
	return t === ev.t ? null : t;
}

/** Reads a year (and optionally month and day) from a note's properties, or a date property like "14 Frost 412". */
export function noteDateOf(fm: Record<string, unknown>, doc: EvraDoc, E: Engine): number | null {
	if (!fm) return null;
	const f = doc.opts.sync.fields, low = lower(fm);
	const pick = (...keys: string[]): unknown => keys.map((k) => k && low[k.toLowerCase()]).find((v) => v != null && v !== '');
	const y = pick(f.year.key, 'year', 'timeline-year'), m = pick(f.month.key, 'month'), d = pick(f.day.key, 'day'), ds = pick(f.date.key, 'date');
	const s = str;
	const yn = y != null ? parseInt(s(y), 10) : NaN;
	if (!isNaN(yn)) {
		if (!saneYear(yn)) return null;
		let mi = 0;
		if (m != null) {
			const i = doc.cal.months.findIndex((x, j) => E.monthName(j).toLowerCase() === s(m).toLowerCase());
			mi = i >= 0 ? i : clamp((parseInt(s(m), 10) || 1) - 1, 0, doc.cal.months.length - 1);
		}
		return E.toT(yn - doc.cal.yearStart, mi, d != null ? Math.max(0, (parseInt(s(d), 10) || 1) - 1) : 0);
	}
	return ds != null && typeof ds !== 'object' && readsAsDate(s(ds), doc, E) ? E.parseDateQuery(s(ds)) : null;
}

/** Whether a free-form date property is worth reading: an ISO-style date, or numbers mixed only with words
    this calendar uses (month, weekday, unit and era names, words from its formats). Anything else is skipped, not guessed. */
export function readsAsDate(v: string, doc: EvraDoc, E: Engine): boolean {
	const q = v.trim().toLowerCase();
	if (!q || q.length > 80) return false;
	if (/^-?\d{1,9}[-/]\d{1,2}([-/]\d{1,2})?(?![\d/-])/.test(q)) return true;
	const nums = q.match(/\d+/g) || [];
	if (!nums.length || nums.length > 3) return false;
	const c = doc.cal, known = new Set(['of', 'the', 'c', 'ca', 'circa', 'st', 'nd', 'rd', 'th']);
	const add = (x: string) => str(x).toLowerCase().replace(/\{\w+\}/g, ' ').split(/[^\p{L}]+/u).forEach((w) => w && known.add(w));
	c.months.forEach((_, i) => { const n = E.monthName(i).toLowerCase(); add(n); n.split(/[^\p{L}]+/u).forEach((w) => w.length > 3 && known.add(w.slice(0, 3))); });
	(c.weekdays || []).forEach(add);
	Object.values(c.units).forEach(add);
	Object.values(c.fmt).forEach((f) => { if (typeof f === 'string') add(f); });
	doc.eras.forEach((e) => { add(e.name); add(eraAbbr(e)); });
	return (q.match(/\p{L}+/gu) || []).every((w) => known.has(w));
}
