import { makeEngine } from '../src/engine';
import { normDoc, PRESETS } from '../src/model';
import { dateFromProps, noteDateOf } from '../src/sync';
import type { Calendar, EvraDoc } from '../src/types';
import { done, eq, ok } from './harness';

// the Gregorian preset, as the calendar editor builds it
const P = PRESETS.gregorian;
const months = P.months.map(([name, days], i) => ({ id: 'm' + i, name, days }));
const doc: EvraDoc = normDoc({
	name: 'Leap', cal: { months, leaps: [{ id: 'l', month: months[P.leap.month].id, days: 1, every: P.leap.every, except: P.leap.except, unless: P.leap.unless }], weekdays: P.weekdays, prefix: 'Year' },
});
const E = makeEngine(() => doc);
const leapDay = E.toT(2024, 1, 28);
eq(E.fmt(leapDay), '29 February, Year 2024', 'the leap day exists');
doc.events = [{ id: 'e', t: leapDay, side: 'a', title: 'Leap', text: '', color: null, file: 'Leap' }];

// 1. a calendar edit that doesn't touch February keeps the leap day
const old = JSON.parse(JSON.stringify(doc.cal)) as Calendar;
doc.cal.months[2].name = 'Marchember';
doc.cal.months[11].days = 30;
E.reset();
E.remapDates(old, doc.cal);
eq(E.fmt(doc.events[0].t), '29 February, Year 2024', 'remapDates keeps 29 February');

// note properties don't clamp it to the 28th
doc.opts.sync.on = true;
doc.opts.sync.fields.day.on = true;
ok(dateFromProps({ 'timeline-year': 2024, 'timeline-month': 'February' }, doc, E, doc.events[0]) == null, 'a note matching the leap day doesn\'t move it');
ok(dateFromProps({ 'timeline-year': 2024, 'timeline-month': 'February', 'timeline-day': 29 }, doc, E, doc.events[0]) == null, 'the leap day with a day property');
const from2020 = { ...doc.events[0], t: E.toT(2020, 1, 28) };
const moved = dateFromProps({ 'timeline-year': 2024, 'timeline-month': 'February' }, doc, E, from2020);
eq(moved != null ? E.fmt(moved) : '', '29 February, Year 2024', 'moving a leap day to another leap year keeps it');
const to2023 = dateFromProps({ 'timeline-year': 2023, 'timeline-month': 'February' }, doc, E, doc.events[0]);
eq(to2023 != null ? E.fmt(to2023) : '', '28 February, Year 2023', 'moving it to a common year lands on the 28th');
eq(E.parseDateQuery('29 February 2024'), E.toT(2024, 1, 28), 'typed leap days aren\'t clamped');
eq(E.parseDateQuery('30 February 2024'), E.toT(2024, 1, 28), 'typed days past the month end are clamped to this year\'s length');

// pinned cards: where the anchor was last seen moves with the calendar, so the pin doesn't shift the card a second time
{
	const anchorT = E.toT(2030, 5, 10);
	doc.events = [
		{ id: 'anchor', t: anchorT, side: 'a', title: 'A', text: '', color: null, file: null },
		{ id: 'pinned', t: anchorT + 40, side: 'b', title: 'B', text: '', color: null, file: null, rel: { to: 'anchor', from: 'start', offset: 40, at: anchorT } },
	];
	const before = JSON.parse(JSON.stringify(doc.cal)) as Calendar;
	doc.cal.months[0].days = 40; // a longer January moves everything after it
	E.reset();
	E.remapDates(before, doc.cal);
	ok(doc.events[0].t !== anchorT, 'the anchor moved');
	eq(doc.events[1].rel.at, doc.events[0].t, 'rel.at follows the anchor');
}

// absurd years typed or read from notes are refused
eq(E.parseDateQuery('99999999999999999999'), null, 'a 20-digit typed year is refused');
eq(E.parseDateQuery('3 March 2000000000'), null, 'a typed year past a billion is refused');
ok(E.parseDateQuery('-1000000000') != null, 'a billion years back is fine');
eq(noteDateOf({ year: 1e20 }, doc, E), null, 'a note year of 1e20 is refused');
eq(noteDateOf({ year: '12345678901', date: '3 March 2000' }, doc, E), null, 'an absurd note year isn\'t replaced by the date');
ok(noteDateOf({ year: 2000 }, doc, E) === E.toT(2000, 0, 0), 'ordinary note years still work');
eq(dateFromProps({ 'timeline-year': 1e20 }, doc, E, doc.events[0]), null, 'an absurd year property doesn\'t move a card');

// facts about another calendar are computed once, not on every date conversion
{
	const other = JSON.parse(JSON.stringify(doc.cal)) as Calendar;
	const a = E.ci(other);
	E.partsC(E.toT(2024, 1, 28), other);
	ok(E.ci(other) === a && E.ci(other).lensCache.size > 0, 'calInfo is cached per calendar');
	ok(E.ci() !== a && E.ci(other) === a, 'the document\'s calendar and another are cached apart');
	E.reset();
	ok(E.ci(other) !== a, 'reset clears the cache');
}

// ISO-looking dates read as year-month-day
eq(E.parseDateQuery('2024-05-01'), E.toT(2024, 4, 0), 'ISO date');
eq(E.parseDateQuery(' 2024/05/01 '), E.toT(2024, 4, 0), 'slashed date');
eq(E.parseDateQuery('2024-05'), E.toT(2024, 4, 0), 'year and month');
eq(E.parseDateQuery('2024-02-29'), E.toT(2024, 1, 28), 'an ISO leap day');
eq(E.parseDateQuery('2023-02-31'), E.toT(2023, 1, 27), 'an ISO day past the month end is clamped');
eq(E.parseDateQuery('2024-05-01T10:30'), E.toT(2024, 4, 0), 'a time after the date is ignored');
eq(E.parseDateQuery('-44-03-15'), E.toT(-44, 2, 14), 'negative ISO years');
eq(E.parseDateQuery('2024-13-01'), null, 'month 13 is refused');
eq(E.parseDateQuery('2024-00-01'), null, 'month 0 is refused');
eq(noteDateOf({ date: '2024-05-01' }, doc, E), E.toT(2024, 4, 0), 'an ISO date property');
eq(E.parseDateQuery('-30'), E.toT(-30, 0, 0), 'a bare negative year is still a year');

done('leap');
