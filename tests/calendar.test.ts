import { makeEngine } from '../src/engine';
import { normCal, normDoc, sampleDoc, parseCalendarImport } from '../src/model';
import type { EvraDoc } from '../src/types';
import { done, eq, ok } from './harness';

const G: [string, number][] = [['January', 31], ['February', 28], ['March', 31], ['April', 30], ['May', 31], ['June', 30], ['July', 31], ['August', 31], ['September', 30], ['October', 31], ['November', 30], ['December', 31]];
let doc: EvraDoc = normDoc({ name: 'Test', cal: { months: G.map(([name, days]) => ({ name, days })), prefix: 'Year' } });
const E = makeEngine(() => doc);
doc.cal.leaps = [{ id: 'l', month: doc.cal.months[1].id, days: 1, every: 4, except: 100, unless: 400, off: 0 }];
E.reset();
ok(Math.abs(E.dpy() - 365.2425) < 1e-9, 'average Gregorian year is 365.2425 days');
ok(E.monthLens(2024)[1] === 29 && E.monthLens(1900)[1] === 28 && E.monthLens(2000)[1] === 29 && E.monthLens(2023)[1] === 28, 'February lengths in 2024, 1900, 2000, 2023');
eq(E.yearStartT(400), 146097, '400 years');
eq(E.yearStartT(-400), -146097, 'negative years mirror');
let bad = 0;
for (let t = -50000; t < 50000; t += 37) { const p = E.parts(t); if (E.toT(p.yr, p.m, p.d) !== t) bad++; }
eq(bad, 0, 'date round trip across 274 years, including negatives');
eq(E.fmt(E.toT(2024, 1, 28)), '29 February, Year 2024', 'leap day');
const mt = E.genTicks({ u: 'm', k: 1, len: 30 }, E.toT(2024, 0, 0), E.toT(2024, 11, 30));
ok(mt.length === 12 && mt[2] - mt[1] === 29, 'month ticks follow the leap February');
const yt = E.genTicks({ u: 'y', k: 10, len: 3652 }, E.toT(1995, 0, 0), E.toT(2031, 0, 0));
ok(yt.length === 4 && yt[0] === E.yearStartT(2000) && yt[3] === E.yearStartT(2030), 'decade ticks land on year starts');
doc.cal.weekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
doc.cal.weekStart = (((0 - E.toT(2024, 0, 0)) % 7) + 7) % 7; // 1 January 2024 was a Monday
eq(E.weekday(E.toT(2024, 1, 28)), 'Thursday', '29 February 2024 was a Thursday');

// festival days
doc = normDoc({ name: 'T', cal: { months: [{ name: 'Thaw', days: 30 }, { name: 'Midwinter', days: 1, inter: true }, { name: 'Bloom', days: 30 }], prefix: 'Year' } });
E.reset();
eq(E.fmt(E.toT(5, 1, 0)), 'Midwinter, Year 5', 'a festival day reads as its name');
// era-relative years
doc.eras = [{ id: 'e', parent: null, name: 'The Second Age', start: E.toT(22, 0, 0), end: E.toT(80, 0, 0), color: null }];
doc.cal.fmt.year = '{EY} {E}';
eq(E.fmt(E.toT(30, 0, 0)), '9 SA', 'era-relative year');
doc.cal.eraBase = 0;
eq(E.fmt(E.toT(30, 0, 0)), '8 SA', 'era years can start at 0');

// the sample world and its formats
doc = sampleDoc();
E.reset();
eq(E.fmt(E.toT(38, 0, 14)), '15 Thaw, Year 38', 'sample date');
eq(E.fmtRange({ t: E.toT(30, 0, 0), end: E.toT(44, 0, 0) }), 'Year 30–44', 'whole-year spans shorten');
eq(E.parseDateQuery('14 Frost 412'), E.toT(412, 9, 13), 'typed dates');
eq(E.parseDateQuery('-30'), E.toT(-30, 0, 0), 'typed years before zero');
ok(doc.events.some((e) => e.rel), 'the sample pins the Archive to the comet');
// a negative-year word in the format counts only as a word of its own, not inside a month name
const neg0 = doc.cal.fmt.yearNeg;
doc.cal.fmt.yearNeg = '{Y} BE';
eq(E.parseDateQuery('1 Ember 50'), E.toT(50, 6, 0), '"BE" inside "Ember" isn\'t the negative-year word');
eq(E.parseDateQuery('5 BE'), E.toT(-5, 0, 0), '"5 BE" is before zero');
eq(E.parseDateQuery('1 Ember 50 be'), E.toT(-50, 6, 0), 'lower case, after a date');
doc.cal.fmt.yearNeg = neg0;

// older files and hand-written calendars
const old = normCal({ dpm: 30, mpy: 12, months: ['A', 'B'], prefix: 'Cycle' });
ok(old.months.length === 12 && old.months[0].name === 'A' && old.units.year === 'cycle', 'older calendars upgrade');
const broken = normDoc({ events: [{ t: 5 }, { nope: true }], eras: 'x', range: [5, 1] });
ok(broken.events.length === 1 && broken.events[0].side === 'b' && broken.eras.length === 0 && broken.range[1] > broken.range[0], 'bad documents are repaired');

// importing a Fantasy-Calendar export
const fc = parseCalendarImport(JSON.stringify({ static_data: { year_data: { timespans: [{ name: 'Hammer', length: 30 }, { name: 'Midwinter', length: 1, type: 'intercalary' }], leap_days: [{ timespan: 0, interval: '4' }], global_week: ['One', 'Two'] } } }));
ok(typeof fc !== 'string' && fc.months.length === 2 && fc.months[1].inter && fc.leaps.length === 1 && fc.weekdays.length === 2, 'Fantasy-Calendar import');
ok(typeof parseCalendarImport('nope') === 'string', 'bad imports explain themselves');

done('calendar');
