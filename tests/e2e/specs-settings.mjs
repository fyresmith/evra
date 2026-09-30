// QA: the settings panel, calendar editing and robustness against bad files and random input.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';

const within = (pr, ms, what) => Promise.race([pr, new Promise((_, j) => setTimeout(() => j(new Error('HANG: ' + what + ' took over ' + ms + 'ms')), ms))]);
const make = (p, path, text) => p.ev(`app.vault.create(${JSON.stringify(path)}, ${JSON.stringify(text)}).then(() => 1)`);
const write = (p, path, text) => p.ev(`app.vault.modify(app.vault.getAbstractFileByPath(${JSON.stringify(path)}), ${JSON.stringify(text)}).then(() => 1)`);
const disk = async (p, path) => JSON.parse(await p.ev(`app.vault.adapter.read(${JSON.stringify(path)})`));
const setVal = (p, sel, v, evt = 'change') => p.ev(`(() => { const i = document.querySelector('${A} .sheet-body ${sel}'); if (!i) return 0; if (i.type === 'checkbox') i.checked = ${JSON.stringify(v)}; else i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('${evt}')); return 1; })()`).then(async (r) => { await p.sleep(200); return r; });
const clickSheet = async (p, h, sel) => { const b = await h.sheet(sel); if (!b) throw new h.Fail('not in the panel: ' + sel); await p.click(b.x, b.y); await p.sleep(220); };
const rulerText = (p) => p.ev(`document.querySelector('${A} .ruler').textContent`);
const cardDate = (p, title) => p.ev(`(() => { const c = document.querySelector('${A} .evra-card[aria-label^="${title}"] .dt'); return c ? c.textContent : null; })()`);
const undo = async (p, h) => { await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200); };
const minimal = (extra = {}) => JSON.stringify({ name: 'T', events: [{ t: 400, title: 'Hand written' }], ...extra });

/* ---------- calendar tab ---------- */
test('S1 every preset applies, keeps saved file in step, and undoes', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	const orig = await h.doc();
	for (const k of ['gregorian', 'earth', 'moons', 'seasons', 'years', 'twelve']) {
		await setVal(p, '[data-k=sPreset]', k);
		const d = await h.doc(), s = await h.saved();
		t.eq(JSON.stringify(s.cal.months.map((m) => [m.name, m.days])), JSON.stringify(d.cal.months.map((m) => [m.name, m.days])), k + ': saved matches');
		t.eq(s.events.length, orig.events.length, k + ': events kept');
		t.ok(s.events.every((e) => Number.isFinite(e.t)), k + ': dates finite');
	}
	for (let i = 0; i < 6; i++) await undo(p, h);
	const back = await h.doc();
	t.eq(JSON.stringify(back.cal.months), JSON.stringify(orig.cal.months), 'undo restores months');
	t.eq(back.events.map((e) => e.t).join(), orig.events.map((e) => e.t).join(), 'undo restores dates');
});
test('S2 month rename, days, festival, even, reorder by drag; card date follows', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	const before = await cardDate(p, 'Siege of the Keep begins');
	const n = await h.sheet('[data-name="9"]'); await p.click(n.x, n.y); await p.key('a', 'ctrl'); await p.type('Rimefall'); await p.key('Enter'); await p.sleep(300);
	const d = await h.doc(); t.eq(d.cal.months[9].name, 'Rimefall', 'renamed');
	t.eq((await h.saved()).cal.months[9].name, 'Rimefall', 'saved');
	const ev = await h.ev('Siege of the Keep begins');
	const after = await cardDate(p, 'Siege of the Keep begins');
	t.ok(before !== after || !/Frost/.test(before), `card date updates (${before} -> ${after})`);
	await undo(p, h);
	t.eq((await h.doc()).cal.months[9].name, 'Frost', 'rename undone');
	// invalid days
	await h.openSheet('calendar');
	await setVal(p, '[data-days="0"]', '0');
	t.eq((await h.doc()).cal.months[0].days, 30, 'zero days rejected');
	await setVal(p, '[data-days="0"]', '-5');
	t.eq((await h.doc()).cal.months[0].days, 30, 'negative days rejected');
	await setVal(p, '[data-days="0"]', 'abc');
	t.eq((await h.doc()).cal.months[0].days, 30, 'text rejected');
	await setVal(p, '[data-days="0"]', '31');
	t.eq((await h.doc()).cal.months[0].days, 31, 'days set');
	const e2 = await h.ev('Siege of the Keep begins');
	t.ok(e2.t !== ev.t, 'keep-dates remaps day counts');
	// make equal
	await clickSheet(p, h, '[data-k=mEven]');
	t.ok((await h.doc()).cal.months.every((m) => m.days === 30), 'even');
	// reorder via HTML5 drag events
	const names0 = (await h.doc()).cal.months.map((m) => m.name);
	await p.ev(`(() => { const rows = document.querySelectorAll('${A} .mrow'); const dt = new DataTransfer(); rows[0].dispatchEvent(new DragEvent('dragstart', {bubbles: true, dataTransfer: dt})); rows[2].dispatchEvent(new DragEvent('dragover', {bubbles: true, dataTransfer: dt, cancelable: true})); rows[2].dispatchEvent(new DragEvent('drop', {bubbles: true, dataTransfer: dt, cancelable: true})); return 1; })()`); await p.sleep(250);
	const names1 = (await h.doc()).cal.months.map((m) => m.name);
	t.eq(names1[2], names0[0], 'moved to 3rd'); t.eq(names1[0], names0[1], 'others shift');
	await undo(p, h);
	t.eq((await h.doc()).cal.months.map((m) => m.name).join(), names0.join(), 'reorder undone');
});
test('S3 removing a month that a leap rule uses', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await setVal(p, '[data-k=sPreset]', 'gregorian');
	const feb = (await h.doc()).cal.months[1].id;
	t.eq((await h.doc()).cal.leaps[0].month, feb, 'leap on Feb');
	await clickSheet(p, h, '[data-del="1"]');
	const d = await h.doc();
	t.eq(d.cal.months.length, 11, 'removed');
	t.ok(await p.ev(`document.querySelectorAll('${A} .ruler span').length > 0`), 'still draws');
	const s = await h.saved();
	t.ok(s.cal.leaps.every((l) => s.cal.months.some((m) => m.id === l.month)), 'no leap rule points at a missing month (got ' + JSON.stringify(s.cal.leaps.map((l) => l.month)) + ')');
});
test('S4 leap rules: add, edit, bad values, remove, undo', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await clickSheet(p, h, '[data-k=lpAdd]');
	let d = await h.doc(); t.eq(d.cal.leaps.length, 1, 'added');
	const id = d.cal.leaps[0].id;
	await setVal(p, `[data-lp="${id}"] [data-lk=every]`, '0');
	t.ok((await h.doc()).cal.leaps[0].every >= 1, 'every at least 1');
	await setVal(p, `[data-lp="${id}"] [data-lk=every]`, '4');
	await setVal(p, `[data-lp="${id}"] [data-lk=except]`, '10');
	t.ok(/multiple/.test(await h.toast()), 'warns on non-multiple');
	await setVal(p, `[data-lp="${id}"] [data-lk=days]`, '-3');
	t.ok((await h.doc()).cal.leaps[0].days >= 1, 'days at least 1');
	await setVal(p, `[data-lp="${id}"] [data-lk=every]`, '99999999999');
	d = await h.doc(); t.ok(Number.isFinite(d.cal.leaps[0].every), 'huge every ok');
	t.ok(await p.ev(`document.querySelectorAll('${A} .ruler span').length > 0`), 'still draws');
	await clickSheet(p, h, `[data-lpdel="${id}"]`);
	t.eq((await h.doc()).cal.leaps.length, 0, 'removed');
	await undo(p, h);
	t.eq((await h.doc()).cal.leaps.length, 1, 'undo');
});
test('S5 weekdays, week start, units, numbering, era base', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await setVal(p, '[data-k=wkNames]', 'A,B,,  ,C\nD');
	t.eq((await h.doc()).cal.weekdays.join('|'), 'A|B|C|D', 'weekdays parsed');
	await setVal(p, '[data-k=wkStart]', '3');
	t.eq((await h.doc()).cal.weekStart, 3, 'week start');
	await setVal(p, '[data-k=wkNames]', 'A,B');
	t.ok((await h.doc()).cal.weekStart <= 1, 'week start clamped');
	await setVal(p, '[data-k=wkNames]', '');
	t.eq((await h.doc()).cal.weekdays.length, 0, 'cleared');
	// unit blank falls back
	const u = await h.sheet('[data-k=uYear]'); await p.click(u.x, u.y); await p.key('a', 'ctrl'); await p.key('Backspace'); await p.key('Tab'); await p.sleep(250);
	t.eq((await h.doc()).cal.units.year, 'year', 'blank unit falls back');
	// numbering
	await setVal(p, '[data-k=sYs]', '-500');
	t.eq((await h.doc()).cal.yearStart, -500, 'negative start');
	t.ok(/-4\d\d|−4\d\d|4\d\d/.test(await rulerText(p)), 'ruler shows negative-based years: ' + (await rulerText(p)).slice(0, 80));
	await setVal(p, '[data-k=sYs]', '1e3');
	t.ok([1, 1000].includes((await h.doc()).cal.yearStart), 'exponent text');
	await setVal(p, '[data-k=sYs]', '100000000000000000000');
	const ys = (await h.doc()).cal.yearStart;
	t.ok(Math.abs(ys) <= 1e12, 'huge year start clamped (got ' + ys + ')');
	await setVal(p, '[data-k=sYs]', '0');
	await clickSheet(p, h, '[data-eb="0"]');
	t.eq((await h.doc()).cal.eraBase, 0, 'era base 0');
	await undo(p, h);
	t.eq((await h.doc()).cal.eraBase, 1, 'undo era base');
});
test('S6 second calendar: on, days, name, label, offset, on cards', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await setVal(p, '[data-k=s2on]', true);
	await setVal(p, '[data-k=s2days]', '0');
	t.ok((await h.doc()).cal.second.yearDays >= 1, 'days at least 1');
	await setVal(p, '[data-k=s2days]', '100');
	await setVal(p, '[data-k=s2fmt]', '<b>{Y}</b> SR');
	t.ok(!(await p.ev(`!!document.querySelector('${A} [data-r=ruler2] b, ${A} .evra-card .dt b')`)), 'label not rendered as HTML');
	t.ok(/<b>/.test(await p.ev(`document.querySelector('${A} [data-r=ruler2]').textContent`)), 'label shown as text');
	await setVal(p, '[data-k=s2cards]', false);
	t.eq((await h.doc()).cal.second.onCards, false, 'off cards');
	const s = await h.saved(); t.eq(s.cal.second.yearDays, 100, 'saved');
	await setVal(p, '[data-k=s2days]', '99999999999999999999');
	const s2 = await h.saved();
	t.ok(s2.cal.second.yearDays < 1e15, 'huge days kept sane: ' + s2.cal.second.yearDays);
	t.ok(await p.ev(`document.querySelectorAll('${A} [data-r=ruler2] span').length >= 0`), 'still draws');
});
test('S7 import: malformed inputs give a message and no exception', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	const months0 = JSON.stringify((await h.doc()).cal.months);
	const bad = ['', 'null', '42', '"str"', '[]', '{}', '{"static":{}}', '{"static":{"months":[]}}', '{"static":{"months":"x"}}',
		'{"static":{"months":[null]}}', '{"static":{"months":[{"name":"A","length":30}],"leapDays":{}}}', '{"static":{"months":[{"name":"A","length":30}],"leapDays":[null]}}',
		'{"static":{"months":[{"name":"A","length":30}],"weekdays":"Mon"}}', '{"static":{"months":[{"name":"A","length":30}],"leapDays":[{"interval":5,"timespan":0}]}}',
		'{"static":{"months":[{"name":"A","length":-4}, {"name":"<img src=x onerror=alert(1)>","length":1e20}]}}'];
	const res = [];
	for (const b of bad) {
		p.errors.length = 0;
		await setVal(p, '[data-k=impTxt]', b, 'input');
		await clickSheet(p, h, '[data-k=impGo]');
		const errs = p.errors.filter((e) => /exception|error/i.test(e));
		res.push([b, errs.length ? errs[0].slice(0, 100) : 'ok', await h.toast()]);
	}
	p.errors.length = 0;
	const failed = res.filter((r) => r[1] !== 'ok');
	t.ok(!failed.length, 'import threw for: ' + failed.map((r) => r[0] + ' => ' + r[1]).join(' ;; '));
	const d = await h.doc();
	t.ok(!(await p.ev(`!!document.querySelector('${A} img[src=x]')`)), 'no injected html');
	t.ok(d.cal.months.every((m) => m.days >= 1 && m.days < 1e9), 'imported days sane: ' + JSON.stringify(d.cal.months.map((m) => m.days)));
	void months0;
});
test('S8 import Fantasy-Calendar shape and undo', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	const fc = { static_data: { year_data: { timespans: [{ name: 'Hammer', length: 30, type: 'month' }, { name: 'Midwinter', length: 1, type: 'intercalary' }, { name: 'Alturiak', length: 30 }], leap_days: [{ timespan: 1, interval: '400,!100,4' }], global_week: ['A', 'B', 'C'] } } };
	await setVal(p, '[data-k=impTxt]', JSON.stringify(fc), 'input');
	await clickSheet(p, h, '[data-k=impGo]');
	const c = (await h.doc()).cal;
	t.eq(c.months.length, 3, 'months'); t.eq(c.weekdays.length, 3, 'week');
	t.eq(JSON.stringify(c.leaps.map((l) => [l.every, l.except, l.unless])), '[[4,100,400]]', 'leap intervals');
	const s = await h.saved(); t.eq(s.cal.months.length, 3, 'saved');
	await undo(p, h);
	t.eq((await h.doc()).cal.months.length, 12, 'undo import');
});

/* ---------- formats ---------- */
test('S9 formats: token chip inserts at cursor, every field saves, html escaped, undo', async (p, h, t) => {
	await h.open(); await h.openSheet('formats');
	const f = await h.sheet('[data-fmt=dateDay]'); await p.click(f.x, f.y); await p.key('a', 'ctrl'); await p.type('D:'); await p.sleep(100);
	const tok = await h.sheet('[data-tok="{Y}"]'); await p.click(tok.x, tok.y); await p.sleep(250);
	t.eq((await h.doc()).cal.fmt.dateDay, 'D:{Y}', 'chip inserted at cursor');
	const s = await h.saved(); t.eq(s.cal.fmt.dateDay, 'D:{Y}', 'saved');
	await undo(p, h);
	const back = (await h.doc()).cal.fmt.dateDay;
	t.ok(back !== 'D:{Y}', 'chip insert undoable (got ' + back + ')');
	await h.openSheet('formats');
	const y = await h.sheet('[data-fmt=year]'); await p.click(y.x, y.y); await p.key('a', 'ctrl'); await p.type('<i>{Y}</i>'); await p.key('Tab'); await p.sleep(300);
	t.ok(!(await p.ev(`!!document.querySelector('${A} .ruler i, ${A} .evra-card i, ${A} .prev i, ${A} .eralabels i')`)), 'format not rendered as html');
	t.ok(/<i>/.test(await rulerText(p)) || /<i>/.test(await p.ev(`document.querySelector('${A} .cards').textContent`)), 'format shows literally');
	await setVal(p, '[data-fmt=year]', '');
	t.ok(await p.ev(`document.querySelectorAll('${A} .ruler span').length > 0`), 'empty year format still draws');
	await setVal(p, '[data-fmt=year]', '{Nope} {Y}');
	await setVal(p, '[data-k=sShort]', true);
	t.eq((await h.doc()).cal.fmt.shortRange, true, 'short range');
	await clickSheet(p, h, '[data-k=fReset]');
	t.eq((await h.doc()).cal.fmt.year, '{U} {Y}', 'reset');
	await undo(p, h);
	t.eq((await h.doc()).cal.fmt.year, '{Nope} {Y}', 'reset undone');
});

/* ---------- timeline tab ---------- */
test('S10 range validation: reversed, empty, huge, fit', async (p, h, t) => {
	await h.open(); await h.openSheet('timeline');
	const r0 = (await h.doc()).range;
	await setVal(p, '[data-k=r1]', '-5');
	t.eq(JSON.stringify((await h.doc()).range), JSON.stringify(r0), 'reversed rejected');
	await setVal(p, '[data-k=r1]', '');
	t.eq(JSON.stringify((await h.doc()).range), JSON.stringify(r0), 'empty rejected');
	t.eq(await p.ev(`document.querySelector('${A} [data-k=r1]').value`), String(r0[1]), 'field restored');
	await setVal(p, '[data-k=r1]', '100000000000000000');
	const r = (await h.doc()).range;
	const s = await h.saved();
	t.eq(JSON.stringify(s.range), JSON.stringify(r), 'saved range matches live (live ' + JSON.stringify(r) + ')');
	t.ok(Math.abs(r[1]) * 360 < 1e15, 'range kept within the day limit: ' + r[1]);
	await clickSheet(p, h, '[data-k=rFit]');
	const f = (await h.doc()).range;
	t.ok(f[1] <= 81 && f[0] >= 0, 'fit: ' + JSON.stringify(f));
	await undo(p, h);
	t.eq(JSON.stringify((await h.doc()).range), JSON.stringify(r), 'fit undone');
});
test('S11 snapping, now set/go/clear/fade, eras toggles, all undoable', async (p, h, t) => {
	await h.open(); await h.openSheet('timeline');
	for (const k of ['d', 'm', 'y', 'auto']) { await clickSheet(p, h, `[data-snap=${k}]`); t.eq((await h.doc()).opts.snapTo, k, 'snap ' + k); }
	await clickSheet(p, h, '[data-k=nwSet]');
	const now = (await h.doc()).now; t.ok(Number.isFinite(now), 'now set');
	await clickSheet(p, h, '[data-k=nwGo]');
	await setVal(p, '[data-k=nwFade]', true); t.eq((await h.doc()).opts.fadeFuture, true, 'fade');
	await setVal(p, '[data-k=oBands]', false); t.eq((await h.doc()).opts.bands, false, 'bands');
	await setVal(p, '[data-k=oSub]', false); t.eq((await h.doc()).opts.subLabels, false, 'sub labels');
	await clickSheet(p, h, '[data-k=nwClr]'); t.ok((await h.doc()).now == null, 'cleared');
	const s = await h.saved(); t.ok(s.now == null && s.opts.bands === false, 'saved');
	for (let i = 0; i < 4; i++) await undo(p, h);
	const d = await h.doc();
	t.ok(d.now === now && d.opts.bands === true && d.opts.fadeFuture !== true, 'undo chain: ' + JSON.stringify([d.now, now, d.opts.bands, d.opts.fadeFuture]));
});
test('S12 now: invalid date fields are rejected', async (p, h, t) => {
	await h.open(); await h.openSheet('timeline');
	const ids = await p.ev(`[...document.querySelectorAll('${A} .sheet-body [data-d^=nw]')].map(e => e.dataset.d + ':' + e.tagName + ':' + e.type)`);
	t.ok(ids.length >= 1, 'date fields: ' + ids.join());
	await setVal(p, '[data-d=nwY]', 'abc');
	await clickSheet(p, h, '[data-k=nwSet]');
	const n1 = (await h.doc()).now;
	t.ok(n1 == null || Number.isFinite(n1), 'no NaN now: ' + n1);
	await setVal(p, '[data-d=nwY]', '99999999999999999');
	await clickSheet(p, h, '[data-k=nwSet]');
	const n2 = (await h.doc()).now;
	t.ok(n2 == null || Math.abs(n2) < 1e15, 'now within limits: ' + n2);
});
test('S13 exports copy text and name/direction change', async (p, h, t) => {
	await h.open(); await h.openSheet('timeline');
	await p.ev(`(() => { window.__clip = []; navigator.clipboard.writeText = async (s) => { window.__clip.push(s); }; return 1; })()`);
	for (const x of ['table', 'outline', 'file', 'embed']) await clickSheet(p, h, `[data-exp=${x}]`);
	const clip = await p.ev('window.__clip');
	t.eq(clip.length, 4, 'four copies');
	t.ok(/\|/.test(clip[0]), 'table'); t.ok(JSON.parse(clip[2]).events.length > 0, 'file is JSON');
	t.ok(/```evra/.test(clip[3]), 'embed');
	const n = await h.sheet('[data-k=tName]'); await p.click(n.x, n.y); await p.key('a', 'ctrl'); await p.type('   '); await p.key('Tab'); await p.sleep(200);
	t.eq((await h.doc()).name, 'Untitled', 'blank name');
	for (const o of ['ltr', 'rtl', 'btt', 'ttb']) { await clickSheet(p, h, `[data-o=${o}]`); t.eq((await h.doc()).orientation, o, o); }
	await undo(p, h);
	t.eq((await h.doc()).orientation, 'btt', 'direction undo');
});

/* ---------- cards & colors ---------- */
test('S14 width slider by keyboard is undoable; lines, spans, tint, grouping', async (p, h, t) => {
	await h.open(); await h.openSheet('cards');
	const w0 = (await h.doc()).cardWidth;
	const s = await h.sheet('[data-k=cw]'); await p.click(s.x, s.y); await p.sleep(150);
	const w1 = (await h.doc()).cardWidth;
	await p.key('ArrowRight'); await p.key('ArrowRight'); await p.sleep(200);
	const w2 = (await h.doc()).cardWidth;
	t.eq(w2, w1 + 20, 'arrows move the slider');
	t.eq((await h.saved()).cardWidth, w2, 'saved');
	const cw = await p.ev(`document.querySelector('${A} .evra-card').getBoundingClientRect().width`);
	t.ok(Math.abs(cw - w2) < 30, 'cards resized: ' + cw);
	await undo(p, h);
	t.eq((await h.doc()).cardWidth, w2 - 10, 'undo a single arrow step (got ' + (await h.doc()).cardWidth + ', start ' + w0 + ')');
	await h.openSheet('cards');
	await clickSheet(p, h, '[data-lines="0"]'); t.eq((await h.doc()).opts.cardLines, 0, 'lines none');
	await setVal(p, '[data-k=oTint]', false); t.eq((await h.doc()).opts.tint, false, 'tint');
	await clickSheet(p, h, '[data-grp="0"]'); t.eq((await h.doc()).opts.groupOver, 0, 'never group');
	await clickSheet(p, h, '[data-spans=blocks]'); await clickSheet(p, h, '[data-spans=threads]');
	t.eq((await h.doc()).opts.spanStyle, 'threads', 'spans');
});
test('S15 color picker by keyboard, names with html, delete last disabled', async (p, h, t) => {
	await h.open(); await h.openSheet('colors');
	// the picker's input: simulate the native picker via events, after a keyboard focus
	await p.ev(`(() => { const i = document.querySelector('${A} [data-pc="2"]'); i.focus(); i.value = '#112233'; i.dispatchEvent(new Event('input')); i.value = '#223344'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(250);
	t.eq((await h.doc()).palette[1].hex, '#223344', 'picked');
	t.eq((await h.saved()).palette[1].hex, '#223344', 'saved');
	await undo(p, h);
	t.eq((await h.doc()).palette[1].hex, null, 'one undo restores the theme colour');
	await h.openSheet('colors');
	const n = await h.sheet('[data-pn="3"]'); await p.click(n.x, n.y); await p.key('a', 'ctrl'); await p.type('<b>Gold</b>'); await p.key('Enter'); await p.sleep(250);
	t.eq((await h.doc()).palette[2].name, '<b>Gold</b>', 'named');
	t.ok(!(await p.ev(`!!document.querySelector('${A} b, .menu b')`)), 'not rendered as html');
	await setVal(p, '[data-ph="4"]', '#ABC');
	const hx = (await h.doc()).palette[3].hex; t.ok(hx === null || /^#[0-9a-f]{6}$/i.test(hx), 'short hex: ' + hx);
	// delete all but one
	for (let i = 0; i < 10; i++) { const b = await p.ev(`(() => { const b = document.querySelector('${A} [data-pdel]:not([disabled])'); if (!b) return 0; b.click(); return 1; })()`); await p.sleep(120); if (!b) break; }
	const d = await h.doc(); t.eq(d.palette.length, 1, 'one left');
	t.ok(d.events.every((e) => e.color == null || d.palette.some((x) => x.id === e.color)), 'no dangling colours');
	t.ok(d.eras.every((e) => e.color == null || d.palette.some((x) => x.id === e.color)), 'no dangling era colours');
});

/* ---------- robustness: files ---------- */
test('R1 non-object JSON files do not lose data or crash', async (p, h, t) => {
	const out = [];
	for (const [i, txt] of ['[]', '[1,2,3]', '42', '"hello"', 'null', 'true'].entries()) {
		p.errors.length = 0;
		const path = `NonObj${i}.evra`;
		await make(p, path, txt);
		await within(h.open(path), 8000, 'open ' + txt);
		const err = await p.ev(`!!document.querySelector('.workspace-leaf.mod-active .evra-error')`);
		await p.ev(`(async () => { const v = app.workspace.activeLeaf.view; if (v.save) await v.save(); })().then(() => 1)`); await p.sleep(200);
		const after = await p.ev(`app.vault.adapter.read(${JSON.stringify(path)})`);
		let ok = err ? after === txt : (() => { try { const j = JSON.parse(after); return j && typeof j === 'object' && !Array.isArray(j) && j.format === 'evra'; } catch { return false; } })();
		out.push(`${txt}: ${err ? 'error shown' : 'opened'}, file now ${after.slice(0, 40).replace(/\s+/g, ' ')} ${ok ? 'OK' : 'BAD'} ${p.errors.slice(0, 1).join('')}`);
	}
	p.errors.length = 0;
	t.ok(!out.some((x) => /BAD/.test(x)), out.join(' || '));
});
test('R2 wrong-typed fields are normalised and saved cleanly', async (p, h, t) => {
	const doc = { name: 5, cal: { months: [{ name: 7, days: 'x' }, null, 'Frost'], leaps: {}, weekdays: 'Mon', units: 3, fmt: 'x', second: [] }, palette: 'red', opts: [], range: 'x', orientation: 'up', cardWidth: 'wide', eras: [{ start: 0, end: 360, name: null, parent: 'zz' }, 'x'], events: [{ t: 10, title: 5, tags: 'x', people: {}, circa: -1, rel: 'x', end: 'y' }, { t: '20', title: 'str t' }, null, { t: NaN }], now: 'soon', views: {}, lastView: 7 };
	await make(p, 'Typed.evra', JSON.stringify(doc));
	await within(h.open('Typed.evra'), 8000, 'open');
	t.ok(!(await p.ev(`!!document.querySelector('.workspace-leaf.mod-active .evra-error')`)), 'opens');
	const s = await h.saved('Typed.evra');
	t.eq(typeof s.name, 'string', 'name'); t.ok(Array.isArray(s.cal.leaps) && Array.isArray(s.cal.weekdays), 'cal arrays');
	t.ok(!('tags' in s.events[0]) || Array.isArray(s.events[0].tags), 'tags');
	t.ok(s.events.every((e) => typeof e.t === 'number'), 'dates');
	await h.openSheet('calendar'); for (const tab of ['formats', 'timeline', 'cards', 'colors', 'notes']) await h.openSheet(tab);
	t.ok(await p.ev(`document.querySelector('${A} .sheet-body').children.length > 0`), 'panel works');
});
test('R3 huge and extreme numbers do not hang', async (p, h, t) => {
	const cases = [
		['Huge1', { name: 'H', events: [{ t: 1e20, title: 'far' }, { t: 100, title: 'near' }] }],
		['Huge2', { name: 'H', events: [{ t: 9e14, title: 'edge' }, { t: -9e14, title: 'edge2' }] }],
		['Huge3', { name: 'H', cal: { months: [{ name: 'A', days: 1e9 }] }, events: [{ t: 5, title: 'x' }] }],
		['Huge4', { name: 'H', range: [-1e12, 1e12], events: [{ t: 5, title: 'x' }] }],
		['Huge5', { name: 'H', cal: { yearStart: 1e12, months: [{ name: 'A', days: 1 }] }, events: [{ t: 5, title: 'x' }] }],
		['Huge6', { name: 'H', cardWidth: 1e9, opts: { groupOver: 1e300, cardLines: -1 }, events: [{ t: 5, title: 'x', circa: 1e14, end: 9.9e14 }] }],
		['Neg', { name: 'N', events: [{ t: -360 * 5000, title: 'long ago' }, { t: -1, title: 'just before' }], eras: [{ name: 'Old', start: -360 * 6000, end: -360 * 10 }] }],
	];
	for (const [n, d] of cases) {
		p.errors.length = 0;
		await make(p, n + '.evra', JSON.stringify(d));
		await within(h.open(n + '.evra'), 10000, 'open ' + n);
		await within(p.ev(`(async () => { const s = document.querySelector('${A} .stage'); for (let i = 0; i < 5; i++) { s.dispatchEvent(new WheelEvent('wheel', {deltaY: -300, ctrlKey: true, clientX: 300, clientY: 300, bubbles: true})); await new Promise(r => setTimeout(r, 50)); } for (let i = 0; i < 12; i++) { s.dispatchEvent(new WheelEvent('wheel', {deltaY: 400, ctrlKey: true, clientX: 300, clientY: 300, bubbles: true})); await new Promise(r => setTimeout(r, 50)); } return 1; })()`), 10000, 'zoom ' + n);
		await within(h.openSheet('timeline'), 8000, 'panel ' + n);
		const s = await within(h.saved(n + '.evra'), 8000, 'save ' + n);
		t.ok(s.events.every((e) => Math.abs(e.t) < 1e15), n + ': saved dates within limit');
		const bad = p.errors.filter((e) => !/ERR_|net::|DevTools|favicon|Failed to load/.test(e));
		t.ok(!bad.length, n + ': errors ' + bad.slice(0, 2).join(' ; '));
		if (n === 'Neg') { t.ok(/-|−/.test(await rulerText(p)), 'negative years on the ruler'); }
	}
});
test('R4 html in titles, era names, month names, units is escaped', async (p, h, t) => {
	const x = '<img src=x onerror="window.__xss=1"><b>bold</b>';
	const d = { name: x, cal: { months: [{ name: x, days: 30 }, { name: 'B', days: 30 }], units: { day: x, month: x, year: x, years: x }, weekdays: [x] }, palette: [{ id: '1', name: x, hex: '#ff0000' }], eras: [{ name: x, start: 0, end: 600, abbr: x, color: '1' }], events: [{ t: 10, title: x, text: x, tags: [x], color: '1' }, { t: 40, end: 400, title: x, file: x }] };
	await make(p, 'Xss.evra', JSON.stringify(d));
	await h.open('Xss.evra');
	for (const tab of ['calendar', 'formats', 'timeline', 'cards', 'colors', 'notes']) await h.openSheet(tab);
	await p.key('Escape');
	const c = await h.card('<img', '[data-act=menu]'); if (c) { await p.click(c.x, c.y); await p.sleep(300); }
	await p.sleep(300);
	t.ok(!(await p.ev('!!window.__xss')), 'no script ran');
	t.ok(!(await p.ev(`!!document.querySelector('${A} img[src=x], ${A} b, .menu img[src=x]')`)), 'no injected elements');
});
test('R5 external edits to an open file are picked up', async (p, h, t) => {
	await h.open();
	const s = await h.saved();
	s.events[0].title = 'Edited outside'; s.cal.months[0].name = 'Outmonth';
	await write(p, 'Chronicle of Veld.evra', JSON.stringify(s)); await p.sleep(800);
	t.ok(await h.card('Edited outside'), 'card updated');
	t.eq((await h.doc()).cal.months[0].name, 'Outmonth', 'calendar updated');
	// garbage written externally
	await write(p, 'Chronicle of Veld.evra', '{ broken'); await p.sleep(800);
	const txt = await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`);
	t.eq(txt, '{ broken', 'broken external edit not overwritten');
	// then fixed
	await write(p, 'Chronicle of Veld.evra', JSON.stringify(s)); await p.sleep(800);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card')`), 'recovers after fix');
	// external edit while panel open
	await h.openSheet('calendar');
	s.cal.months[1].name = 'Outmonth2';
	await write(p, 'Chronicle of Veld.evra', JSON.stringify(s)); await p.sleep(800);
	t.eq(await p.ev(`document.querySelector('${A} [data-name="1"]') && document.querySelector('${A} [data-name="1"]').value`), 'Outmonth2', 'panel shows the new value');
});
test('R6 open/close repeatedly leaves no errors and no leaks', async (p, h, t) => {
	const n0 = await p.ev(`document.querySelectorAll('.evra-root').length`);
	for (let i = 0; i < 12; i++) {
		await p.ev(`app.workspace.getLeaf(${i % 2 ? 'true' : 'false'}).openFile(app.vault.getAbstractFileByPath('Chronicle of Veld.evra')).then(() => 1)`); await p.sleep(150);
		if (i % 3 === 0) { await p.ev(`app.workspace.activeLeaf.detach()`); await p.sleep(100); }
	}
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(300);
	t.eq(await p.ev(`document.querySelectorAll('.evra-root').length`), n0, 'roots removed');
	const s = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	t.ok(s.events.length > 5, 'file intact');
});
test('R7 resizing, including tiny windows', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	for (const [w, hh] of [[320, 480], [200, 200], [120, 90], [1, 1], [900, 300], [1440, 900]]) {
		await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: 1, mobile: false }); await p.sleep(400);
		await p.ev(`(() => { const s = document.querySelector('${A} .stage'); if (s) s.dispatchEvent(new WheelEvent('wheel', {deltaY: 100, bubbles: true})); return 1; })()`); await p.sleep(150);
	}
	await p.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false }); await p.sleep(400);
	t.ok(await p.ev(`document.querySelectorAll('${A} .evra-card').length > 0`), 'cards after resizing');
	const vs = await p.ev(`JSON.stringify(${h.tl}.getViewState ? ${h.tl}.getViewState() : {})`);
	t.ok(!/NaN|null|Infinity/.test(vs), 'view state finite: ' + vs);
	const s = await h.saved(); t.ok(!/NaN/.test(JSON.stringify(s)) && Array.isArray(s.lastView ?? []), 'saved finite');
	t.ok((s.lastView ?? [0, 1]).every(Number.isFinite), 'lastView finite: ' + JSON.stringify(s.lastView));
});
test('R8 monkey: hundreds of random inputs leave a valid document and no errors', async (p, h, t) => {
	await h.open();
	let seed = 12345; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
	const s = await h.stage();
	const pt = () => [s.l + 5 + rnd() * (s.w - 10), s.t + 5 + rnd() * (s.h - 10)];
	const keys = ['j', 'k', 'e', 's', 'n', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Escape', 'Enter', '1', '5', '0', '+', '-', 'Tab', 'z', 'f', 'Backspace', '/', '.', '?'];
	const log = [];
	for (let i = 0; i < 300; i++) {
		const r = rnd(), [x, y] = pt();
		let a;
		if (r < 0.25) { a = 'click'; await p.click(x, y); }
		else if (r < 0.35) { a = 'dbl'; await p.dbl(x, y); }
		else if (r < 0.5) { a = 'drag'; const [x2, y2] = pt(); await p.drag(x, y, x2, y2, 5); }
		else if (r < 0.62) { a = 'wheel'; await p.wheel(x, y, (rnd() - 0.5) * 800, rnd() < 0.4); }
		else if (r < 0.9) { const k = keys[Math.floor(rnd() * keys.length)]; const m = rnd() < 0.15 ? ['ctrl'] : rnd() < 0.1 ? ['shift'] : []; a = 'key ' + k + m; await p.key(k, ...m); }
		else if (r < 0.95) { a = 'right'; await p.right(x, y); }
		else { a = 'type'; await p.type('ab'); }
		log.push(a);
		if (p.errors.length) { t.ok(false, `error after step ${i} (${log.slice(-5).join(', ')}): ${p.errors[0].slice(0, 200)}`); }
		// keep the timeline in front
		if (i % 25 === 0) await p.ev(`(() => { document.querySelectorAll('.modal-close-button').forEach(b => b.click()); const l = app.workspace.getLeavesOfType('evra')[0]; if (l && app.workspace.activeLeaf !== l) app.workspace.setActiveLeaf(l, {focus: true}); return 1; })()`);
	}
	await p.key('Escape'); await p.key('Escape'); await p.sleep(300);
	await p.ev(`(() => { document.querySelectorAll('.modal-close-button').forEach(b => b.click()); const l = app.workspace.getLeavesOfType('evra')[0]; app.workspace.setActiveLeaf(l, {focus: true}); return 1; })()`); await p.sleep(200);
	const d = await h.saved();
	t.ok(d.format === 'evra' && Array.isArray(d.events), 'valid doc');
	t.ok(d.events.every((e) => Number.isFinite(e.t) && (e.end == null || e.end > e.t) && typeof e.title === 'string'), 'events valid');
	t.ok(d.eras.every((e) => Number.isFinite(e.start) && e.end > e.start), 'eras valid');
	t.ok(d.range[1] > d.range[0], 'range valid');
});
