import { defaultCal, mergeDocs, normDoc } from '../src/model';
import type { EvraDoc } from '../src/types';
import { done, eq, ok } from './harness';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const base = normDoc({ name: 'Veld', cal: defaultCal(), eras: [{ id: 'r', parent: null, name: 'Reign', start: 0, end: 3600, color: null }],
	events: [{ id: 'a', t: 10, title: 'A', side: 'a' }, { id: 'b', t: 20, title: 'B', side: 'b' }, { id: 'c', t: 30, title: 'C', side: 'b' }] });
const m = (o: EvraDoc, t: EvraDoc) => normDoc(mergeDocs(clone(base), o, t));
const ev = (d: EvraDoc, id: string) => d.events.find((e) => e.id === id);

// unchanged here: take theirs as is; unchanged there: keep ours
{ const t = clone(base); t.events[0].title = 'A2'; eq(ev(m(clone(base), t), 'a').title, 'A2', 'no unsaved changes: theirs'); }
{ const o = clone(base); o.events[0].title = 'A1'; eq(ev(m(o, clone(base)), 'a').title, 'A1', 'no outside changes: ours'); }

// different cards, different fields of one card
{
	const o = clone(base), t = clone(base);
	o.events[0].title = 'A here'; t.events[1].title = 'B there';
	o.events[2].t = 33; t.events[2].text = 'notes on C';
	const r = m(o, t);
	ok(ev(r, 'a').title === 'A here' && ev(r, 'b').title === 'B there', 'edits to different cards both kept');
	ok(ev(r, 'c').t === 33 && ev(r, 'c').text === 'notes on C', 'edits to different fields of one card both kept');
}
// the same field: ours wins
{ const o = clone(base), t = clone(base); o.events[0].title = 'mine'; t.events[0].title = 'theirs'; eq(ev(m(o, t), 'a').title, 'mine', 'same field: ours'); }
// adds on both sides, deletes
{
	const o = clone(base), t = clone(base);
	o.events.push({ id: 'n1', t: 40, side: 'a', title: 'New here', text: '', color: null, file: null });
	t.events.push({ id: 'n2', t: 50, side: 'a', title: 'New there', text: '', color: null, file: null });
	o.events = o.events.filter((e) => e.id !== 'b'); t.events = t.events.filter((e) => e.id !== 'c');
	const r = m(o, t);
	ok(!!ev(r, 'n1') && !!ev(r, 'n2'), 'cards added on both sides kept');
	ok(!ev(r, 'b') && !ev(r, 'c'), 'cards deleted on either side stay deleted');
	eq(r.events.length, 3, 'a, n1, n2');
}
// deleted on one side but edited on the other: kept
{ const o = clone(base), t = clone(base); o.events = o.events.filter((e) => e.id !== 'a'); t.events[0].title = 'edited'; eq(ev(m(o, t), 'a')?.title, 'edited', 'deleted here, edited there: kept'); }
{ const o = clone(base), t = clone(base); t.events = t.events.filter((e) => e.id !== 'a'); o.events[0].title = 'edited'; eq(ev(m(o, t), 'a')?.title, 'edited', 'deleted there, edited here: kept'); }
// optional keys removed on one side, eras and settings
{
	const o = clone(base), t = clone(base);
	o.events[1].end = 90; t.eras[0].name = 'Reign of Ash'; o.opts.bands = false; t.name = 'Veld 2';
	const r = m(o, t);
	ok(ev(r, 'b').end === 90 && r.eras[0].name === 'Reign of Ash' && !r.opts.bands && r.name === 'Veld 2', 'eras, options and name merge');
	const o2 = clone(r), t2 = clone(r); delete o2.events[1].end; t2.events[1].title = 'B!';
	const r2 = normDoc(mergeDocs(clone(r), o2, t2));
	ok(ev(r2, 'b').end == null && ev(r2, 'b').title === 'B!', 'a key removed here stays removed');
}
// order: theirs, unless this side reordered (a month dragged), then ours with their new items after
{
	const o = clone(base), t = clone(base);
	const [m0, m1, m2] = o.cal.months; o.cal.months.splice(0, 3, m1, m2, m0);
	t.cal.months[5].name = 'Renamed outside';
	t.cal.months.push({ id: 'new', name: 'Added outside', days: 30 });
	const r = m(o, t), ids = r.cal.months.map((x) => x.id);
	eq(ids.slice(0, 3).join(), [m1.id, m2.id, m0.id].join(), 'a local reorder is kept');
	ok(r.cal.months[5].name === 'Renamed outside' && ids[ids.length - 1] === 'new', 'with the outside rename and new month');
	const o2 = clone(base), t2 = clone(base);
	t2.cal.months.reverse(); o2.cal.months[0].name = 'Renamed here';
	const r2 = m(o2, t2);
	ok(r2.cal.months[0].id === t2.cal.months[0].id && r2.cal.months.some((x) => x.name === 'Renamed here'), 'an outside reorder is taken when this side only renamed');
	const o3 = clone(base); o3.cal.months.splice(1, 1);
	eq(m(o3, clone(base)).cal.months.length, 11, 'a local delete isn\'t a reorder');
}
done('merge');
