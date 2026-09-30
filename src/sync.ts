import { clamp, str, type Engine } from './engine';
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

/** Apply desired properties to a frontmatter object. Returns true when something changed. */
export function applyProps(fm: Record<string, unknown>, props: Record<string, PropValue>): boolean {
	let changed = false;
	for (const [k, v] of Object.entries(props)) {
		const empty = v == null || v === '' || (Array.isArray(v) && !v.length);
		if (empty) { if (k in fm) { delete fm[k]; changed = true; } continue; }
		if (!sameValue(fm[k], v)) { fm[k] = v; changed = true; }
	}
	return changed;
}

export function needsWrite(fm: Record<string, unknown> | undefined, props: Record<string, PropValue>): boolean {
	return applyProps({ ...(fm || {}) }, props);
}

const lower = (fm: Record<string, unknown>) => Object.fromEntries(Object.entries(fm || {}).map(([k, v]) => [k.toLowerCase(), v]));

/** A note's year, month and day properties, as a new date for its card (the span keeps its length), or null. */
export function dateFromProps(fm: Record<string, unknown>, doc: EvraDoc, E: Engine, ev: EvraEvent): number | null {
	const sy = doc.opts.sync, f = sy.fields, cur = E.parts(ev.t), pr = fm || {};
	let yr = cur.yr, m = cur.m, d = cur.d;
	const get = (key: string): unknown => pr[key];
	if (f.year.on && get(f.year.key) != null) { const n = parseInt(str(get(f.year.key)), 10); if (!isNaN(n)) yr = n - doc.cal.yearStart; }
	if (f.month.on && get(f.month.key) != null && E.ci().M > 1) {
		const v = str(get(f.month.key)).toLowerCase(), i = doc.cal.months.findIndex((x, j) => E.monthName(j).toLowerCase() === v), n = parseInt(v, 10);
		m = i >= 0 ? i : n >= 1 && n <= E.ci().M ? n - 1 : m;
	}
	if (f.day.on && get(f.day.key) != null) { const n = parseInt(str(get(f.day.key)), 10); if (n >= 1) d = n - 1; }
	d = Math.min(d, doc.cal.months[m].days - 1);
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
	if (y != null && !isNaN(parseInt(s(y), 10))) {
		let mi = 0;
		if (m != null) {
			const i = doc.cal.months.findIndex((x, j) => E.monthName(j).toLowerCase() === s(m).toLowerCase());
			mi = i >= 0 ? i : clamp((parseInt(s(m), 10) || 1) - 1, 0, doc.cal.months.length - 1);
		}
		return E.toT(parseInt(s(y), 10) - doc.cal.yearStart, mi, d != null ? Math.max(0, (parseInt(s(d), 10) || 1) - 1) : 0);
	}
	return ds != null && typeof ds !== 'object' ? E.parseDateQuery(s(ds)) : null;
}
