import { makeEngine, repairEras } from '../src/engine';
import { defaultCal, normCal, normDoc } from '../src/model';
import type { Era, EvraDoc } from '../src/types';
import { done, eq, ok } from './harness';

const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const era = (id: string, parent: string | null, start: number, end: number): Era => ({ id, parent, name: id, start, end, color: null });
/** Every era: start before end, inside its parent, no overlap with a sibling. */
function problems(eras: Era[]): string[] {
	const bad: string[] = [], by = new Map(eras.map((e) => [e.id, e]));
	for (const e of eras) {
		if (!(e.end > e.start)) bad.push(`${e.id} empty ${e.start}..${e.end}`);
		const p = e.parent && by.get(e.parent);
		if (p && (e.start < p.start || e.end > p.end)) bad.push(`${e.id} ${e.start}..${e.end} outside ${p.id} ${p.start}..${p.end}`);
		for (const s of eras) if (s !== e && s.parent === e.parent && s.start < e.end && e.start < s.end && s.id < e.id) bad.push(`${e.id} overlaps ${s.id}`);
	}
	return bad;
}

// repairEras on its own
{
	const eras = [era('p', null, 0, 100), era('a', 'p', 10, 60), era('b', 'p', 40, 80), era('c', 'p', 90, 130), era('q', null, 120, 200), era('z', 'a', 55, 70)];
	repairEras(eras);
	eq(problems(eras).join('; '), '', 'overlapping siblings, a child past its parent and a grandchild past its parent are fixed');
	const by = new Map(eras.map((e) => [e.id, e]));
	ok(by.get('a').start === 10 && by.get('b').start === 60 && by.get('c').end === 100 && by.get('q').start === 120, 'eras move as little as they can: ' + eras.map((e) => `${e.id} ${e.start}..${e.end}`).join(', '));
	const ok2 = [era('p', null, 0, 100), era('a', 'p', 0, 50), era('b', 'p', 50, 100)], before = JSON.stringify(ok2);
	repairEras(ok2);
	eq(JSON.stringify(ok2), before, 'valid eras are left alone');
	const tight = [era('p', null, 0, 3), era('a', 'p', 2, 3), era('b', 'p', 2, 3), era('c', 'p', 2, 3)];
	repairEras(tight);
	eq(problems(tight).join('; '), '', 'three children squeezed into three days get a day each');
	const empty = [era('p', null, 0, 10), era('a', 'p', 5, 5)];
	repairEras(empty);
	eq(problems(empty).join('; '), '', 'an empty era gets a day');
}

// remapDates: reordering, removing and shrinking months
const setup = () => {
	const doc: EvraDoc = normDoc({ name: 'T', cal: defaultCal(), events: [], eras: [] });
	const E = makeEngine(() => doc);
	doc.eras = [era('age', null, 0, 100 * 360), era('k', 'age', 10 * 360, 11 * 360), era('spring', 'k', 3600, 3645), era('summer', 'k', 3645, 3700)];
	return { doc, E };
};
{
	const { doc, E } = setup(), old = clone(doc.cal);
	const [thaw, seed] = doc.cal.months; doc.cal.months[0] = seed; doc.cal.months[1] = thaw; // Thaw below Seedfall
	normCal(doc.cal); E.reset(); E.remapDates(old, doc.cal);
	eq(problems(doc.eras).join('; '), '', 'reordering months keeps eras valid');
	const by = new Map(doc.eras.map((e) => [e.id, e]));
	ok(by.get('k').start === 3600 && by.get('k').end === 3960, 'a year-long era still spans its year');
	ok(by.get('age').start === 0 && by.get('age').end === 36000, 'year-aligned eras keep their years');
}
{
	const { doc, E } = setup(), old = clone(doc.cal);
	doc.eras.push(era('war', 'summer', 3635 + 30, 3655 + 30), era('peace', 'summer', 3662, 3680));
	doc.cal.months.splice(1, 1); // remove Seedfall
	normCal(doc.cal); E.reset(); E.remapDates(old, doc.cal);
	eq(problems(doc.eras).join('; '), '', 'removing a month keeps eras valid');
	eq(doc.eras.find((e) => e.id === 'k').end - doc.eras.find((e) => e.id === 'k').start, 330, 'the year lost a month');
}
{
	const { doc, E } = setup(), old = clone(doc.cal);
	doc.eras.push(era('short', 'spring', 3600 + 25, 3600 + 29), era('next', 'spring', 3600 + 29, 3600 + 40));
	doc.events = [{ id: 'late', t: 3600 + 28, side: 'b', title: '', text: '', color: null, file: null }, { id: 'early', t: 3600 + 32, side: 'b', title: '', text: '', color: null, file: null }];
	doc.cal.months[0].days = 20; // shrink Thaw
	normCal(doc.cal); E.reset(); E.remapDates(old, doc.cal);
	eq(problems(doc.eras).join('; '), '', 'shrinking a month keeps eras valid');
	ok(doc.events[0].t < doc.events[1].t, 'events keep their order');
}
{
	// every preset, applied over nested eras
	for (const months of [[['A', 31], ['B', 28], ['C', 31]], [['Only', 360]], [['X', 10], ['Y', 1], ['Z', 10]]] as [string, number][][]) {
		const { doc, E } = setup(), old = clone(doc.cal);
		doc.cal.months = normCal({ months: months.map(([name, days]) => ({ name, days })) }).months;
		normCal(doc.cal); E.reset(); E.remapDates(old, doc.cal);
		eq(problems(doc.eras).join('; '), '', 'a new calendar keeps eras valid: ' + months.map((m) => m[0]).join());
	}
}
done('eras');
