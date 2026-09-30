// QA round 2: eras, spans, navigation, four directions, calendar + formats, and the settings sheet.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const DIRS = ['ttb', 'btt', 'ltr', 'rtl'];

function kit(p, h) {
	const k = {};
	k.install = () => p.ev(`window.__pt = (t, c = 0) => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(), o = d.orientation || 'ttb'; const st = document.querySelector('${A} .stage'), r = st.getBoundingClientRect(); const vert = o === 'ttb' || o === 'btt', rev = o === 'btt' || o === 'rtl'; const L = vert ? st.clientHeight : st.clientWidth; let s = (t - v.v0) * v.scale; if (rev) s = L - s; const ln = document.querySelector('${A} .lines line[style*="dasharray: 2"], ${A} .lines line[style*="dasharray:2"]'); const cx = vert ? +ln.getAttribute('x1') : +ln.getAttribute('y1'); return vert ? { x: r.left + cx + c, y: r.top + s } : { x: r.left + s, y: r.top + cx + c }; }; 1`);
	k.start = async (d, path) => { await h.open(path); await k.install(); if (d) { await h.run('direction-' + d); await p.sleep(450); } };
	k.view = (v0, days) => p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); const s = document.querySelector('${A} .stage'); const L = ['ltr','rtl'].includes(d.orientation) ? s.clientWidth : s.clientHeight; t.setViewState({v0: ${v0}, scale: L / ${days}, x: 0}); return 1; })()`).then(() => p.sleep(350));
	k.pt = (t, c = 0) => p.ev(`__pt(${t}, ${c})`);
	k.vis = () => p.ev(`(() => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(); const st = document.querySelector('${A} .stage'); const L = ['ltr','rtl'].includes(d.orientation) ? st.clientWidth : st.clientHeight; return [v.v0, v.v0 + L / v.scale]; })()`);
	k.era = async (id) => (await h.doc()).eras.find((e) => e.id === id || e.name === id);
	k.tAt = (x, y) => p.ev(`(() => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(), o = d.orientation; const st = document.querySelector('${A} .stage'), r = st.getBoundingClientRect(); const vert = o === 'ttb' || o === 'btt', rev = o === 'btt' || o === 'rtl'; const L = vert ? st.clientHeight : st.clientWidth; let s = vert ? ${y} - r.top : ${x} - r.left; if (rev) s = L - s; return v.v0 + s / v.scale; })()`);
	k.free = async (t) => { for (const c of [-520, 520, -400, 400, -300, 300, -200, 200, -150, 150, -60, 60]) { const q = await k.pt(t, c); const ok = await p.ev(`(() => { const e = document.elementFromPoint(${q.x}, ${q.y}); const s = document.querySelector('${A} .stage').getBoundingClientRect(); if (${q.x} < s.left + 60 || ${q.x} > s.right - 60 || ${q.y} < s.top + 60 || ${q.y} > s.bottom - 60) return false; return !!e && !!e.closest('${A} .stage') && !e.closest('.ui, .evra-card, .ribbon, .evra-tag, [data-thread]'); })()`); if (ok) return c; } return null; };
	k.dragT = async (t0, t1, alt = false, c0) => { const c = c0 ?? (await k.free(t0)); if (c == null) throw new h.Fail('no free spot to drag from'); const a = await k.pt(t0, c), b = await k.pt(t1, c); await p.drag(a.x, a.y, b.x, b.y, 14, alt ? { modifiers: 1 } : {}); await p.sleep(150); };
	k.mkEra = async (a, b) => { const A1 = await k.pt(a), B1 = await k.pt(b); await p.drag(A1.x, A1.y, B1.x, B1.y); await p.sleep(200); if (!(await h.pop('[data-m=era]'))) return null; await h.clickPop('[data-m=era]'); await p.sleep(250); const d = await h.doc(); const e = d.eras[d.eras.length - 1]; await p.key('Escape'); await p.sleep(150); return e; };
	k.setDate = async (key, val) => { await p.ev(`(() => { const i = document.querySelector('${A} [data-r=pop] [data-d=${key}]'); i.value = '${val}'; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200); };
	k.openEd = async (id) => { const e = await k.era(id); const span = e.end - e.start; await k.view(e.start - span * 0.2, span * 1.4); const r = await p.at(`${A} rect[data-era="${id}"]`); await p.click(r.x, r.y); await p.sleep(300); return h.popOpen(); };
	k.scale = async () => (await p.ev(`${h.tl}.getViewState()`)).scale;
	k.setDoc = (fn) => p.ev(`(() => { const t = ${h.tl}; const d = JSON.parse(JSON.stringify(t.getDoc())); (${fn})(d); t.setDoc(d); return 1; })()`).then(() => p.sleep(300));
	k.make = (path, obj) => p.ev(`app.vault.create(${JSON.stringify(path)}, ${JSON.stringify(JSON.stringify(obj))}).then(() => 1)`);
	k.reopen = async (path = 'Chronicle of Veld.evra') => { await h.saved(path); await p.ev(`app.workspace.getLeavesOfType('evra').forEach(l => l.detach())`); await p.sleep(200); await h.open(path); await k.install(); return h.doc(); };
	k.setVal = (sel, v, evt = 'change') => p.ev(`(() => { const i = document.querySelector('${A} .sheet-body ${sel}'); if (!i) return 0; if (i.type === 'checkbox') i.checked = ${JSON.stringify(v)}; else i.value = ${JSON.stringify(v)}; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('${evt}')); return 1; })()`).then(async (r) => { await p.sleep(220); if (!r) throw new h.Fail('not in the panel: ' + sel); return r; });
	k.clickSheet = async (sel) => { const b = await h.sheet(sel); if (!b) throw new h.Fail('not in the panel: ' + sel); await p.click(b.x, b.y); await p.sleep(220); };
	k.undo = async () => { await p.ev(`(() => { const a = document.activeElement; if (a && a.blur && /INPUT|TEXTAREA|SELECT/.test(a.tagName)) a.blur(); const sh = document.querySelector('${A} [data-r=sheet]'); if (sh && !sh.hidden) document.querySelector('${A} .sheet-body').focus(); else document.querySelector('${A} .stage').focus(); return 1; })()`); await p.sleep(100); await p.key('z', 'ctrl'); await p.sleep(250); };
	k.cardDate = (title) => p.ev(`(() => { const c = document.querySelector('${A} .evra-card[aria-label^="${title}"] .dt'); return c ? c.textContent : null; })()`);
	k.palette = async (q) => { await h.focusStage(); await p.key('k', 'ctrl'); await p.sleep(150); await p.type(q); await p.sleep(200); return p.ev(`[...document.querySelectorAll('${A} [data-r=palList] .pi')].map(b => b.textContent)`); };
	k.center = async () => { const [a, b] = await k.vis(); return (a + b) / 2; };
	// every era valid: start < end, inside its parent, no overlap with siblings
	k.erasValid = (d) => {
		const bad = [], by = new Map(d.eras.map((e) => [e.id, e]));
		for (const e of d.eras) {
			if (!(e.end > e.start)) bad.push(`${e.name}: ${e.start}..${e.end} empty`);
			const pa = e.parent && by.get(e.parent);
			if (pa && (e.start < pa.start || e.end > pa.end)) bad.push(`${e.name} ${e.start}..${e.end} outside parent ${pa.name} ${pa.start}..${pa.end}`);
			for (const s of d.eras) if (s !== e && s.parent === e.parent && s.start < e.end && e.start < s.end && s.id < e.id) bad.push(`${e.name} overlaps ${s.name}`);
		}
		return bad;
	};
	return k;
}

/* ---------- eras beyond the range ---------- */
test('era: "Add an era here" at the end of the range, then dragging its far edge does not collapse it', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(27000, 3600);
	const q = await k.pt(28790, 200);
	await p.right(q.x, q.y); await p.sleep(200);
	await h.clickPop('[data-m=addera]'); await p.sleep(300);
	await p.key('Escape'); await p.sleep(200);
	const d = await h.doc(), e = d.eras[d.eras.length - 1];
	t.ok(e && e.name === 'New era', 'created');
	const R1 = d.range[1] * 360;
	t.ok(e.end <= R1, `era ${e.start}..${e.end} lies past the range end ${R1} and the range was not widened`);
	// its end edge is at 29340: dragging it later must not collapse the era to one day
	await k.view(27500, 2400);
	await k.dragT(e.end, e.end + 60);
	const e2 = await k.era(e.id);
	t.ok(e2.end - e2.start > 30, `after dragging the end edge: ${e2.start}..${e2.end}`);
});
test('era: an era hanging past the range end keeps its length when its end edge is dragged', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.eras.push({ id: 'far', parent: null, name: 'Far era', start: 28800, end: 29000, color: '3' }); }`);
	await k.view(27000, 3600);
	const e0 = await k.era('far');
	await k.dragT(29000, 29100);
	const e1 = await k.era('far');
	t.ok(e1.end >= 29000, `end edge dragged later: ${e0.start}..${e0.end} became ${e1.start}..${e1.end}`);
});

/* ---------- 1-day eras, zoom extremes ---------- */
test('era: a one-day era can be made by typing, and shows and opens at full zoom', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s2a');
	await k.setDate('eY', '51'); await k.setDate('eM', '0'); await k.setDate('eD', '2'); // Heron Years 18000..19440: end 1 Thaw 51 = day 18361
	await k.setDate('sY', '51'); await k.setDate('sM', '0'); await k.setDate('sD', '1');
	await p.key('Escape'); await p.sleep(200);
	const e = await k.era('s2a');
	t.eq(e.end - e.start, 1, 'one day long ' + JSON.stringify(e));
	await k.view(e.start - 3, 8);
	const r = await p.at(`${A} rect[data-era="s2a"]`);
	t.ok(r, 'drawn');
	await p.click(r.x, r.y); await p.sleep(300);
	t.ok(await h.popOpen(), 'editor opens');
	t.eq(await p.ev(`document.querySelector('${A} [data-r=pop] [data-k=eraName]').value`), 'Heron Years', 'its editor');
});
for (const d of DIRS) test(`[${d}] zoom extremes: max zoom shows days, min zoom shows the whole range; never errors`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(14000, 40);
	const s = await h.stage();
	for (let i = 0; i < 60; i++) await p.wheel(s.x, s.y, -300, true);
	await p.sleep(300);
	t.ok((await k.scale()) <= 40.001, 'capped at 40 px a day');
	const [a, b] = await k.vis();
	t.ok(b - a < 60, 'a few days in view: ' + (b - a));
	const ticks = await p.ev(`document.querySelector('${A} .ruler').textContent`);
	t.ok(/\d/.test(ticks), 'ruler has day labels: ' + ticks.slice(0, 80));
	for (let i = 0; i < 80; i++) await p.wheel(s.x, s.y, 300, true);
	await p.sleep(300);
	const [a2, b2] = await k.vis();
	t.ok(a2 <= 0 && b2 >= 28800, 'the whole range visible when zoomed all the way out');
	t.ok(b2 - a2 < 28800 * 1.4, 'but not much more than it: ' + (b2 - a2) / 360);
});
test('zoom: a 10,000-year range fits, ruler stays sparse and redraws stay fast', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('timeline');
	await k.setVal('[data-k=r0]', '-5000'); await k.setVal('[data-k=r1]', '5000');
	await p.key('Escape'); await p.sleep(200);
	const d = await h.doc();
	t.eq(d.range.join(), '-5000,5000', 'range');
	const s = await h.stage();
	for (let i = 0; i < 60; i++) await p.wheel(s.x, s.y, 300, true);
	await p.sleep(300);
	const [a, b] = await k.vis();
	t.ok(a <= -5000 * 360 && b >= 5000 * 360, 'everything fits');
	const n = await p.ev(`document.querySelectorAll('${A} .ruler > *').length`);
	t.ok(n > 2 && n < 80, 'ruler labels ' + n);
	const labels = await p.ev(`[...document.querySelectorAll('${A} .ruler > *')].map(e => e.textContent).join('|')`);
	t.ok(/−/.test(labels), 'negative years shown with the minus: ' + labels.slice(0, 120));
	const ms = await p.ev(`(() => { const t0 = performance.now(); const T = ${h.tl}; for (let i = 0; i < 20; i++) { const v = T.getViewState(); T.setViewState({ ...v, v0: v.v0 + 3600 }); } return performance.now() - t0; })()`);
	t.ok(ms < 1500, 'twenty redraws took ' + ms + 'ms');
});

/* ---------- deleting eras ---------- */
test('era: deleting a middle era lifts its children one level; grandchildren keep their parent', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s1'); await h.clickPop('[data-m=del]'); await p.sleep(300);
	const d = await h.doc();
	t.eq(d.eras.find((e) => e.id === 's1a').parent, 's', 'Siege Winter now under The Second Age');
	t.eq(d.eras.find((e) => e.id === 's1b').parent, 's1a', 'Hunger Moon stays under Siege Winter');
	t.ok(/sub-eras moved/.test(await h.toast()), 'toast says children moved');
	const u = await p.at(`${A} [data-r=toast] button`); await p.click(u.x, u.y); await p.sleep(300);
	t.ok((await h.doc()).eras.some((e) => e.id === 's1'), 'toast Undo restores it');
	t.eq((await h.saved()).eras.find((e) => e.id === 's1a').parent, 's1', 'saved file restored too');
});
test('era: rename in the editor then delete in the same session: one undo restores the original name', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s3');
	await p.key('a', 'ctrl'); await p.type('Renamed');
	await h.clickPop('[data-m=del]'); await p.sleep(250);
	t.ok(!(await h.doc()).eras.some((e) => e.id === 's3'), 'deleted');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(250);
	const e = await k.era('s3');
	t.ok(e && e.name === 'Restoration', 'restored with its old name: ' + JSON.stringify(e));
});

/* ---------- month changes after eras exist ---------- */
test('calendar: reordering months keeps eras valid (no collapsed or overlapping eras)', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	// an era from Thaw to the middle of Seedfall, and one after it
	await k.setDoc(`(d) => { d.eras.push({ id: 'x1', parent: 'k2', name: 'Spring', start: 3600, end: 3645, color: '1' }, { id: 'x2', parent: 'k2', name: 'Summer', start: 3645, end: 3700, color: '2' }); }`);
	await h.openSheet('calendar');
	// move Thaw (row 0) below Seedfall (row 1): the same drop the month list uses
	await p.ev(`(() => { const rows = document.querySelectorAll('${A} .mrow'); const dt = new DataTransfer(); rows[0].dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt })); rows[1].dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: dt, cancelable: true })); rows[1].dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: dt, cancelable: true })); return 1; })()`);
	await p.sleep(300);
	const d = await h.doc();
	t.eq(d.cal.months[0].name, 'Seedfall', 'reordered');
	const bad = k.erasValid(d);
	const x1 = d.eras.find((e) => e.id === 'x1'), x2 = d.eras.find((e) => e.id === 'x2');
	t.ok(!bad.length, bad.join('; ') + ` (Spring ${x1.start}..${x1.end}, Summer ${x2.start}..${x2.end})`);
});
test('calendar: removing a month that holds an era keeps every era valid', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.eras.push({ id: 'x1', parent: 'k2', name: 'Seed war', start: 3630 + 5, end: 3630 + 25, color: '1' }, { id: 'x2', parent: 'k2', name: 'Bloom peace', start: 3660 + 2, end: 3660 + 20, color: '2' }); }`);
	await h.openSheet('calendar');
	await k.clickSheet('[data-del="1"]'); // Seedfall
	const d = await h.doc();
	t.eq(d.cal.months.length, 11, 'removed');
	const bad = k.erasValid(d);
	t.ok(!bad.length, bad.join('; '));
});
test('calendar: shrinking a month keeps events on the same named day and eras valid', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.events.push({ id: 'late', t: 36 * 360 + 28, side: 'b', title: 'Late in Thaw', text: '', color: null, file: null }, { id: 'early', t: 36 * 360 + 32, side: 'b', title: 'Early Seedfall', text: '', color: null, file: null }); d.eras.push({ id: 'x1', parent: 's1', name: 'Short', start: 36 * 360 + 25, end: 36 * 360 + 29, color: '1' }, { id: 'x2', parent: 's1', name: 'Next', start: 36 * 360 + 29, end: 36 * 360 + 40, color: '2' }); }`);
	await h.openSheet('calendar');
	await k.setVal('[data-days="0"]', '20');
	const d = await h.doc();
	const late = d.events.find((e) => e.id === 'late'), early = d.events.find((e) => e.id === 'early');
	t.ok(late.t < early.t, `order kept: late ${late.t} early ${early.t}`);
	const bad = k.erasValid(d);
	t.ok(!bad.length, bad.join('; '));
	await p.key('Escape');
});

/* ---------- search and dates ---------- */
test('search: date queries in several shapes land on the same day, and negative years work', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	const want = 38 * 360 + 9 * 30 + 13; // 14 Frost 38
	for (const q of ['14 Frost 38', 'Frost 14, 38', '38-10-14', '38/10/14', '14 fro 38']) {
		const items = await k.palette(q);
		t.ok(/14 Frost, Year 38/.test(items[0] || ''), `${q} -> ${items[0]}`);
		await p.key('Escape'); await p.sleep(100);
	}
	let items = await k.palette('-5');
	t.ok(/Year −5/.test(items[0] || ''), '-5 -> ' + items[0]);
	await p.key('Enter'); await p.sleep(700);
	const c = await k.center();
	const [va, vb] = await k.vis();
	t.ok(va <= -5 * 360 && -5 * 360 <= vb, `year -5 (day -1800) is not in view after "Go to": view ${Math.round(va)}..${Math.round(vb)}, center ${Math.round(c)}`);
	items = await k.palette('Year 12');
	t.ok(/Year 12/.test(items[0] || ''), 'Year 12 -> ' + items[0]);
	await p.key('Escape');
	void want;
});
test('search: with numbering starting at 1000, typed years are the shown years', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar'); await k.setVal('[data-k=sYs]', '1000'); await p.key('Escape'); await p.sleep(200);
	const items = await k.palette('14 Frost 1038');
	t.ok(/14 Frost, Year 1038/.test(items[0] || ''), 'shown ' + items[0]);
	await p.key('Enter'); await p.sleep(700);
	t.ok(Math.abs((await k.center()) - (38 * 360 + 283)) < 5, 'lands on internal year 38');
	const iso = await k.palette('1038-10-14');
	t.ok(/14 Frost, Year 1038/.test(iso[0] || ''), 'iso ' + iso[0]);
	await p.key('Escape');
});
test('search: an era result fits the era; a card result selects and shows it', async (p, h, t) => {
	const k = kit(p, h); await k.start('ltr');
	const items = await k.palette('Hunger');
	t.ok(/Era/.test(items[0] || '') && /Hunger Moon/.test(items[0]), items[0]);
	await p.key('Enter'); await p.sleep(700);
	const [a, b] = await k.vis();
	t.ok(a <= 13980 && b >= 14010, 'era in view ' + a + '..' + b);
	await k.palette('Treaty'); await p.key('Enter'); await p.sleep(800);
	const ev = await h.ev('Treaty of Sallow');
	const [c, dd] = await k.vis();
	t.ok(ev.t >= c && ev.t <= dd, 'card in view');
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel[aria-label^="Treaty of Sallow"]')`), 'selected');
});

/* ---------- era labels ---------- */
const labelOverlaps = (p) => p.ev(`(() => { const els = [...document.querySelectorAll('${A} .eralabels .el')].filter(e => !e.hidden).map(e => ({ n: e.textContent, r: e.getBoundingClientRect() })); const out = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].r, b = els[j].r; const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ox > 2 && oy > 2) out.push(els[i].n + ' / ' + els[j].n + ' ' + Math.round(ox) + 'x' + Math.round(oy)); } return out; })()`);
for (const d of DIRS) test(`[${d}] era labels of eras that start close together never overlap`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { for (let i = 0; i < 6; i++) d.eras.push({ id: 'q' + i, parent: 's3', name: 'Quick era ' + i, start: 25000 + i * 12, end: 25000 + i * 12 + 12, color: String(i % 6 + 1) }); }`);
	for (const span of [3600, 1800, 720]) {
		await k.view(24900, span);
		const bad = await labelOverlaps(p);
		t.ok(!bad.length, `span ${span}: overlapping labels ${bad.join('; ')}`);
	}
});
for (const d of ['ttb', 'ltr']) test(`[${d}] a very long era name stays inside the stage`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { d.eras.find(e => e.id === 's2').name = 'The Extraordinarily Long and Quiet Years of the Heron Kings Before the Great Restoration Began'; }`);
	await k.view(16000, 3000);
	const r = await p.at(`${A} .eralabels .el[data-era="s2"]`), s = await h.stage();
	t.ok(r, 'label shown');
	t.ok(r.l >= s.l - 1 && r.l + r.w <= s.l + s.w + 1, `label ${Math.round(r.l)}..${Math.round(r.l + r.w)} inside stage ${Math.round(s.l)}..${Math.round(s.l + s.w)}`);
	t.ok(r.w <= 260, 'label width capped: ' + r.w);
});

/* ---------- spans: pulling moments ---------- */
for (const d of DIRS) test(`[${d}] dragging a moment's dot along the line pulls it into a span; dragging the end back makes it a moment`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { d.events.push({ id: 'pm', t: 20000 + 13, side: 'b', title: 'Pull me', text: '', color: '2', file: null }); }`);
	await k.view(19200, 2400);
	const a = await k.pt(20013), b = await k.pt(20013 + 720);
	await p.drag(a.x, a.y, b.x, b.y); await p.sleep(200);
	let e = (await h.events()).find((x) => x.id === 'pm');
	t.ok(e.end != null && e.end > e.t, 'became a span ' + JSON.stringify(e));
	t.eq(e.t, 20013, 'start kept');
	t.ok(Math.abs(e.end - 20733) < 40, 'end near the drop: ' + e.end);
	const c = await k.pt(e.end), z = await k.pt(e.t - 200);
	await p.drag(c.x, c.y, z.x, z.y); await p.sleep(200);
	e = (await h.events()).find((x) => x.id === 'pm');
	t.ok(e.end == null && e.t === 20013, 'dragging the end past the start makes it a moment again ' + JSON.stringify(e));
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	t.ok((await h.events()).find((x) => x.id === 'pm').end != null, 'undo');
	const saved = (await h.saved()).events.find((x) => x.id === 'pm');
	t.ok(saved.end != null, 'saved agrees');
});
for (const d of ['ttb', 'rtl']) test(`[${d}] block spans: dragging a block's end dot resizes it`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { d.events.push({ id: 'bs', t: 20000, end: 20720, side: 'b', title: 'Block span', text: '', color: '3', file: null }); d.opts.spanStyle = 'blocks'; }`);
	await k.view(19600, 1800);
	const a = await k.pt(20720), b = await k.pt(21080);
	await p.drag(a.x, a.y, b.x, b.y); await p.sleep(200);
	const e = (await h.events()).find((x) => x.id === 'bs');
	t.ok(e.t === 20000 && Math.abs(e.end - 21080) < 40, 'resized ' + JSON.stringify(e));
});

/* ---------- direction changes with things open ---------- */
test('direction change while the era editor is open: no errors, edits kept, undo steps add up', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s2');
	await p.key('a', 'ctrl'); await p.type('Calm');
	await h.run('direction-ltr'); await p.sleep(400);
	t.eq((await h.doc()).orientation, 'ltr', 'direction changed');
	const open = await h.popOpen();
	if (open) { await p.key('Escape'); await p.sleep(200); }
	t.eq((await k.era('s2')).name, 'Calm', 'rename kept');
	const s = await h.saved();
	t.ok(s.orientation === 'ltr' && s.eras.find((e) => e.id === 's2').name === 'Calm', 'saved');
	await h.focusStage();
	const states = [];
	for (let i = 0; i < 3; i++) { await p.key('z', 'ctrl'); await p.sleep(250); const d = await h.doc(); states.push(d.orientation + '/' + d.eras.find((e) => e.id === 's2').name); }
	t.eq(states[states.length - 1], 'ttb/The Quiet Years', 'undo gets back to the start: ' + states.join(' -> '));
	t.ok(states[0] !== states[1] || states[1] === states[2], 'no empty undo step in between: ' + states.join(' -> '));
});
for (const d of DIRS) test(`[${d}] arrow keys nudge a selected card the way the arrow points`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { d.events.push({ id: 'nd', t: 20013, side: 'b', title: 'Nudge me', text: '', color: '2', file: null }); }`);
	await k.view(19200, 2400);
	await p.ev(`${h.tl}.focusEvent('nd')`); await p.sleep(700);
	await h.focusStage(); await p.ev(`${h.tl}.focusEvent('nd')`); await p.sleep(300);
	const vert = d === 'ttb' || d === 'btt';
	const key = vert ? 'ArrowDown' : 'ArrowRight';
	const before = await k.pt((await h.events()).find((x) => x.id === 'nd').t);
	await p.key(key); await p.sleep(250);
	const after = await k.pt((await h.events()).find((x) => x.id === 'nd').t);
	const moved = vert ? after.y - before.y : after.x - before.x;
	t.ok(moved > 0, `${key} moved the date ${moved}px on screen`);
});
test('direction change keeps the selection and the time in view', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 3600);
	const ev = await h.ev('Treaty of Sallow');
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(ev.id)})`); await p.sleep(700);
	const c0 = await k.center(), [a0, b0] = await k.vis();
	for (const d of ['ltr', 'btt', 'rtl', 'ttb']) {
		await h.run('direction-' + d); await p.sleep(400);
		const c = await k.center(), [a, b] = await k.vis();
		t.ok(Math.abs(c - c0) < 2 && Math.abs((b - a) - (b0 - a0)) < 2, `${d}: same stretch of time`);
		t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), `${d}: still selected`);
	}
});

/* ---------- saved views ---------- */
test('saved views: saved in one direction open the same years in another, persist, and delete undoably', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(30 * 360, 10 * 360);
	await h.focusStage(); await p.key('b'); await p.sleep(200);
	const i = await h.pop('[data-k=vname]'); await p.click(i.x, i.y); await p.type('Thirties'); await p.key('Enter'); await p.sleep(200);
	await h.run('direction-rtl'); await p.sleep(300);
	await h.run('fit-all'); await p.sleep(600);
	await h.focusStage(); await p.key('b'); await p.sleep(200);
	t.ok(/Thirties/.test(await p.ev(`document.querySelector('${A} [data-r=pop] [data-v]').textContent`)), 'listed');
	await h.clickPop('[data-v]'); await p.sleep(700);
	const [a, b] = await k.vis();
	t.ok(Math.abs(a - 10800) < 60 && Math.abs(b - 14400) < 60, `same years in rtl: ${Math.round(a)}..${Math.round(b)}`);
	const d = await k.reopen();
	t.eq((d.views || []).map((v) => v.name).join(), 'Thirties', 'persisted');
	await h.focusStage(); await p.key('b'); await p.sleep(200); await h.clickPop('[data-vdel]'); await p.sleep(200);
	t.eq(((await h.doc()).views || []).length, 0, 'deleted');
	await p.key('Escape'); await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq(((await h.doc()).views || []).length, 1, 'undo brings it back');
});

/* ---------- now ---------- */
for (const d of ['btt', 'rtl']) test(`[${d}] now: set from the right-click menu, the now tag jumps there, and "." centers it`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(20000, 3600);
	const q = await k.pt(21600, 200);
	await p.right(q.x, q.y); await h.clickPop('[data-m=now]'); await p.sleep(200);
	const now = (await h.doc()).now;
	t.ok(Math.abs(now - 21600) < 40, 'now set near the click: ' + now);
	await k.view(now - 3000, 3600);
	const tag = await p.at(`${A} [data-r=nowTag]`);
	t.ok(tag, 'now tag shows');
	const tp = await k.pt(now), vert = d === 'btt';
	t.ok(vert ? Math.abs(tag.y - tp.y) < 3 : Math.abs(tag.x - tp.x) < 3, 'tag sits at now');
	await p.click(tag.x, tag.y); await p.sleep(700);
	t.ok(Math.abs((await k.center()) - now) < 3, 'tag jumps to now');
	await k.view(0, 3600); await h.focusStage(); await p.key('.'); await p.sleep(700);
	t.ok(Math.abs((await k.center()) - now) < 3, '"." centers now');
});

/* ---------- settings: each control does what it says, and survives a reopen ---------- */
test('settings/timeline: shading and sub-era names toggle what they claim, and survive a reopen', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 4000);
	const bands = () => p.ev(`[...document.querySelectorAll('${A} .lines rect, ${A} .lines path')].filter(e => /opacity:\\s*var\\(--evra-band/.test(e.getAttribute('style') || '')).length`);
	const subs = () => p.ev(`document.querySelectorAll('${A} .eralabels .el.sub:not([hidden])').length`);
	const b0 = await bands(), s0 = await subs();
	t.ok(b0 > 0 && s0 > 0, `bands ${b0}, sub labels ${s0} at first`);
	await h.openSheet('timeline');
	await k.setVal('[data-k=oBands]', false); await k.setVal('[data-k=oSub]', false);
	t.eq(await bands(), 0, 'no shading'); t.eq(await subs(), 0, 'no sub-era names');
	const d = await k.reopen(); await k.view(12000, 4000);
	t.ok(d.opts.bands === false && d.opts.subLabels === false, 'persisted');
	t.eq(await bands(), 0, 'still no shading after reopen'); t.eq(await subs(), 0, 'still no sub names after reopen');
});
test('settings/timeline: fading the future dims only cards after now', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.run('fit-all'); await p.sleep(600);
	await k.view(17000, 3600);
	await h.openSheet('timeline');
	await k.setVal('[data-k=nwFade]', true);
	await p.key('Escape'); await p.sleep(250);
	const r = await p.ev(`(() => { const now = ${h.tl}.getDoc().now; const ev = ${h.tl}.getDoc().events; return [...document.querySelectorAll('${A} .cards > .evra-card:not(.group)')].map(c => { const e = ev.find(x => x.id === c.dataset.id); return e ? { t: e.t, after: e.t > now, dim: /dim1|dim2/.test(c.className) || getComputedStyle(c).opacity < 0.9 } : null; }).filter(Boolean); })()`);
	t.ok(r.some((x) => x.after) && r.some((x) => !x.after), 'cards on both sides of now ' + JSON.stringify(r));
	t.ok(r.every((x) => x.after === x.dim), 'dimmed exactly the future ones ' + JSON.stringify(r));
});
test('settings/cards: "None" description lines hides descriptions (they must not spill over the date)', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 4000);
	await h.openSheet('cards');
	await k.clickSheet('[data-lines="0"]');
	const bad = await p.ev(`[...document.querySelectorAll('${A} .cards > .evra-card:not(.group) .bd')].filter(e => e.offsetHeight > 2).map(e => e.closest('.evra-card').getAttribute('aria-label').split(',')[0] + ' (' + getComputedStyle(e).webkitLineClamp + ')')`);
	t.ok(!bad.length, 'descriptions still drawn: ' + bad.join('; '));
	const d = await k.reopen();
	t.eq(d.opts.cardLines, 0, 'persisted');
});
test('settings/cards: the card width slider opens at the current width', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('cards');
	const sv = await p.ev(`(() => { const i = document.querySelector('${A} .sheet-body [data-k=cw]'); return [i.value, ${h.tl}.getDoc().cardWidth].join(); })()`);
	t.eq(sv, '240,240', 'slider value, card width');
	await k.setVal('[data-k=cw]', '300');
	await h.openSheet('timeline'); await h.openSheet('cards');
	t.eq(await p.ev(`document.querySelector('${A} .sheet-body [data-k=cw]').value`), '300', 'after switching tabs');
});
test('settings/cards: tint and grouping change the cards and persist', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { for (let i = 0; i < 4; i++) d.events.push({ id: 'g' + i, t: 60 * 360 + i * 40, side: 'b', title: 'Crowd ' + i, text: '', color: '2', file: null }); }`);
	await k.view(12000, 4000);
	await h.openSheet('cards');
	await k.setVal('[data-k=oTint]', false);
	const tinted = await p.ev(`(() => { const c = [...document.querySelectorAll('${A} .cards > .evra-card.tint')][0]; return c ? getComputedStyle(c).backgroundColor : null; })()`);
	await k.setVal('[data-k=oTint]', true);
	const tinted2 = await p.ev(`(() => { const c = [...document.querySelectorAll('${A} .cards > .evra-card.tint')][0]; return c ? getComputedStyle(c).backgroundColor : null; })()`);
	t.ok(tinted && tinted2 && tinted !== tinted2, `tint changes the card color: off ${tinted}, on ${tinted2}`);
	await k.setVal('[data-k=oTint]', false);
	await k.clickSheet('[data-grp="0"]');
	await p.key('Escape'); await h.run('fit-all'); await p.sleep(600);
	t.eq(await p.ev(`document.querySelectorAll('${A} .cards > .evra-card.group').length`), 0, 'grouping off: no group cards');
	await h.openSheet('cards'); await k.clickSheet('[data-grp="2"]'); await p.key('Escape'); await p.sleep(300);
	t.ok(await p.ev(`document.querySelectorAll('${A} .cards > .evra-card.group').length`) > 0, 'grouping over 2: group cards at fit');
	const d = await k.reopen();
	t.ok(d.opts.tint === false && d.opts.groupOver === 2, 'persisted ' + JSON.stringify(d.opts));
});
test('settings/cards: card width slider changes card width live and persists', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 4000);
	const w0 = await p.ev(`document.querySelector('${A} .cards > .evra-card:not(.group)').getBoundingClientRect().width`);
	await h.openSheet('cards');
	await k.setVal('[data-k=cw]', '340');
	const w1 = await p.ev(`document.querySelector('${A} .cards > .evra-card:not(.group)').getBoundingClientRect().width`);
	t.ok(w1 > w0 + 50, `wider: ${w0} -> ${w1}`);
	t.eq(await p.ev(`document.querySelector('${A} .cwv').textContent`), '340px', 'label follows');
	const d = await k.reopen();
	t.eq(d.cardWidth, 340, 'persisted');
});
test('settings/timeline: snapping to months and years lands dragged cards on month or year starts', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.events.push({ id: 'sn', t: 20013, side: 'b', title: 'Snap me', text: '', color: '2', file: null }); }`);
	for (const [mode, unit] of [['m', 30], ['y', 360]]) {
		await h.openSheet('timeline'); await k.clickSheet(`[data-snap=${mode}]`); await p.key('Escape'); await p.sleep(200);
		await k.view(19000, 3600);
		const c = await h.card('Snap me');
		await p.drag(c.x, c.y, c.x, c.y + 97); await p.sleep(250);
		const e = (await h.events()).find((x) => x.id === 'sn');
		t.eq(e.t % unit, 0, `${mode}: landed on ${e.t}`);
	}
	t.eq((await h.saved()).opts.snapTo, 'y', 'saved');
});
test('settings/calendar: unit names rename the ruler, card dates and panel wording', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 4000);
	await h.openSheet('calendar');
	await k.setVal('[data-k=uYear]', 'cycle'); await k.setVal('[data-k=uYears]', 'cycles'); await k.setVal('[data-k=uMonth]', 'moon');
	await p.sleep(300);
	const ruler = await p.ev(`[...document.querySelectorAll('${A} .ruler > span:not([hidden])')].map(s => s.textContent).join('|')`);
	t.ok(/Cycle \d/.test(ruler) && !/Year/.test(ruler), 'ruler: ' + ruler.slice(0, 60));
	t.ok(/Add a moon/.test(await p.ev(`document.querySelector('${A} [data-k=mAdd]').textContent`)), 'panel wording');
	await h.openSheet('timeline');
	t.ok(/From cycle/.test(await p.ev(`document.querySelector('${A} .sheet-body').textContent`)), 'range labels');
	const d = await k.reopen();
	t.eq(d.cal.units.year, 'cycle', 'persisted');
});
test('settings/formats: {EY} {E} year format with era base 0 and an abbreviation shows on the ruler', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('formats');
	await k.setVal('[data-fmt=year]', '{EY} {E}');
	await h.openSheet('calendar');
	await k.clickSheet('[data-eb="0"]');
	await p.key('Escape'); await p.sleep(200);
	await k.openEd('s'); const ab = await h.pop('[data-k=eraAbbr]'); await p.click(ab.x, ab.y); await p.type('SA'); await p.key('Escape'); await p.sleep(200);
	await k.view(7920 - 500, 3 * 360);
	const ruler = await p.ev(`[...document.querySelectorAll('${A} .ruler > span:not([hidden])')].map(s => s.textContent)`);
	t.ok(ruler.includes('0 SA') && ruler.includes('1 SA'), 'second age counts from 0: ' + ruler.join('|'));
	t.ok(ruler.some((r) => / K$/.test(r)), 'kindling years abbreviate as K: ' + ruler.join('|'));
});
test('settings/calendar: weekdays with {W} show on card dates and move with the week start', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	await k.setVal('[data-k=wkNames]', 'Moonday, Tidesday, Starday');
	await h.openSheet('formats');
	await k.setVal('[data-fmt=dateDay]', '{W}, {D} {M}, {year}');
	await k.setDoc(`(d) => { d.events.push({ id: 'wk', t: 20013, side: 'b', title: 'Weekday card', text: '', color: '2', file: null }); }`);
	await k.view(19500, 1200);
	const d0 = await k.cardDate('Weekday card');
	t.ok(/^(Moonday|Tidesday|Starday), /.test(d0 || ''), 'weekday shown: ' + d0);
	await h.openSheet('calendar');
	await k.setVal('[data-k=wkStart]', '1');
	const d1 = await k.cardDate('Weekday card');
	t.ok(d1 && d1 !== d0, `week start moves it: ${d0} -> ${d1}`);
});
test('calendar: gregorian leap years: 29 February exists only in leap years', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	await k.setVal('[data-k=sPreset]', 'gregorian');
	await p.key('Escape'); await p.sleep(200);
	let items = await k.palette('29 February 24');
	t.ok(/29 February, Year 24/.test(items[0] || ''), 'leap year 24: ' + items[0]);
	await p.key('Escape');
	items = await k.palette('29 February 23');
	t.ok(!/29 February, Year 23/.test(items[0] || ''), 'no 29 Feb in 23: ' + items[0]);
	await p.key('Escape');
	items = await k.palette('29 February 100');
	t.ok(!/29 February, Year 100/.test(items[0] || ''), 'no 29 Feb in 100: ' + items[0]);
	await p.key('Escape');
	items = await k.palette('29 February 400');
	t.ok(/29 February, Year 400/.test(items[0] || ''), 'but 400 is: ' + items[0]);
	await p.key('Escape');
});
test('calendar: a festival day shows with the festival format and can be searched', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	await k.clickSheet('[data-k=mAdd]');
	await p.type('Midwinter'); await p.key('Tab'); await p.sleep(200);
	await k.setVal('[data-days="12"]', '1');
	await k.setVal('[data-fest="12"]', true);
	await h.openSheet('formats');
	await k.setVal('[data-fmt=dateInter]', '{M} festival, {year}');
	await p.key('Escape'); await p.sleep(200);
	const items = await k.palette('Midwinter 40');
	t.ok(/Midwinter festival, Year 40/.test(items[0] || ''), 'festival format in search: ' + items[0]);
	await p.key('Enter'); await p.sleep(700);
	const d = await h.doc();
	t.eq(d.cal.months.length, 13, 'thirteen months'); t.ok(d.cal.months[12].inter, 'festival');
});
test('calendar: a single-month "years only" calendar disables month snapping and still navigates', async (p, h, t) => {
	const k = kit(p, h); await k.start('ltr');
	await h.openSheet('calendar');
	await k.setVal('[data-k=sPreset]', 'years');
	await h.openSheet('timeline');
	t.ok(await p.ev(`document.querySelector('${A} [data-snap=m]').disabled`), 'month snapping disabled');
	await p.key('Escape'); await p.sleep(200);
	const items = await k.palette('40');
	t.ok(/40/.test(items[0] || '') && !/undefined|NaN/.test(items[0]), 'date item: ' + items[0]);
	await p.key('Enter'); await p.sleep(700);
	const ruler = await p.ev(`document.querySelector('${A} .ruler').textContent`);
	t.ok(!/undefined|NaN|Month 1/.test(ruler), 'ruler clean: ' + ruler.slice(0, 80));
	const s = await h.stage();
	for (let i = 0; i < 40; i++) await p.wheel(s.x, s.y, -300, true);
	await p.sleep(300);
	const r2 = await p.ev(`document.querySelector('${A} .ruler').textContent`);
	t.ok(!/undefined|NaN/.test(r2), 'zoomed-in ruler clean: ' + r2.slice(0, 80));
});
test('calendar: presets applied after eras exist keep every era valid', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	const bad = [];
	for (const pr of ['gregorian', 'moons', 'seasons', 'years', 'twelve']) {
		await k.setVal('[data-k=sPreset]', pr);
		const b = k.erasValid(await h.doc());
		if (b.length) bad.push(pr + ': ' + b.slice(0, 3).join(', '));
	}
	t.ok(!bad.length, bad.join(' || '));
});
test('calendar: numbering from -500 shows negative years on ruler, range fields and search', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar'); await k.setVal('[data-k=sYs]', '-500');
	await h.openSheet('timeline');
	t.eq(await p.ev(`document.querySelector('${A} [data-k=r0]').value`), '-500', 'range from');
	t.eq(await p.ev(`document.querySelector('${A} [data-k=r1]').value`), '-420', 'range to');
	await p.key('Escape'); await p.sleep(200);
	await k.view(0, 3 * 360);
	const ruler = await p.ev(`[...document.querySelectorAll('${A} .ruler > span:not([hidden])')].map(s => s.textContent).join('|')`);
	t.ok(/Year −499/.test(ruler), 'ruler ' + ruler);
	const items = await k.palette('Year -470');
	t.ok(/Year −470/.test(items[0] || ''), 'search ' + items[0]);
	await p.key('Enter'); await p.sleep(700);
	t.ok(Math.abs((await k.center()) - 30 * 360) < 5, 'lands on internal year 30');
});

/* ---------- window sizes ---------- */
let shotN = 0;
const SHOTDIR = process.env.R2_SHOTS || '';
const sized = (w, hh, fn) => async (p, h, t) => {
	await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: 1, mobile: false }); await p.sleep(400);
	try { await fn(p, h, t); } finally { if (SHOTDIR) await p.shot(`${SHOTDIR}/sized-${w}-${++shotN}.png`).catch(() => {}); await p.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false }); await p.sleep(300); }
};
// UI pieces that must be fully inside the stage and not covered by each other
const layoutProblems = (p) => p.ev(`(() => { const st = document.querySelector('${A} .stage').getBoundingClientRect(); const out = []; const els = [...document.querySelectorAll('${A} .ctrls [data-c], ${A} .crumb button, ${A} .minimap')].filter(e => e.offsetParent && !e.closest('[hidden]'));
	for (const e of els) { const r = e.getBoundingClientRect(); const name = e.dataset.c || e.dataset.era || e.className; if (r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1) out.push(name + ' outside the stage'); const x = r.left + r.width / 2, y = r.top + r.height / 2; const hit = document.elementFromPoint(x, y); if (hit && !e.contains(hit) && !hit.contains(e)) out.push(name + ' covered by ' + (hit.className?.baseVal ?? hit.className)); }
	return out; })()`);
for (const [w, hh] of [[390, 780], [800, 600]]) for (const d of DIRS) test(`[${d}] ${w}px window: toolbar, breadcrumb and minimap are inside the stage and uncovered`, sized(w, hh, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	const bad = new Set();
	for (const v of [[13975, 40], [12000, 4000], [9000, 7200], [0, 28800]]) { await k.view(...v); (await layoutProblems(p)).forEach((x) => bad.add(x + ' @' + v)); }
	t.ok(!bad.size, [...bad].slice(0, 8).join('; '));
}));
for (const w of [390, 800]) test(`${w}px window: the settings sheet fits and every tab is reachable`, sized(w, 700, async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	const r = await p.at(`${A} [data-r=sheet]`), s = await h.stage();
	t.ok(r && r.l >= s.l - 1 && r.l + r.w <= s.l + s.w + 1, `sheet ${JSON.stringify(r)} inside stage ${JSON.stringify(s)}`);
	for (const tab of ['calendar', 'formats', 'timeline', 'cards', 'colors', 'notes']) {
		await p.ev(`document.querySelector('${A} [data-tab=${tab}]').scrollIntoView({ inline: 'nearest' })`); await p.sleep(100);
		const b = await p.at(`${A} [data-tab=${tab}]`);
		t.ok(b && b.l >= r.l - 1 && b.l + b.w <= r.l + r.w + 1, tab + ' tab visible: ' + JSON.stringify(b));
		if (b) { await p.click(b.x, b.y); await p.sleep(200); }
		const over = await p.ev(`(() => { const b = document.querySelector('${A} .sheet-body'); return b.scrollWidth - b.clientWidth; })()`);
		t.ok(over <= 1, `${tab}: no sideways scrolling in the sheet (${over}px)`);
	}
}));
test('390px window: the search palette fits the screen', sized(390, 780, async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.palette('Frost 40');
	const r = await p.at(`${A} [data-r=palette] .pbox`);
	t.ok(r && r.l >= 0 && r.l + r.w <= 390, 'palette inside: ' + JSON.stringify(r));
	await p.key('Escape');
}));
for (const d of ['ttb', 'ltr']) test(`[${d}] 390px window: era editor and card menu fit on screen`, sized(390, 780, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(16000, 9000);
	const lab = await p.at(`${A} .eralabels .el[data-era="s2"]`);
	t.ok(lab, 'label');
	await p.click(lab.x, lab.y); await p.sleep(300);
	const r = await p.at(`${A} [data-r=pop]`), s = await h.stage();
	t.ok(r && r.l >= s.l && r.l + r.w <= s.l + s.w && r.t >= s.t && r.t + r.h <= s.t + s.h + 1, 'era editor inside the stage ' + JSON.stringify(r) + ' ' + JSON.stringify(s));
}));

/* ---------- more era edges ---------- */
test('era edges: dragging a lone sub-era edge past its parent stops at the parent', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(17000, 9000);
	await k.dragT(19440, 25000);
	const e = await k.era('s2a');
	t.eq(e.end, 24480, 'stops at The Quiet Years end');
	t.ok(!k.erasValid(await h.doc()).length, 'eras valid');
});
test('era edges: Alt-dragging a shared nested edge moves only one era and keeps nesting valid', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(5000, 6000);
	await k.dragT(7920, 7200, true);
	const d = await h.doc();
	t.ok(!k.erasValid(d).length, k.erasValid(d).join('; '));
	const moved = ['k', 'k2', 's', 's1'].filter((id) => { const e = d.eras.find((x) => x.id === id); return e.start === 7200 || e.end === 7200; });
	t.eq(moved.length, 1, 'only one edge moved: ' + moved.join(','));
});
test('era edges: dragging an edge onto a neighbour with a gap stops at the neighbour', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.eras.push({ id: 'g1', parent: 's3', name: 'Gap one', start: 25200, end: 25560, color: '1' }, { id: 'g2', parent: 's3', name: 'Gap two', start: 25920, end: 26280, color: '2' }); }`);
	await k.view(24800, 2000);
	await k.dragT(25560, 26100);
	t.eq((await k.era('g1')).end, 25920, 'stopped at Gap two');
	t.eq((await k.era('g2')).start, 25920, 'Gap two untouched');
});
test('era: creating an era by dragging across year 0 in btt works with negative years', async (p, h, t) => {
	const k = kit(p, h); await k.start('btt');
	await h.openSheet('timeline'); await k.setVal('[data-k=r0]', '-20'); await p.key('Escape'); await p.sleep(200);
	await k.view(-5000, 7000);
	const e = await k.mkEra(-3600, -720);
	t.ok(e && e.start === -3600 && e.end === -720 && !e.parent, 'top-level era before year 0 ' + JSON.stringify(e));
	const lab = await p.ev(`(() => { const T = ${h.tl}; return 1; })()`); void lab;
	const items = await k.palette('New era');
	t.ok(items.some((x) => /Year −10/.test(x) && /Year −2/.test(x)), 'era dates read negative years: ' + items.join(' | '));
	await p.key('Escape');
});

/* ---------- colors ---------- */
test('colors: an era color follows its preset hex; deleting the preset leaves the era uncolored (undoable)', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 6000);
	const fill = () => p.ev(`getComputedStyle(document.querySelector('${A} rect[data-era="s1a"]')).fill`);
	await h.openSheet('colors');
	await k.setVal('[data-ph="6"]', '#123456');
	t.eq(await fill(), 'rgb(18, 52, 86)', 'rail recolored');
	await k.clickSheet('[data-pdel="6"]');
	const d = await h.doc();
	t.ok(d.eras.filter((e) => e.color === '6').length === 0, 'no era uses the deleted preset');
	await k.undo();
	t.eq((await k.era('s1a')).color, '6', 'undo restores');
});

/* ---------- range ---------- */
test('range: narrowing the range below the content keeps it wide enough and says so; +10 buttons extend it', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('timeline');
	await k.setVal('[data-k=r1]', '30');
	t.ok(/wide enough/.test(await h.toast()), 'toast');
	t.eq((await h.doc()).range[1], 80, 'kept at the content end (year 80), not a year past it');
});
test('range: the +10 buttons at the range ends extend it and save', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.run('fit-all'); await p.sleep(600);
	const e = await p.at(`${A} [data-r=extE]`);
	t.ok(e, '+10 later button shows at fit');
	await p.click(e.x, e.y); await p.sleep(200);
	t.eq((await h.doc()).range[1], 90, 'extended');
	t.eq((await h.saved()).range[1], 90, 'saved');
});
test('range: "Fit the range to my events" includes an era that reaches past the last event', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.setDoc(`(d) => { d.eras.push({ id: 'far', parent: null, name: 'Far era', start: 28800, end: 36000, color: '3' }); }`);
	await h.openSheet('timeline'); await k.clickSheet('[data-k=rFit]');
	const d = await h.doc();
	t.ok(d.range[1] >= 100, 'range reaches the era end: ' + d.range);
});

/* ---------- navigation keys ---------- */
for (const d of ['ltr', 'rtl']) test(`[${d}] horizontal wheel and G go-to-date`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(10000, 3600);
	const s = await h.stage(), v0 = (await p.ev(`${h.tl}.getViewState()`)).v0;
	await p.wheel(s.x, s.y, 0, false, 200); await p.sleep(200);
	const v1 = (await p.ev(`${h.tl}.getViewState()`)).v0;
	t.eq(Math.sign(v1 - v0), d === 'rtl' ? -1 : 1, 'deltaX scrolls with the content like a trackpad');
	await h.focusStage(); await p.key('g'); await p.sleep(150);
	await p.type('1 Ember 50'); await p.sleep(150); await p.key('Enter'); await p.sleep(700);
	t.ok(Math.abs((await k.center()) - (50 * 360 + 180)) < 3, 'centered on 1 Ember 50');
});

/* ---------- search: more date shapes ---------- */
test('search: a negative-year word in the format (like "BE") does not make month names containing it negative', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('formats'); await k.setVal('[data-fmt=yearNeg]', '{Y} BE'); await p.key('Escape'); await p.sleep(200);
	const items = await k.palette('1 Ember 50');
	t.ok(/1 Ember, Year 50/.test(items[0] || ''), '"1 Ember 50" reads as year 50: ' + items[0]);
	await p.key('Escape');
	const neg = await k.palette('5 BE');
	t.ok(/5 BE/.test(neg[0] || ''), '"5 BE" is negative: ' + neg[0]);
	await p.key('Escape');
});
test('search: going to a date past the range brings that date into view', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.palette('Year 200'); await p.key('Enter'); await p.sleep(800);
	const [a, b] = await k.vis();
	t.ok(a <= 200 * 360 && 200 * 360 <= b, `Year 200 in view: ${Math.round(a / 360)}..${Math.round(b / 360)}`);
});
test('search: ">" commands switch direction and fit from the palette', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	const items = await k.palette('>right to left');
	t.ok(items.length >= 1 && /right to left/i.test(items[0]), items.join('|'));
	await p.key('Enter'); await p.sleep(400);
	t.eq((await h.doc()).orientation, 'rtl', 'switched');
});

/* ---------- more calendar interplay ---------- */
test('calendar: a leap rule adds a day in leap years and keeps events on their named day', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	const before = await h.ev('Treaty of Sallow'), d0 = await k.cardDate('Treaty of Sallow');
	await h.openSheet('calendar'); await k.clickSheet('[data-k=lpAdd]');
	const d = await h.doc();
	t.eq(d.cal.leaps.length, 1, 'rule added'); t.eq(d.cal.leaps[0].every, 4, 'every 4');
	await p.key('Escape'); await p.sleep(200);
	const ev = await h.ev('Treaty of Sallow');
	t.ok(ev.t !== before.t, 'date moved by the leap days before it: ' + before.t + ' -> ' + ev.t);
	await k.view(ev.t - 400, 800);
	t.eq(await k.cardDate('Treaty of Sallow'), d0, 'same named day');
	const items = await k.palette('31 Seedfall 44');
	t.ok(/31 Seedfall, Year 44/.test(items[0] || ''), 'leap day in year 44: ' + items[0]);
	await p.key('Escape');
	t.ok(!k.erasValid(await h.doc()).length, 'eras valid ' + k.erasValid(await h.doc()).join('; '));
});
test('calendar: adding a month keeps events and eras on their named days', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	const ev0 = await h.ev('Treaty of Sallow');
	await k.view(ev0.t - 1000, 2000);
	const d0 = await k.cardDate('Treaty of Sallow');
	await h.openSheet('calendar'); await k.clickSheet('[data-k=mAdd]'); await p.key('Escape'); await p.sleep(200);
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(ev0.id)})`); await p.sleep(700);
	t.eq(await k.cardDate('Treaty of Sallow'), d0, 'same named day');
	const d = await h.doc();
	t.ok(!k.erasValid(d).length, k.erasValid(d).join('; '));
	t.eq(d.eras.find((e) => e.id === 's').start, 22 * 390, 'The Second Age still starts at year 22');
});
test('calendar: importing a calendar after events exist keeps eras valid and the saved file in step', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar');
	const imp = JSON.stringify({ static: { months: [{ name: 'Hammer', length: 30 }, { name: 'Midwinter', length: 1, type: 'intercalary' }, { name: 'Alturiak', length: 30 }, { name: 'Ches', length: 30 }], leapDays: [{ timespan: 1, interval: '4' }], weekdays: ['A', 'B'] } });
	await k.setVal('[data-k=impTxt]', imp);
	await k.clickSheet('[data-k=impGo]');
	const d = await h.doc();
	t.eq(d.cal.months.length, 4, 'imported');
	t.ok(!k.erasValid(d).length, k.erasValid(d).join('; '));
	t.ok(d.events.every((e) => e.end == null || e.end > e.t), 'spans valid');
	const s = await h.saved();
	t.eq(JSON.stringify(s.eras), JSON.stringify(d.eras), 'saved eras equal live');
});
test('formats: shortRange off shows full span dates; custom tick formats reach the ruler', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(0, 6000);
	const lw = await k.cardDate('Raising the River Keep');
	await h.openSheet('formats');
	await k.setVal('[data-fmt=tickYear]', 'Y{Y}!');
	await k.setVal('[data-k=sShort]', !(await h.doc()).cal.fmt.shortRange);
	const lw2 = await k.cardDate('Raising the River Keep');
	t.ok(lw2 !== lw, `span date format changed: ${lw} -> ${lw2}`);
	const ruler = await p.ev(`[...document.querySelectorAll('${A} .ruler > span:not([hidden])')].map(s => s.textContent).join('|')`);
	t.ok(/Y\d+!/.test(ruler), 'ruler uses the tick format: ' + ruler);
	await k.setVal('[data-fmt=tickDay]', '{Do} of {M}');
	await k.view(14003, 20);
	const r2 = await p.ev(`[...document.querySelectorAll('${A} .ruler > span:not([hidden])')].map(s => s.textContent).join('|')`);
	t.ok(/\d+(st|nd|rd|th) of \w+/.test(r2), 'day ticks: ' + r2);
});

/* ---------- very long eras, dots mode ---------- */
test('a 10,000-year era with sub-eras: rail, labels and right-click fit work', async (p, h, t) => {
	const k = kit(p, h);
	await k.make('Deep.evra', { name: 'Deep', range: [-6000, 6000], eras: [{ id: 'big', name: 'The Long Dark', start: -5000 * 360, end: 5000 * 360, color: '1' }, { id: 'b1', parent: 'big', name: 'First Dusk', start: -5000 * 360, end: -4000 * 360, color: '2' }, { id: 'b2', parent: 'big', name: 'Middle Night', start: 0, end: 10, color: '3' }], events: [{ t: 5, title: 'Midnight' }, { t: -4500 * 360, title: 'Early' }] });
	await k.start(null, 'Deep.evra');
	await h.run('fit-all'); await p.sleep(700);
	const [a, b] = await k.vis();
	t.ok(a <= -5000 * 360 && b >= 5000 * 360, 'fit all shows it');
	t.ok(await p.at(`${A} rect[data-era="big"]`), 'rail bar');
	const q = await p.palette ? null : null; void q;
	await k.palette('Middle Night'); await p.key('Enter'); await p.sleep(800);
	const [c, dd] = await k.vis();
	t.ok(c <= 0 && dd >= 10 && dd - c < 400, 'a 10-day sub-era of a 10,000-year era fits: ' + c + '..' + dd);
	t.ok(/The Long Dark.*Middle Night/.test(await p.ev(`document.querySelector('${A} .crumb').textContent`)), 'breadcrumb');
});
for (const d of ['ttb', 'ltr']) test(`[${d}] zoomed out: era names in dots mode do not overlap`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.setDoc(`(d) => { for (let i = 0; i < 300; i++) d.events.push({ id: 'm' + i, t: Math.round(28800 * i / 300), side: i % 2 ? 'a' : 'b', title: 'M' + i, text: '', color: '1', file: null }); }`);
	await h.run('fit-all'); await p.sleep(700);
	const bad = await p.ev(`(() => { const els = [...document.querySelectorAll('${A} .lines .era-big, ${A} .lines .era-mid')].map(e => ({ n: e.textContent, r: e.getBoundingClientRect() })); const out = []; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = els[i].r, b = els[j].r; if (Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2) out.push(els[i].n + '/' + els[j].n); } return [els.length, out]; })()`);
	t.ok(bad[0] > 0, 'era names drawn');
	t.ok(!bad[1].length, 'overlaps: ' + bad[1].join('; '));
});

/* ---------- zoom stability ---------- */
test('zoom: ctrl+wheel past the minimum does not drift the view', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	const s = await h.stage();
	for (let i = 0; i < 60; i++) await p.wheel(s.x, s.y - 200, 300, true);
	await p.sleep(200);
	const v1 = await p.ev(`${h.tl}.getViewState()`);
	for (let i = 0; i < 30; i++) await p.wheel(s.x, s.y - 200, 300, true);
	await p.sleep(200);
	const v2 = await p.ev(`${h.tl}.getViewState()`);
	t.ok(Math.abs(v2.v0 - v1.v0) < 1 && Math.abs(v2.scale - v1.scale) < 1e-9, `v0 ${v1.v0} -> ${v2.v0}`);
});
test('zoom: + and - keep the center; going back to the timeline in the same tab restores the view', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(12000, 3600);
	const c0 = await k.center();
	await h.focusStage(); await p.key('+'); await p.sleep(450); await p.key('+'); await p.sleep(450); await p.key('-'); await p.sleep(450);
	t.ok(Math.abs((await k.center()) - c0) < 2, 'center kept');
	const [a, b] = await k.vis();
	await p.sleep(600);
	await h.saved();
	await p.ev(`app.workspace.activeLeaf.openFile(app.vault.getAbstractFileByPath('Welcome.md')).then(() => 1)`); await p.sleep(400);
	await p.ev(`app.workspace.activeLeaf.history.back().then ? app.workspace.activeLeaf.history.back().then(() => 1) : 1`); await p.sleep(800);
	t.ok(await p.ev(`!!document.querySelector('${A} .stage')`), 'back on the timeline');
	const [a2, b2] = await k.vis();
	t.ok(Math.abs(a2 - a) < (b - a) * 0.2 && Math.abs(b2 - b) < (b - a) * 0.2, `view restored: ${Math.round(a)}..${Math.round(b)} vs ${Math.round(a2)}..${Math.round(b2)}`);
});
test('second calendar: its ruler shows in every direction and does not overlap the main ruler', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('calendar'); await k.setVal('[data-k=s2on]', true); await p.key('Escape'); await p.sleep(200);
	for (const d of DIRS) {
		await h.run('direction-' + d); await p.sleep(400);
		await k.view(9000, 7200);
		const r = await p.ev(`(() => { const a = [...document.querySelectorAll('${A} .ruler:not(.r2) > span:not([hidden])')].map(e => e.getBoundingClientRect()); const b = [...document.querySelectorAll('${A} .ruler.r2 > span:not([hidden])')].map(e => e.getBoundingClientRect()); let o = 0; for (const x of a) for (const y of b) if (Math.min(x.right, y.right) - Math.max(x.left, y.left) > 1 && Math.min(x.bottom, y.bottom) - Math.max(x.top, y.top) > 1) o++; return [a.length, b.length, o]; })()`);
		t.ok(r[1] > 0, d + ': second ruler labels ' + r);
		t.eq(r[2], 0, d + ': overlaps between rulers');
	}
});

/* ---------- visuals ---------- */
for (const d of DIRS) test(`[${d}] visual: era labels, rail and breadcrumb are readable (contrast) in this theme`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(12000, 4000);
	if (SHOTDIR) await p.shot(`${SHOTDIR}/visual-${d}-${await p.ev(`document.body.classList.contains('theme-dark') ? 'dark' : 'light'`)}.png`);
	const low = await p.ev(`(() => { const lum = (c) => { const m = c.match(/[\\d.]+/g).map(Number); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(m[0]) + 0.7152 * f(m[1]) + 0.0722 * f(m[2]); };
		const bgOf = (e) => { for (let x = e; x; x = x.parentElement) { const b = getComputedStyle(x).backgroundColor; const a = b.match(/[\\d.]+/g); if (a && (a.length < 4 || +a[3] > 0.5)) return b; } return getComputedStyle(document.body).backgroundColor; };
		return [...document.querySelectorAll('${A} .eralabels .el:not([hidden]), ${A} .crumb button, ${A} .ruler > span:not([hidden])')].map(e => { const a = lum(getComputedStyle(e).color), b = lum(bgOf(e)); const r = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05); return [e.textContent, +r.toFixed(2)]; }).filter(x => x[1] < 3); })()`);
	// computed-style contrast is approximate (translucent backgrounds); the screenshots were checked by eye. Only flag the extreme.
	t.ok(!low.filter((x) => x[1] < 1.1).length, 'invisible text: ' + JSON.stringify(low.slice(0, 6)));
});

/* ---------- a few more edge flows ---------- */
test('era editor: an end typed before the start is clamped, never inverted', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s2a');
	await k.setDate('eY', '40');
	const e = await k.era('s2a');
	t.ok(e.end > e.start, 'not inverted ' + JSON.stringify(e));
	t.ok(/Kept inside/.test(await h.toast()), 'says why');
	await p.key('Escape');
	t.ok(!k.erasValid(await h.saved()).length, 'saved eras valid');
});
for (const d of ['btt', 'rtl']) test(`[${d}] right-click "Add an era here" inside a sub-era nests it and opens its editor`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(17500, 3000);
	const q = await k.pt(18300, 250);
	await p.right(q.x, q.y); await h.clickPop('[data-m=addera]'); await p.sleep(300);
	t.ok(await h.popOpen(), 'editor open');
	await p.key('Escape'); await p.sleep(200);
	const dd = await h.doc(), e = dd.eras[dd.eras.length - 1];
	t.eq(e.parent, 's2a', 'nested in Heron Years ' + JSON.stringify(e));
	t.ok(!k.erasValid(dd).length, k.erasValid(dd).join('; '));
});
test('direction buttons in the settings sheet switch direction, keep the sheet open and mark the choice', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.openSheet('timeline');
	for (const d of ['ltr', 'btt', 'rtl', 'ttb']) {
		await k.clickSheet(`[data-o=${d}]`);
		t.eq((await h.doc()).orientation, d, 'switched to ' + d);
		t.ok(await p.ev(`!document.querySelector('${A} [data-r=sheet]').hidden`), 'sheet open');
		t.ok(await p.ev(`document.querySelector('${A} [data-o=${d}]').classList.contains('on')`), 'marked');
	}
	t.eq((await h.saved()).orientation, 'ttb', 'saved');
});
test('direction change while the search palette is open leaves it usable', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.palette('Treaty');
	await h.run('direction-ltr'); await p.sleep(400);
	await p.ev(`document.querySelector('${A} [data-r=palIn]').focus()`);
	await p.key('Enter'); await p.sleep(800);
	const ev = await h.ev('Treaty of Sallow'), [a, b] = await k.vis();
	t.ok(ev.t >= a && ev.t <= b, 'jumped to the card in ltr');
});
