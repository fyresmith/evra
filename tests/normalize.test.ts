import { makeEngine } from '../src/engine';
import { defaultCal, normCal, normDoc, sampleDoc } from '../src/model';
import type { EvraDoc } from '../src/types';
import { done, eq, ok } from './harness';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
/** normDoc run twice gives the same document as once. */
const idem = (raw: unknown, msg: string) => { const a = normDoc(clone(raw)); ok(JSON.stringify(normDoc(clone(a))) === JSON.stringify(a), msg + ' (idempotent)'); return a; };

// 1. absurd dates can't hang the engine
{
	let doc: EvraDoc = normDoc({ name: 'Big', cal: defaultCal(), events: [] });
	const E = makeEngine(() => doc);
	const t0 = Date.now();
	const y = E.yearOfC(1e20);
	ok(Number.isFinite(y) && Date.now() - t0 < 500, 'yearOfC(1e20) returns');
	ok(Number.isFinite(E.yearOf(-1e20)), 'yearOf(-1e20) returns');
	eq(E.yearOf(Infinity), 0, 'yearOf(Infinity) returns');
	eq(E.yearOf(NaN), 0, 'yearOf(NaN) returns');
	ok(E.genTicks({ u: 'y', k: 1, len: 360 }, 1e20, 1e20 + 1e6).length <= 800, 'genTicks at 1e20 returns');
	ok(E.genTicks({ u: 'd', k: 1, len: 1 }, 1e20, 1e20 + 100).length <= 800, 'day ticks at 1e20 return');
	E.parts(1e20);
	const t1 = Date.now();
	doc = normDoc({
		name: 'Huge', cal: defaultCal(),
		events: [{ id: 'a', t: 1e20 }, { id: 'b', t: 5, end: 1e20 }, { id: 'c', t: NaN }, { id: 'd', t: 7, end: Infinity }, { id: 'e', t: 9, rel: { to: 'b', from: 'start', offset: 1e300, at: 1e16 } }, { id: 'f', t: '5' }],
		eras: [{ id: 'x', start: 1e20, end: 1e21 }, { id: 'y', start: 0, end: 1e16 }, { id: 'z', start: 0, end: 100 }],
		now: 1e20, views: [{ id: 'v', name: 'V', a: 0, b: 1e20, x: 0 }, { id: 'w', name: 'W', a: 0, b: 50, x: 0 }], lastView: [0, Infinity], forkAt: -1e16,
	});
	E.reset();
	ok(Date.now() - t1 < 500, 'normDoc of a file with t: 1e20 returns quickly');
	eq(doc.events.map((e) => e.id).join(), 'b,d,e', 'events with unusable starts are dropped');
	ok(!('end' in doc.events[0]) && !('end' in doc.events[1]), 'unusable ends are removed');
	ok(!('offset' in doc.events[2].rel) && !('at' in doc.events[2].rel), 'unusable pin offsets are removed');
	eq(doc.eras.map((e) => e.id).join(), 'z', 'eras with unusable dates are dropped');
	eq(doc.now, null, 'an absurd now is cleared');
	eq(doc.views.map((v) => v.id).join(), 'w', 'views with absurd bounds are dropped');
	ok(!('lastView' in doc) && !('forkAt' in doc), 'absurd lastView and forkAt are removed');
	idem({ events: [{ t: 1e20 }, { t: 3, end: 1e99 }], now: Infinity }, 'absurd numbers');
}

// 2. wrong-typed calendar and option fields are repaired instead of throwing
{
	for (const leaps of [{}, 'x', 5, null, [null, 'x', { month: {} }]]) {
		let threw = false, c = null;
		try { c = normCal({ months: [{ name: 'A', days: 30 }], leaps }); } catch { threw = true; }
		ok(!threw && Array.isArray(c.leaps) && c.leaps.length === 0, `leaps ${JSON.stringify(leaps)} are ignored`);
	}
	const c = normCal({
		months: [{ id: {}, name: { x: 1 }, days: 'abc' }, 'stray', null, { name: 'B', days: 1e20 }], units: 'x', fmt: { year: 5, dateDay: '{D}', custom: 'kept' },
		weekdays: ['Mon', { n: 1 }, 3], second: { on: 'yes', name: 7, yearDays: -4, offset: Infinity, fmt: null, onCards: 0, extra: 1 }, yearStart: 1e20, extra: 'kept',
	});
	ok(c.months.length === 2 && typeof c.months[0].id === 'string' && c.months[0].id !== '[object Object]' && c.months[0].name === '' && c.months[0].days === 30 && c.months[1].days === 1e6, 'bad month entries are dropped or repaired');
	ok(c.units.year === 'year' && c.units.day === 'day', 'units that aren\'t an object fall back to defaults');
	ok(c.fmt.year === '{U} {Y}' && c.fmt.dateDay === '{D}' && (c.fmt as unknown as Record<string, unknown>).custom === 'kept', 'format values must be strings');
	eq(c.weekdays.join('|'), 'Mon||3', 'weekdays are text');
	const s = c.second as unknown as Record<string, unknown>;
	ok(s.on === false && s.name === 'Second calendar' && s.yearDays === 400 && s.offset === 0 && s.fmt === '{Y} SR' && s.onCards === true && s.extra === 1, 'second calendar fields are typed');
	eq(c.yearStart, 1e12, 'an absurd year start is clamped');
	eq((c as unknown as Record<string, unknown>).extra, 'kept', 'unknown calendar fields are kept');
	const pre = normCal({ units: { year: 3 }, prefix: 42, mpy: 1e12, dpm: 'x' });
	ok(pre.months.length === 1000 && pre.months[0].days === 30 && pre.units.year === 'year', 'odd legacy fields can\'t blow up');
	const d = idem({
		palette: [{ id: '1', name: 'Red', hex: '#ff0000' }, { id: '2', name: 'Bad', hex: 'red' }, { id: '3', hex: '#fff' }, { name: 'no id' }, 'x', { id: 4, name: 5, hex: 7, note: 'kept' }],
		opts: { cardLines: '4', groupOver: -1, spanStyle: 'zig', snapTo: 'w', bands: 'no', v: 2, fadeFuture: 1, custom: 1,
			sync: { on: 'yes', fields: { year: 'x', month: { on: 'y', key: 5 }, day: { on: true, key: 'dd' }, mine: { on: true, key: 'm' }, junk: 3 }, written: ['a', 1], notes: 'n' } },
	}, 'wrong-typed options');
	eq(d.palette.map((p) => `${p.id}:${p.hex}`).join(), '1:#ff0000,2:null,3:null,4:null', 'palette hex must be #rrggbb');
	eq(d.palette[3].name, '5', 'palette names are text');
	eq((d.palette[3] as unknown as Record<string, unknown>).note, 'kept', 'unknown palette fields are kept');
	ok(d.opts.cardLines === 99 && d.opts.groupOver === 3 && d.opts.spanStyle === 'threads' && d.opts.snapTo === 'auto' && d.opts.bands === true && !('fadeFuture' in d.opts), 'option types and enums');
	eq((d.opts as unknown as Record<string, unknown>).custom, 1, 'unknown options are kept');
	const sy = d.opts.sync, f = sy.fields as Record<string, { on: boolean; key: string }>;
	ok(sy.on === false && f.year.key === 'timeline-year' && f.month.on === true && f.month.key === 'timeline-month' && f.day.key === 'dd', 'sync fields are typed');
	ok(f.mine.key === 'm' && !('junk' in f), 'unknown sync fields are kept only when they have the right shape');
	ok(sy.written.join() === 'a' && sy.notes.length === 0, 'sync lists hold text');
	ok(normDoc({ palette: [{ name: 'x' }] }).palette.length === 6, 'a palette with nothing usable gets the defaults');
}

// 3. card width stays within the slider's range
eq(normDoc({ cardWidth: 5000 }).cardWidth, 360, 'wide cards are clamped');
eq(normDoc({ cardWidth: 12 }).cardWidth, 160, 'narrow cards are clamped');
eq(normDoc({ cardWidth: 'x' }).cardWidth, 240, 'a missing width is the default');
eq(normDoc({ cardWidth: 300 }).cardWidth, 300, 'a width in range is kept');

// 4. wrong-typed event and era fields
{
	const d = idem({
		events: [
			{ id: 'a', t: 1, tags: 'war', people: [1, 'p'], circa: -5, icon: 3, rel: { to: 5, from: 'start' }, side: 'x', os: 'yes', oe: true, life: 1, title: 7, text: {}, color: 2, file: {}, mine: 'kept' },
			{ id: 'b', t: 2, tags: ['x', 2], people: 'p', circa: 30, icon: '⚔', rel: { to: 'a', from: 'end', offset: 1 } },
			{ id: 'c', t: 3, rel: { to: 'a', from: 'middle' }, circa: Infinity },
			{ id: 'd', t: 4, rel: 'a' },
		],
		eras: [
			{ id: 'r', start: 10, end: 0, parent: 'nope', name: 'Rev', abbr: 5 },
			{ id: 'z', start: 5, end: 5 },
			{ id: 'p', start: 0, end: 100, parent: 'q' },
			{ id: 'q', start: 0, end: 100, parent: 'p' },
			{ id: 's', start: 0, end: 50, parent: 's' },
			{ id: 'k', start: 0, end: 50, parent: 'q', name: { x: 1 } },
		],
	}, 'wrong-typed events and eras');
	const [a, b, c, e4] = d.events;
	ok(!('tags' in a) && a.people.join() === 'p' && !('circa' in a) && !('icon' in a) && !('rel' in a) && a.side === 'b', 'bad tags, circa, icon and pins are dropped');
	ok(!('os' in a) && a.oe === true && !('life' in a), 'flags must be booleans');
	ok(a.title === '7' && a.text === '' && a.color === '2' && a.file === null, 'titles, colors and files are typed');
	eq((a as unknown as Record<string, unknown>).mine, 'kept', 'unknown event fields are kept');
	ok(b.tags.join() === 'x' && !('people' in b) && b.circa === 30 && b.icon === '⚔' && b.rel.to === 'a' && b.rel.from === 'end' && b.rel.offset === 1, 'good fields are kept');
	ok(!('rel' in c) && !('circa' in c) && !('rel' in e4), 'pins need a target and an edge');
	eq(d.eras.map((e) => e.id).join(), 'r,p,q,s,k', 'zero-length eras are dropped');
	const by = Object.fromEntries(d.eras.map((e) => [e.id, e]));
	ok(by.r.start === 0 && by.r.end === 10, 'reversed eras are swapped');
	ok(by.r.parent === null && !('abbr' in by.r), 'missing parents are cleared, abbr must be text');
	ok(by.s.parent === null, 'an era can\'t be its own parent');
	ok((by.p.parent === null) !== (by.q.parent === null), 'a parent cycle is broken at one era');
	ok(by.k.parent === 'q' && by.k.name === 'Untitled era', 'children of a cycle keep their parent');
	const long = normDoc({ eras: Array.from({ length: 50 }, (_, i) => ({ id: 'e' + i, start: 0, end: 10, parent: 'e' + ((i + 1) % 50) })) });
	eq(long.eras.filter((e) => e.parent === null).length, 1, 'a long cycle is broken once');
}

// 5. spans that end where they start, or before, are moments
{
	const d = idem({ events: [{ id: 'a', t: 10, end: 10 }, { id: 'b', t: 10, end: 3 }, { id: 'c', t: 10, end: 11 }] }, 'span ends');
	ok(!('end' in d.events[0]) && !('end' in d.events[1]) && d.events[2].end === 11, 'end <= t is dropped');
}

// 6. the range is two whole years, end after start
{
	eq(normDoc({ range: [2.4, 7.6] }).range.join(), '2,8', 'ranges are rounded');
	eq(normDoc({ range: [5, 5.2] }).range.join(), '0,10', 'a range that rounds to nothing is replaced');
	eq(normDoc({ range: [5, 1] }).range.join(), '0,10', 'a reversed range is replaced');
	eq(normDoc({ range: ['0', '10'] }).range.join(), '0,10', 'text ranges are replaced');
	eq(normDoc({ range: [0, Infinity] }).range.join(), '0,10', 'infinite ranges are replaced');
	eq(normDoc({ range: [0, 1e20] }).range.join(), '0,10', 'absurd ranges are replaced');
	const w = idem({ cal: defaultCal(), range: 'x', events: [{ t: 360 * 3 }, { t: -360 * 4 - 5, end: 360 * 2 }], eras: [{ start: 0, end: 360 * 25 + 1 }] }, 'widened range');
	eq(w.range.join(), '-5,26', 'a missing range covers every event and era');
	eq(normDoc({ cal: defaultCal(), range: null, events: [{ t: 360 * 12 + 5 }] }).range.join(), '0,13', 'a range reaches the last event');
}

// 7. era depths are cached between calls, and follow edits
{
	const doc = normDoc({ cal: defaultCal(), eras: [{ id: 'a', start: 0, end: 100 }, { id: 'b', parent: 'a', start: 0, end: 50 }, { id: 'c', start: 100, end: 200 }] });
	const E = makeEngine(() => doc);
	const d1 = E.eraDepths();
	ok(E.eraDepths() === d1, 'depths are reused while the eras are unchanged');
	eq(E.erasAt(10).map((e) => e.id).join(), 'a,b', 'erasAt, outermost first');
	doc.eras[2].parent = 'b';
	eq(E.eraDepths().c, 3, 'a parent edit is seen');
	doc.eras.push({ id: 'd', parent: 'c', start: 100, end: 150, name: 'D', color: null });
	eq(E.eraDepths().d, 4, 'a new era is seen');
	doc.eras = doc.eras.slice(0, 2);
	ok(E.eraDepths().c == null, 'a replaced list is seen');
	const many = normDoc({ eras: Array.from({ length: 2000 }, (_, i) => ({ id: 'e' + i, parent: i ? 'e' + (i - 1) : null, start: i, end: 5000 })) });
	const M = makeEngine(() => many), t2 = Date.now();
	for (let i = 0; i < 300; i++) M.erasAt(i);
	ok(Date.now() - t2 < 1000, 'repeated erasAt calls on a deep tree are quick');
}

const sample = idem(sampleDoc(), 'the sample world');
ok(sample.events.length === 18 && sample.eras.length === 10 && sample.range.join() === '0,80', 'the sample world loads whole');

// repeated ids: each card and era gets its own; references keep meaning the first
{
	const d = idem({ events: [{ id: 'x', t: 1, title: 'A' }, { id: 'x', t: 2, title: 'B' }, { id: 5, t: 3 }, { id: '5', t: 4 }], eras: [
		{ id: 'g', name: 'One', start: 0, end: 10 }, { id: 'g', name: 'Two', start: 10, end: 20 }, { id: 'k', name: 'Kid', start: 2, end: 5, parent: 'g' }] }, 'repeated ids');
	eq(new Set(d.events.map((e) => e.id)).size, 4, 'event ids made unique');
	ok(d.events[0].id === 'x' && d.events[2].id === '5', 'the first keeps its id');
	eq(new Set(d.eras.map((e) => e.id)).size, 3, 'era ids made unique');
	eq(d.eras.find((e) => e.name === 'Kid').parent, d.eras.find((e) => e.name === 'One').id, 'a child stays with the first era of that id');
}

done('normalize');
