// Generates a large example world: thousands of linked notes and a timeline with dozens of nested eras.
//   npm run big-world [-- <folder>]    (default: test-vault/Aerth)
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { makeEngine } from '../src/engine';
import { normCal, normDoc } from '../src/model';
import type { Era, EvraDoc, EvraEvent } from '../src/types';

const root = process.argv[2] || 'test-vault/Aerth';
let seed = 20260929;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];
const int = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

/* ---------- names ---------- */
const SYL = ['ar', 'bel', 'cor', 'dra', 'el', 'fen', 'gal', 'hal', 'is', 'jor', 'kal', 'lor', 'mir', 'nor', 'or', 'pel', 'quin', 'ras', 'sel', 'tor', 'ul', 'var', 'wyn', 'yr', 'zan', 'ae', 'th', 'ven', 'dor', 'ith', 'mar', 'syl', 'kor', 'lin', 'vey', 'ost', 'ruk', 'ane'];
const used = new Set<string>();
function word(min = 2, max = 3) { let w = ''; const n = int(min, max); for (let i = 0; i < n; i++) w += pick(SYL); return cap(w); }
function unique(make: () => string) { for (let i = 0; i < 50; i++) { const n = make(); if (!used.has(n.toLowerCase())) { used.add(n.toLowerCase()); return n; } } const n = make() + ' ' + int(2, 99); used.add(n.toLowerCase()); return n; }

const TITLES = ['Queen', 'King', 'Archon', 'Warden', 'Magister', 'Lady', 'Lord', 'Sister', 'Captain', 'High Priest', 'Scholar', 'General', 'Envoy', 'Prince', 'Princess'];
const PLACE_KIND = ['city', 'fortress', 'river port', 'mountain hold', 'monastery', 'island', 'forest town', 'desert oasis', 'mining camp', 'lighthouse'];
const FACTION_KIND = ['guild', 'order', 'house', 'league', 'company', 'cult', 'council', 'clan'];
const ARTIFACT_KIND = ['blade', 'crown', 'codex', 'lantern', 'map', 'ring', 'banner', 'bell', 'mask', 'compass'];

interface Note { folder: string; name: string; body: string; props?: Record<string, string | number> }
const notes: Note[] = [];
const people: string[] = [], places: string[] = [], factions: string[] = [], artifacts: string[] = [];
for (let i = 0; i < 900; i++) people.push(unique(() => `${word(2, 2)} ${word(2, 3)}`));
for (let i = 0; i < 420; i++) places.push(unique(() => word(2, 3)));
for (let i = 0; i < 160; i++) factions.push(unique(() => `The ${cap(pick(['iron', 'pale', 'silver', 'amber', 'hollow', 'seventh', 'drowned', 'ashen', 'verdant', 'last']))} ${cap(pick(FACTION_KIND))}${rnd() < .4 ? ' of ' + word(2, 2) : ''}`));
for (let i = 0; i < 180; i++) artifacts.push(unique(() => `The ${word(2, 2)} ${cap(pick(ARTIFACT_KIND))}`));
const link = (n: string) => `[[${n}]]`;

/* ---------- the calendar: ten months, a festival week, leap days, a nine-day week ---------- */
const cal = normCal({
	months: [['Firstfrost', 36], ['Deepwinter', 36], ['Thawing', 36], ['Sowing', 36], ['Brightening', 36], ['Midsun', 36], ['Highharvest', 36], ['Reaping', 36], ['Emberfall', 36], ['Longnight', 36], ['The Five Lanterns', 5]].map(([name, days], i) => ({ id: 'm' + i, name, days, inter: i === 10 })),
	units: { day: 'day', month: 'month', year: 'year', years: 'years' },
	fmt: { year: '{EY} {E}', yearNeg: '{Y} BF', dateDay: '{D} {M}, {year}', circa: 'about {date}' },
	leaps: [{ id: 'l1', month: 'm10', days: 1, every: 4, except: 128, unless: 0, off: 0 }],
	weekdays: ['Oneday', 'Twoday', 'Threeday', 'Fourday', 'Fiveday', 'Sixday', 'Sevenday', 'Eightday', 'Ninthday'],
	yearStart: 0, eraBase: 1,
	second: { on: true, name: 'Elven reckoning', yearDays: 1460, offset: 0, fmt: '{Y} ER', onCards: false },
});
const doc0 = { cal, events: [], eras: [] } as unknown as EvraDoc;
const E = makeEngine(() => doc0);
const Y = (y: number, m = 0, d = 0) => E.toT(y, m, d);

/* ---------- eras: five ages, their reigns, and the wars and plagues inside those ---------- */
const eras: Era[] = [];
let eid = 0;
const color = () => pick(['1', '2', '3', '4', '5', '6']);
function era(name: string, a: number, b: number, parent: string | null, abbr?: string): Era {
	const e: Era = { id: 'e' + (++eid), parent, name, start: Y(a), end: Y(b), color: color(), ...(abbr ? { abbr } : {}) };
	eras.push(e);
	return e;
}
const AGES: [string, number, number, string][] = [['The Age of Founding', 0, 540, 'AF'], ['The Age of Crowns', 540, 1180, 'AC'], ['The Sundering', 1180, 1460, 'S'], ['The Age of Lanterns', 1460, 2210, 'AL'], ['The Long Dawn', 2210, 3000, 'LD']];
const REIGN_WORDS = ['Reign of', 'Dynasty of', 'Regency of', 'Stewardship of', 'Rule of'];
const INNER = ['War', 'Plague', 'Famine', 'Schism', 'Rebellion', 'Winter', 'Crusade', 'Exodus', 'Flood', 'Siege'];
for (const [name, a, b, abbr] of AGES) {
	const age = era(name, a, b, null, abbr);
	let y = a;
	while (y < b - 30) {
		const len = Math.min(b - y, int(70, 200));
		const reign = era(`${pick(REIGN_WORDS)} ${pick(people).split(' ')[1]}`, y, y + len, age.id);
		// one to three shorter eras inside each reign, sometimes with their own sub-era
		let iy = y + int(3, 20);
		for (let k = int(1, 3); k > 0 && iy < y + len - 12; k--) {
			const il = int(4, Math.min(30, y + len - iy - 2));
			const inner = era(`The ${word(2, 2)} ${pick(INNER)}`, iy, iy + il, reign.id);
			if (il > 12 && rnd() < .45) { const s = iy + int(1, 4); era(`${pick(['Siege of', 'Battle for', 'Fall of', 'Winter at'])} ${pick(places)}`, s, s + int(1, Math.max(1, Math.floor(il / 3))), inner.id); }
			iy += il + int(4, 25);
		}
		y += len;
	}
}

/* ---------- events and their notes ---------- */
const events: EvraEvent[] = [];
let vid = 0;
const ev = (o: Partial<EvraEvent>): EvraEvent => { const e: EvraEvent = { id: 'v' + (++vid).toString(36), t: 0, side: rnd() < .5 ? 'a' : 'b', title: '', text: '', color: null, file: null, ...o }; events.push(e); return e; };
const date = (y: number) => Y(y, int(0, 9), int(0, 35));
const sentence = () => pick([
	`${pick(people)} rode from ${link(pick(places))} with news that changed everything.`,
	`${link(pick(factions))} swore an oath before ${link(pick(people))} and broke it within a year.`,
	`The ${pick(ARTIFACT_KIND)} known as ${link(pick(artifacts))} was carried north.`,
	`Harvests failed across ${link(pick(places))}; the granaries of ${link(pick(places))} fed three provinces.`,
	`Chroniclers disagree on the date, but agree on the ash that fell for nine days.`,
	`A treaty was signed on the bridge at ${link(pick(places))}, halfway between both armies.`,
	`${link(pick(people))} wrote of it in a letter that survives only in fragments.`,
	`Pilgrims still leave lanterns at the spot each year during the Five Lanterns.`,
]);
const para = (n: number) => { const out = new Set<string>(); for (let i = 0; i < n * 4 && out.size < n; i++) { const x = sentence(), k = x.slice(0, 18); if (![...out].some((o) => o.startsWith(k))) out.add(x); } return [...out].join(' '); };

// people: lifespans, a quarter of them on the timeline
people.forEach((p, i) => {
	const born = int(0, 2920), died = born + int(28, 95), onLine = i % 4 === 0;
	notes.push({ folder: 'People', name: p, props: { born: born, died: died, ...(onLine ? {} : {}) }, body: `# ${p}\n${pick(TITLES)} of ${link(pick(places))}, sworn to ${link(pick(factions))}.\n\n${para(int(2, 5))}\n` });
	if (onLine) ev({ t: date(born), end: date(Math.min(2999, died)), file: `People/${p}`, life: true, color: '6', icon: rnd() < .2 ? '♛' : undefined, tags: ['person'] });
});
// places: founded dates
places.forEach((p, i) => {
	const y = int(0, 2900);
	notes.push({ folder: 'Places', name: p, props: { founded: y }, body: `# ${p}\nA ${pick(PLACE_KIND)} in the ${pick(['north', 'south', 'east', 'west', 'far reaches'])} of the realm.\n\n${para(int(2, 6))}\n` });
	if (i % 2 === 0) ev({ t: date(y), file: `Places/${p}`, color: '4', icon: '⌂', tags: ['founding'] });
});
// factions: active spans
factions.forEach((f) => {
	const a = int(0, 2800), b = a + int(40, 400);
	notes.push({ folder: 'Factions', name: f, body: `# ${f}\nFounded at ${link(pick(places))} by ${link(pick(people))}.\n\n${para(int(3, 6))}\n` });
	ev({ t: date(a), end: date(Math.min(2999, b)), file: `Factions/${f}`, color: '5', tags: ['faction'], ...(b > 2990 ? { oe: true } : {}), ...(rnd() < .15 ? { os: true } : {}) });
});
// artifacts: forged, sometimes approximate
artifacts.forEach((a) => {
	const y = int(0, 2950);
	notes.push({ folder: 'Artifacts', name: a, body: `# ${a}\nForged in ${link(pick(places))}. Last held by ${link(pick(people))}.\n\n${para(int(1, 4))}\n` });
	ev({ t: date(y), file: `Artifacts/${a}`, color: '3', icon: '✦', ...(rnd() < .5 ? { circa: 360 * int(1, 20) } : {}), tags: ['artifact'] });
});
// events: battles, treaties, coronations; one note each
const KINDS: [string, string, string][] = [['Battle of', '1', '⚔'], ['Treaty of', '4', '⚑'], ['Coronation at', '6', '♛'], ['Burning of', '2', '☄'], ['Founding of', '4', '⌂'], ['Plague in', '3', '☠'], ['Council of', '5', '✚'], ['Flood of', '5', '⚓']];
for (let i = 0; i < 1050; i++) {
	const [k, c, icon] = pick(KINDS), name = unique(() => `${k} ${pick(places)}`), y = int(1, 2990);
	const war = k === 'Battle of' ? 'war' : k === 'Plague in' ? 'plague' : k === 'Treaty of' ? 'peace' : 'event';
	notes.push({ folder: 'Events', name, props: { year: y }, body: `# ${name}\n${para(int(2, 5))}\n\nPresent: ${link(pick(people))}, ${link(pick(people))}.\n` });
	if (i % 7 !== 0) ev({ t: date(y), file: `Events/${name}`, color: c, icon, tags: [war] });
}
// plain cards without notes, written straight on the timeline
for (let i = 0; i < 220; i++) {
	const y = int(1, 2995);
	ev({ t: date(y), title: pick(['A comet over', 'Earthquake near', 'Market fire in', 'Twin births in', 'A white stag seen at', 'Riots in', 'The bells ring at']) + ' ' + pick(places), text: rnd() < .7 ? sentence().replace(/\[\[|\]\]/g, '') : '', color: rnd() < .5 ? color() : null });
}
// a few pinned cards: aftermaths that follow their battles
const battles = events.filter((e) => e.file && e.file.startsWith('Events/Battle'));
for (let i = 0; i < 25; i++) { const b = battles[i * 7]; if (!b) break; ev({ t: b.t + int(30, 700), title: 'Aftermath of ' + b.file.split('/')[1].replace('Battle of ', ''), text: 'The dead were counted for a season.', rel: { to: b.id, from: 'start' }, side: b.side, color: '1' }); }

/* ---------- write it ---------- */
const doc = normDoc({
	name: 'Chronicle of Aerth', cal, range: [0, 3000], orientation: 'ttb', cardWidth: 240, eras, events,
	now: Y(2604, 5, 11), lastView: [Y(1120), Y(1520)],
	views: [{ id: 'w1', name: 'The Sundering', a: Y(1170), b: Y(1470), x: 0 }, { id: 'w2', name: 'The whole chronicle', a: Y(0), b: Y(3000), x: 0 }],
});
doc.opts.groupOver = 3;
for (const f of ['People', 'Places', 'Factions', 'Artifacts', 'Events']) mkdirSync(`${root}/${f}`, { recursive: true });
for (const n of notes) {
	const fm = n.props ? `---\n${Object.entries(n.props).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n` : '';
	writeFileSync(`${root}/${n.folder}/${n.name}.md`, fm + n.body);
}
writeFileSync(`${root}/Chronicle of Aerth.evra`, JSON.stringify(doc, null, '\t'));
if (!existsSync(`${root}/About Aerth.md`)) writeFileSync(`${root}/About Aerth.md`, `# Aerth\nA generated world for trying Evra at scale: ${notes.length} notes, ${events.length} cards and ${eras.length} eras over three thousand years, on a calendar of ten months, a festival week and a nine-day week.\n\nOpen [[Chronicle of Aerth.evra]].\n\n\`\`\`evra\ntimeline: Chronicle of Aerth\nera: The Sundering\n\`\`\`\n`);
doc0.eras = eras;
console.log(`Aerth: ${notes.length} notes, ${events.length} cards, ${eras.length} eras, nested ${Math.max(...Object.values(E.eraDepths()))} deep, in ${root}`);
