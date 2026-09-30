import { makeEngine } from '../src/engine';
import { defaultCal, normDoc } from '../src/model';
import { applyProps, dateFromProps, desiredProps, needsWrite, noteDateOf } from '../src/sync';
import { noteExcerpt, plainOf } from '../src/text';
import { done, eq, ok } from './harness';

const doc = normDoc({ name: 'Chronicle', cal: defaultCal(), eras: [], events: [] });
const E = makeEngine(() => doc);
doc.eras = [{ id: 's', parent: null, name: 'The Second Age', start: E.toT(22, 0, 0), end: E.toT(80, 0, 0), color: null }, { id: 's1', parent: 's', name: 'Reign of Ash', start: E.toT(22, 0, 0), end: E.toT(47, 0, 0), color: null }];
const ev = { id: 'e1', t: E.toT(38, 0, 14), side: 'a' as const, title: '', text: '', color: null as string | null, file: 'Fall' };
doc.events = [ev];
doc.opts.sync.on = true;
doc.opts.sync.fields.subera.on = true;

const fm: Record<string, unknown> = { aliases: ['Keep'] };
const props = desiredProps(doc, E, ev);
ok(applyProps(fm, props), 'first sync writes');
ok(Array.isArray(fm.aliases), 'keeps existing properties');
ok(fm['timeline-year'] === 38 && fm['timeline-month'] === 'Thaw' && fm['timeline-era'] === 'The Second Age' && fm['timeline-sub-era'] === 'Reign of Ash', 'writes year, month, era and sub-era');
ok(!needsWrite(fm, props), 'nothing to write when already in step');

// renaming a key removes the old one
doc.opts.sync.written = ['timeline-date', 'timeline-year', 'timeline-month', 'timeline-era', 'timeline-sub-era'];
doc.opts.sync.fields.year.key = 'year';
applyProps(fm, desiredProps(doc, E, ev));
ok(fm.year === 38 && !('timeline-year' in fm), 'a renamed key replaces the old one');

// editing the note moves the card
fm.year = 41; fm['timeline-month'] = 'Frost';
const t = dateFromProps(fm, doc, E, ev);
eq(t != null ? E.fmt(t) : '', '15 Frost, Year 41', 'a note edit moves the card');
ok(dateFromProps({ ...fm, year: 38, 'timeline-month': 'Thaw' }, doc, E, ev) == null, 'no move when the note already matches');
const tc = dateFromProps({ Year: 41, 'TIMELINE-MONTH': 'Frost' }, doc, E, ev);
eq(tc != null ? E.fmt(tc) : '', '15 Frost, Year 41', 'property names are read in any capitalisation');
doc.opts.sync.fields.year.key = 'timeline-year';
const tc2 = dateFromProps({ 'Timeline-Year': 41, 'Timeline-Month': 'Frost' }, doc, E, ev);
eq(tc2 != null ? E.fmt(tc2) : '', '15 Frost, Year 41', 'Timeline-Year works');
ok(dateFromProps({ 'Timeline-Year': 38, 'timeline-year': 41 }, doc, E, ev) != null, 'the exact key wins over another capitalisation');
doc.opts.sync.fields.year.key = 'year';

// property names match in any capitalisation
{
	const cap: Record<string, unknown> = { 'Timeline-Year': 40 };
	applyProps(cap, { 'timeline-year': 38 });
	eq(JSON.stringify(cap), '{"Timeline-Year":38}', 'a capitalised key is written in place');
	ok(!needsWrite(cap, { 'timeline-year': 38 }), 'and then counts as in step');
	const two: Record<string, unknown> = { 'Timeline-Year': 40, 'timeline-year': 40 };
	applyProps(two, { 'timeline-year': 38 });
	eq(JSON.stringify(two), '{"timeline-year":38}', 'copies differing only in case become one');
	const gone: Record<string, unknown> = { 'TIMELINE-YEAR': 40, keep: 1 };
	applyProps(gone, { 'timeline-year': null });
	eq(JSON.stringify(gone), '{"keep":1}', 'removing removes any capitalisation');
}

// unlinking removes only timeline properties
doc.opts.sync.written = ['timeline-date', 'year', 'timeline-month', 'timeline-era', 'timeline-sub-era'];
applyProps(fm, desiredProps(doc, E, null));
ok(Object.keys(fm).join() === 'aliases', 'unlinking removes only timeline properties');

// creating cards from dated notes
eq(noteDateOf({ year: 12, month: 'Bloom' }, doc, E), E.toT(12, 2, 0), 'year and month properties');
eq(noteDateOf({ 'timeline-year': 36, 'timeline-month': 'Ember', day: 9 }, doc, E), E.toT(36, 6, 8), 'timeline properties with a day');
eq(noteDateOf({ date: '14 Frost 412' }, doc, E), E.toT(412, 9, 13), 'a date property');
eq(noteDateOf({ tags: ['x'] }, doc, E), null, 'undated notes are skipped');
// a generic date property that doesn't read as a date is skipped, not guessed
for (const bad of ['tomorrow', 'version 2', 'see chapter 3', 'Q3 2024', '99999999999999999999', '12345678901 Frost', 'n/a', '1 2 3 4', '3 Blorp 412']) eq(noteDateOf({ date: bad }, doc, E), null, `date "${bad}" is skipped`);
eq(noteDateOf({ date: 1e20 }, doc, E), null, 'a numeric date of 1e20 is skipped');
eq(noteDateOf({ Date: 'Frost 412' }, doc, E), E.toT(412, 9, 0), 'month and year');
eq(noteDateOf({ date: '15th of Frost, Year 412' }, doc, E), E.toT(412, 9, 14), 'ordinals and the year unit');
eq(noteDateOf({ date: '412' }, doc, E), E.toT(412, 0, 0), 'a bare year');
eq(noteDateOf({ date: 412 }, doc, E), E.toT(412, 0, 0), 'a numeric year');
eq(noteDateOf({ date: 'Year −30' }, doc, E), E.toT(-30, 0, 0), 'a year before zero');
eq(noteDateOf({ date: '0412-10-15' }, doc, E), E.toT(412, 9, 14), 'an ISO date');
eq(noteDateOf({ date: 'Frost 412', year: 5 }, doc, E), E.toT(5, 0, 0), 'a year property still wins');
eq(noteDateOf({ 'timeline-date': E.fmt(E.toT(412, 9, 14)) }, doc, E), E.toT(412, 9, 14), 'a date Evra wrote reads back');

// note excerpts
const long = '---\ncover: x\n---\n# Title\n' + 'word '.repeat(80) + '\n```evra\nera: x\n```';
const ex = noteExcerpt(long);
ok(ex.endsWith('…') && plainOf(ex).length <= 257 && !ex.includes('cover') && !ex.includes('era:'), 'excerpts skip properties, headings and code, and trail off on a word');
eq(plainOf(noteExcerpt('See [[Queen Isolde|the queen]] and **salt**.')), 'See the queen and salt.', 'links and bold read as plain text');

done('sync');
