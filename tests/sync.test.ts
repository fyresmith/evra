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

// unlinking removes only timeline properties
doc.opts.sync.written = ['timeline-date', 'year', 'timeline-month', 'timeline-era', 'timeline-sub-era'];
applyProps(fm, desiredProps(doc, E, null));
ok(Object.keys(fm).join() === 'aliases', 'unlinking removes only timeline properties');

// creating cards from dated notes
eq(noteDateOf({ year: 12, month: 'Bloom' }, doc, E), E.toT(12, 2, 0), 'year and month properties');
eq(noteDateOf({ 'timeline-year': 36, 'timeline-month': 'Ember', day: 9 }, doc, E), E.toT(36, 6, 8), 'timeline properties with a day');
eq(noteDateOf({ date: '14 Frost 412' }, doc, E), E.toT(412, 9, 13), 'a date property');
eq(noteDateOf({ tags: ['x'] }, doc, E), null, 'undated notes are skipped');

// note excerpts
const long = '---\ncover: x\n---\n# Title\n' + 'word '.repeat(80) + '\n```evra\nera: x\n```';
const ex = noteExcerpt(long);
ok(ex.endsWith('…') && plainOf(ex).length <= 257 && !ex.includes('cover') && !ex.includes('era:'), 'excerpts skip properties, headings and code, and trail off on a word');
eq(plainOf(noteExcerpt('See [[Queen Isolde|the queen]] and **salt**.')), 'See the queen and salt.', 'links and bold read as plain text');

done('sync');
