// QA scenarios: eras, spans and navigation, in all four directions.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const DIRS = ['ttb', 'btt', 'ltr', 'rtl'];

// helpers bound to p and h
function kit(p, h) {
	const k = {};
	k.install = () => p.ev(`window.__pt = (t, c = 0) => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(), o = d.orientation || 'ttb'; const st = document.querySelector('${A} .stage'), r = st.getBoundingClientRect(); const vert = o === 'ttb' || o === 'btt', rev = o === 'btt' || o === 'rtl'; const L = vert ? st.clientHeight : st.clientWidth; let s = (t - v.v0) * v.scale; if (rev) s = L - s; const ln = document.querySelector('${A} .lines line[style*="dasharray: 2"], ${A} .lines line[style*="dasharray:2"]'); const cx = vert ? +ln.getAttribute('x1') : +ln.getAttribute('y1'); return vert ? { x: r.left + cx + c, y: r.top + s } : { x: r.left + s, y: r.top + cx + c }; }; 1`);
	k.start = async (d) => { await h.open(); await k.install(); await h.run('direction-' + d); await p.sleep(450); };
	k.view = (v0, days) => p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); const s = document.querySelector('${A} .stage'); const L = ['ltr','rtl'].includes(d.orientation) ? s.clientWidth : s.clientHeight; t.setViewState({v0: ${v0}, scale: L / ${days}, x: 0}); return 1; })()`).then(() => p.sleep(350));
	k.pt = (t, c = 0) => p.ev(`__pt(${t}, ${c})`);
	k.vis = () => p.ev(`(() => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(); const st = document.querySelector('${A} .stage'); const L = ['ltr','rtl'].includes(d.orientation) ? st.clientWidth : st.clientHeight; return [v.v0, v.v0 + L / v.scale]; })()`);
	k.era = async (id) => (await h.doc()).eras.find((e) => e.id === id || e.name === id);
	k.tAt = (x, y) => p.ev(`(() => { const T = ${h.tl}; const v = T.getViewState(), d = T.getDoc(), o = d.orientation; const st = document.querySelector('${A} .stage'), r = st.getBoundingClientRect(); const vert = o === 'ttb' || o === 'btt', rev = o === 'btt' || o === 'rtl'; const L = vert ? st.clientHeight : st.clientWidth; let s = vert ? ${y} - r.top : ${x} - r.left; if (rev) s = L - s; return v.v0 + s / v.scale; })()`);
	k.free = async (t) => { for (const c of [-520, 520, -400, 400, -300, 300, -200, 200, -150, 150, -60, 60]) { const q = await k.pt(t, c); const ok = await p.ev(`(() => { const e = document.elementFromPoint(${q.x}, ${q.y}); const s = document.querySelector('${A} .stage').getBoundingClientRect(); if (${q.x} < s.left + 60 || ${q.x} > s.right - 60 || ${q.y} < s.top + 60 || ${q.y} > s.bottom - 60) return false; return !!e && !!e.closest('${A} .stage') && !e.closest('.ui, .evra-card, .ribbon, .evra-tag, [data-thread]'); })()`); if (ok) return c; } return null; };
	k.dragT = async (t0, t1, alt = false) => { const c = await k.free(t0); if (c == null) throw new h.Fail('no free spot to drag from'); const a = await k.pt(t0, c), b = await k.pt(t1, c); await p.drag(a.x, a.y, b.x, b.y, 14, alt ? { modifiers: 1 } : {}); await p.sleep(150); };
	k.mkEra = async (a, b) => { const A1 = await k.pt(a), B1 = await k.pt(b); await p.drag(A1.x, A1.y, B1.x, B1.y); await p.sleep(200); if (!(await h.pop('[data-m=era]'))) return null; await h.clickPop('[data-m=era]'); await p.sleep(250); const d = await h.doc(); const e = d.eras[d.eras.length - 1]; const meta = await p.ev(`(document.querySelector('${A} [data-r=pop] .meta')||{}).textContent`); await p.key('Escape'); await p.sleep(150); return { ...e, meta }; };
	k.addSpans = (n, t0, len, side = 'b') => p.ev(`(() => { const t = ${h.tl}; const d = JSON.parse(JSON.stringify(t.getDoc())); for (let i = 0; i < ${n}; i++) d.events.push({ id: 'sp' + i, t: ${t0} + i * 20, end: ${t0} + i * 20 + ${len}, side: '${side}', title: 'Span ' + i, text: '', color: String(i % 8 + 1), file: null }); t.setDoc(d); return 1; })()`).then(() => p.sleep(300));
	k.addMany = (n, t0, t1) => p.ev(`(() => { const t = ${h.tl}; const d = JSON.parse(JSON.stringify(t.getDoc())); for (let i = 0; i < ${n}; i++) d.events.push({ id: 'm' + i, t: Math.round(${t0} + (${t1} - ${t0}) * i / ${n}), side: i % 2 ? 'a' : 'b', title: 'Moment ' + i, text: 'Some words about moment ' + i, color: String(i % 8 + 1), file: null }); t.setDoc(d); return 1; })()`).then(() => p.sleep(300));
	k.setDate = async (key, val) => { await p.ev(`(() => { const i = document.querySelector('${A} [data-r=pop] [data-d=${key}]'); i.value = '${val}'; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200); };
	k.openEd = async (id) => { const e = await k.era(id); const span = e.end - e.start; await k.view(e.start - span * 0.2, span * 1.4); const r = await p.at(`${A} rect[data-era="${id}"]`); await p.click(r.x, r.y); await p.sleep(300); return h.popOpen(); };
	k.scale = async () => (await p.ev(`${h.tl}.getViewState()`)).scale;
	return k;
}

/* ---------- creating eras ---------- */
for (const d of DIRS) test(`[${d}] dragging along the line nests eras past four levels`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(13975, 40); // inside Hunger Moon, itself level 4
	const want = [[13984, 14006], [13988, 14002], [13992, 13999], [13996, 13993]];
	let parent = 's1b';
	for (let i = 0; i < want.length; i++) {
		const e = await k.mkEra(...want[i]);
		t.ok(e, `create menu ${i}`);
		t.eq(e.parent, parent, `level ${5 + i} nests in the previous one`);
		t.eq(e.meta, `Sub-era, level ${5 + i}`, 'editor shows the level');
		t.eq(e.start, Math.min(...want[i]), 'start'); t.eq(e.end, Math.max(...want[i]), 'end');
		parent = e.id;
	}
	t.ok(/Hunger Moon›New era›New era›New era›New era$/.test(await p.ev(`document.querySelector('${A} .crumb').textContent.replace(/⌄/g, '')`)), 'breadcrumb shows every level');
});
test('a drag that spills over its parent is clamped inside it', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.view(13900, 200);
	const e = await k.mkEra(13990, 14060); // Hunger Moon 13980-14010: the midpoint 14025 is outside it -> sibling in Siege Winter
	t.ok(e, 'menu');
	const hm = await k.era('s1b');
	t.ok(e.parent === 's1a' && (e.start >= hm.end || e.end <= hm.start), 'kept clear of its sibling: ' + JSON.stringify(e));
});

/* ---------- era editor ---------- */
test('era editor: typed dates clamp to children and siblings, move shared edges and extend the range', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	t.ok(await k.openEd('s1'), 'editor opens from the rail');
	await k.setDate('eY', '50');
	t.eq((await k.era('s1')).end, 18000, 'end moved'); t.eq((await k.era('s2')).start, 18000, 'the sibling sharing the edge moved too');
	await k.setDate('sY', '70');
	t.eq((await k.era('s1')).start, 13590, 'start stops at its first sub-era');
	t.ok(/Kept inside/.test(await h.toast()), 'says why');
	t.eq(await p.ev(`document.querySelector('${A} [data-r=pop] [data-d=sY]').value`), '37', 'fields show the clamped date');
	await p.key('Escape'); await p.sleep(200);
	await k.openEd('k'); await k.setDate('sY', '-20');
	t.eq((await k.era('k')).start, -7200, 'top-level era may start before the range'); t.eq((await h.doc()).range[0], -20, 'range extended');
	t.eq((await k.era('k1')).start, -7200, 'a sub-era sharing the edge moved with it');
	await k.setDate('sD', '45'); t.eq((await k.era('k')).start, -7171, 'day clamped to the month');
	await p.key('Escape'); await p.sleep(200);
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await k.era('k')).start, 0, 'one undo reverts the editing session');
});
test('era editor: name, abbreviation and color save together and undo as one', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s2');
	await p.key('a', 'ctrl'); await p.type('Quiet');
	const ab = await h.pop('[data-k=eraAbbr]'); await p.click(ab.x, ab.y); await p.type('QY');
	await h.clickPop('.swb[data-color="3"]');
	await p.key('Escape'); await p.sleep(200);
	const s = (await h.saved()).eras.find((e) => e.id === 's2');
	t.eq(s.name, 'Quiet', 'name'); t.eq(s.abbr, 'QY', 'abbr'); t.eq(s.color, '3', 'color');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	const u = await k.era('s2');
	t.ok(u.name === 'The Quiet Years' && !u.abbr && u.color === '4', 'undone together');
});
test('era editor: add sub-era fills the biggest gap; a full era says so; delete moves children up', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s1'); await h.clickPop('[data-m=sub]'); await p.sleep(700);
	let d = await h.doc(); const sub = d.eras[d.eras.length - 1];
	t.ok(sub.parent === 's1' && sub.start === 7920 && sub.end === 13590, 'fills the gap before Siege Winter');
	t.eq(await p.ev(`document.activeElement.dataset.k`), 'eraName', 'its editor opens, ready to name');
	await p.key('Escape'); await p.sleep(200);
	await k.openEd('k'); await h.clickPop('[data-m=sub]'); await p.sleep(300);
	t.ok(/already full/.test(await h.toast()), 'full era');
	await k.openEd('s1a'); await h.clickPop('[data-m=del]'); await p.sleep(300);
	d = await h.doc();
	t.ok(!d.eras.some((e) => e.id === 's1a'), 'deleted'); t.eq(d.eras.find((e) => e.id === 's1b').parent, 's1', 'child moved up');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await k.era('s1b')).parent, 's1a', 'undo restores the nesting');
	await k.openEd('s'); await h.clickPop('[data-m=del]'); await p.sleep(300);
	t.eq((await h.doc()).eras.filter((e) => !e.parent).map((e) => e.name).join(','), 'The Kindling,Reign of Ash,The Quiet Years,Restoration', 'top-level children become top level');
});
test('deleting an era without sub-eras does not claim sub-eras moved', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await k.openEd('s3'); await h.clickPop('[data-m=del]'); await p.sleep(250);
	t.ok(!/sub-eras moved/.test(await h.toast()), 'toast: ' + (await h.toast()));
});
test('clicking a short era on the rail opens its editor', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	await h.run('fit-all'); await p.sleep(700);
	const r = await p.at(`${A} rect[data-era="s1a"]`); // Siege Winter: about 11px tall at this zoom
	t.ok(r && r.h < 14, 'short rail bar');
	t.eq(await p.ev(`document.elementFromPoint(${r.x}, ${r.y}).dataset.era`), 's1a', 'the bar is what is under the pointer');
	await p.click(r.x, r.y); await p.sleep(300);
	t.ok(await h.popOpen(), 'editor opens (a click near any era edge is taken as an edge drag instead)');
});

/* ---------- era edges ---------- */
for (const d of DIRS) test(`[${d}] dragging era edges: shared edges move together, Alt splits, nested edges follow`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(5000, 15000);
	await k.dragT(16920, 17640);
	t.eq((await k.era('s1')).end, 17640, 'edge moved'); t.eq((await k.era('s2')).start, 17640, 'neighbour moved');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await k.era('s1')).end, 16920, 'undo');
	await k.dragT(16920, 16200, true);
	t.eq((await k.era('s1')).end, 16200, 'alt: this era'); t.eq((await k.era('s2')).start, 16920, 'alt: neighbour stays');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(200);
	await k.dragT(7920, 8640);
	const e = await Promise.all(['k', 'k2', 's', 's1'].map(k.era));
	t.eq([e[0].end, e[1].end, e[2].start, e[3].start].join(), '8640,8640,8640,8640', 'top-level edge carries nested edges on both sides');
});

/* ---------- labels, breadcrumb ---------- */
for (const d of DIRS) test(`[${d}] era label click edits, right-click fits; breadcrumb and sibling list fit`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(12000, 4000);
	const lab = await p.at(`${A} .eralabels .el[data-era="s1a"]`);
	t.ok(lab, 'label');
	await p.click(lab.x, lab.y); await p.sleep(300);
	t.eq(await p.ev(`document.querySelector('${A} [data-r=pop] [data-k=eraName]').value`), 'Siege Winter', 'editor');
	await p.key('Escape'); await p.sleep(150);
	await p.right(lab.x, lab.y); await p.sleep(700);
	let [a, b] = await k.vis();
	t.ok(a <= 13590 && b >= 14130 && Math.abs((a + b) / 2 - 13860) < 2, 'fits the era');
	t.ok(!(await h.popOpen()), 'no menu');
	const cb = await p.at(`${A} .crumb button[data-era="s"]`); await p.click(cb.x, cb.y); await p.sleep(700);
	[a, b] = await k.vis(); t.ok(a <= 7920 && b >= 28800, 'breadcrumb fits');
	const ch = await p.at(`${A} .crumb .chev[data-sib="s"]`); await p.click(ch.x, ch.y); await p.sleep(250);
	t.eq(await p.ev(`[...document.querySelectorAll('${A} [data-r=pop] [data-go]')].map(b => b.textContent).join('|')`), 'The Kindling|The Second Age ·', 'siblings');
	await h.clickPop('[data-go="k"]'); await p.sleep(700);
	[a, b] = await k.vis(); t.ok(a <= 0 && b >= 7920 && b < 12000, 'sibling fitted');
});
for (const d of DIRS) test(`[${d}] the breadcrumb is never covered by ruler labels or name tags`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(13975, 40);
	for (const r of [[13984, 14006], [13988, 14002], [13992, 13999]]) await k.mkEra(...r); // a long breadcrumb
	for (const v of [[12600, 3600], [13975, 40], [11000, 16 * 360]]) {
		await k.view(...v);
		const covered = await p.ev(`[...document.querySelectorAll('${A} .crumb button')].map(b => { const r = b.getBoundingClientRect(); const pts = [[r.left + 4, r.top + r.height / 2], [r.left + r.width / 2, r.top + r.height / 2], [r.right - 4, r.top + r.height / 2]]; return pts.some(([x, y]) => { const e = document.elementFromPoint(x, y); return e && !e.closest('.crumb'); }) ? b.textContent : null; }).filter(Boolean)`);
		t.ok(!covered.length, `covered at ${v}: ${covered.join(', ')}`);
	}
});
test('[ltr] era labels never cover the view controls', async (p, h, t) => {
	const k = kit(p, h); await k.start('ltr');
	for (let v0 = 9000; v0 <= 16000; v0 += 500) {
		await k.view(v0, 20 * 360);
		const bad = await p.ev(`[...document.querySelectorAll('${A} .ctrls [data-c]')].filter(b => { const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && !b.contains(e); }).map(b => b.dataset.c)`);
		t.ok(!bad.length, `buttons covered at v0=${v0}: ${bad.join(',')}`);
	}
});

/* ---------- spans ---------- */
for (const d of DIRS) test(`[${d}] more than six overlapping spans share a bundled lane whose +N sits on it`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.addSpans(9, 20000, 1500);
	await k.view(19800, 2400);
	const b = await p.at(`${A} .bundles .bundle`);
	t.ok(b, '+N marker');
	t.eq(await p.ev(`document.querySelector('${A} .bundles .bundle').textContent`), '+5', 'counts the bundled spans');
	const strand = await p.ev(`[...document.querySelectorAll('${A} .lines line')].filter(l => /dasharray: ?1 3/.test(l.getAttribute('style') || '')).map(l => { const r = l.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })[0]`);
	t.ok(strand, 'bundled strand');
	const on = strand[0] - 12 <= b.x && b.x <= strand[2] + 12 && strand[1] - 12 <= b.y && b.y <= strand[3] + 12;
	t.ok(on, `marker at ${Math.round(b.x)},${Math.round(b.y)} is off the strand ${strand.map(Math.round)}`);
	await p.click(b.x, b.y); await p.sleep(250);
	t.eq(await p.ev(`document.querySelectorAll('${A} [data-r=pop] [data-go]').length`), 5, 'lists them');
	await h.clickPop('[data-go="sp8"]'); await p.sleep(700);
	const [a, z] = await k.vis(); t.ok(a <= 20160 && z >= 21660, 'zooms to the chosen span');
});
for (const d of DIRS) test(`[${d}] span name tags pin to the leading edge and bring the start back`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.addSpans(5, 20000, 1500);
	await k.view(20600, 600);
	const tags = await p.ev(`[...document.querySelectorAll('${A} .tags .evra-tag')].map(b => { const r = b.getBoundingClientRect(); return { id: b.dataset.ev, x: r.left, y: r.top, r: r.right, b: r.bottom }; })`);
	t.ok(tags.filter((x) => /^sp/.test(x.id)).length === 5, 'a tag per span');
	const s = await h.stage(), T = tags[0];
	const lead = { ttb: T.y < s.t + 60, btt: T.b > s.t + s.h - 90, ltr: T.x < s.l + 40, rtl: T.r > s.l + s.w - 40 }[d];
	t.ok(lead, 'at the leading edge ' + JSON.stringify(T));
	const tg = await p.at(`${A} .tags .evra-tag[data-ev="sp0"]`); await p.click(tg.x, tg.y); await p.sleep(700);
	const [a, b] = await k.vis(); t.ok(a <= 20000 && 20000 <= b, 'start in view');
	t.ok(!(await p.at(`${A} .tags .evra-tag[data-ev="sp0"]`)), 'tag goes once the start is in view');
});
for (const d of DIRS) test(`[${d}] block spans: a long span keeps its card in view while its block fills the view`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await h.run('spans-blocks'); await p.sleep(300);
	const mira = (await h.events()).find((e) => e.oe);
	t.ok(mira, 'an ongoing span');
	const off = [];
	for (let y = 36; y <= 69; y += 3) {
		await k.view(y * 360, 600);
		const inView = await p.ev(`(() => { const c = document.querySelector('${A} .cards > .evra-card[data-id="${mira.id}"]'); const s = document.querySelector('${A} .stage').getBoundingClientRect(); if (!c) return false; const r = c.getBoundingClientRect(); return r.bottom > s.top && r.top < s.bottom && r.right > s.left && r.left < s.right; })()`);
		if (!inView) off.push(y);
	}
	t.ok(!off.length, 'card out of view at years ' + off.join(','));
});
test('threads and blocks switch by command in every direction', async (p, h, t) => {
	const k = kit(p, h); await k.start('ttb');
	for (const d of DIRS) {
		await h.run('direction-' + d); await p.sleep(300);
		await h.run('spans-blocks'); await p.sleep(300);
		t.ok((await p.ev(`document.querySelectorAll('${A} .ribbon').length`)) > 0 && (await p.ev(`document.querySelectorAll('${A} [data-thread]').length`)) === 0, d + ' blocks');
		await h.run('spans-threads'); await p.sleep(300);
		t.ok((await p.ev(`document.querySelectorAll('${A} [data-thread]').length`)) > 0 && (await p.ev(`document.querySelectorAll('${A} .ribbon').length`)) === 0, d + ' threads');
	}
});

/* ---------- navigation ---------- */
for (const d of DIRS) test(`[${d}] ctrl+wheel zooms at the pointer; wheel, drag, keys, buttons and fit`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(9000, 20 * 360);
	const c = await k.free(12600), q = await k.pt(12600, c), t0 = await k.tAt(q.x, q.y), sc0 = await k.scale();
	for (let i = 0; i < 3; i++) { await p.wheel(q.x, q.y, -100, true); await p.sleep(30); }
	await p.sleep(200);
	t.ok((await k.scale()) > sc0, 'zoomed in'); t.ok(Math.abs((await k.tAt(q.x, q.y)) - t0) < 3, 'the date under the pointer stays put');
	const v0 = (await p.ev(`${h.tl}.getViewState()`)).v0;
	await p.wheel(q.x, q.y, 200); await p.sleep(200);
	t.eq(Math.sign((await p.ev(`${h.tl}.getViewState()`)).v0 - v0), d === 'btt' ? -1 : 1, 'wheel scrolls like a page');
	const c2 = await k.free(12600), a = await k.pt(12600, c2), ta = await k.tAt(a.x, a.y), vert = d === 'ttb' || d === 'btt';
	const bx = vert ? a.x : a.x + 120, by = vert ? a.y + 120 : a.y;
	await p.drag(a.x, a.y, bx, by); await p.sleep(200);
	t.ok(Math.abs((await k.tAt(bx, by)) - ta) < 1, 'dragging pans with the pointer');
	await h.focusStage();
	const s2 = await k.scale(); await p.key('+'); await p.sleep(450); const s3 = await k.scale(); await p.key('-'); await p.sleep(450); const s4 = await k.scale();
	t.ok(s3 / s2 > 1.5 && s4 / s3 < 0.7, 'keys');
	const bi = await h.ctrl('in'); await p.click(bi.x, bi.y); await p.sleep(450); const s5 = await k.scale();
	const bo = await h.ctrl('out'); await p.click(bo.x, bo.y); await p.sleep(450); const s6 = await k.scale();
	t.ok(s5 / s4 > 1.5 && s6 / s5 < 0.7, 'buttons');
	const bf = await h.ctrl('fit'); await p.click(bf.x, bf.y); await p.sleep(700);
	const [va, vb] = await k.vis(); t.ok(va <= 0 && vb >= 28800, 'fit all');
});
for (const d of DIRS) test(`[${d}] go to now, zoom to selection and the minimap`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.view(0, 3600);
	await h.focusStage(); await p.key('.'); await p.sleep(700);
	let [a, b] = await k.vis(); t.ok(Math.abs((a + b) / 2 - 18819) < 2, 'now centered');
	const ev = await h.ev('Treaty of Sallow');
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(ev.id)})`); await p.sleep(700);
	await k.view(0, 3600); await h.run('zoom-selection'); await p.sleep(700);
	[a, b] = await k.vis(); t.ok(ev.t >= a && ev.t <= b, 'zoom to selection');
	const mm = await p.at(`${A} .minimap`), vert = d === 'ttb' || d === 'btt', rev = d === 'btt' || d === 'rtl';
	const at = (f) => vert ? [mm.x, rev ? mm.t + mm.h * (1 - f) : mm.t + mm.h * f] : [rev ? mm.l + mm.w * (1 - f) : mm.l + mm.w * f, mm.y];
	const [cx, cy] = at(0.25); await p.click(cx, cy); await p.sleep(300);
	[a, b] = await k.vis(); t.ok(Math.abs((a + b) / 2 - 7200) < 150, 'minimap click centers there');
	const [dx, dy] = at(0.75); await p.drag(cx, cy, dx, dy); await p.sleep(300);
	[a, b] = await k.vis(); t.ok(Math.abs((a + b) / 2 - 21600) < 150, 'minimap drag follows');
});
for (const d of DIRS) test(`[${d}] crowded cards scroll across the line with a scrollbar`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.addMany(300, 0, 28800);
	await k.view(10000, 10 * 360);
	t.ok(await p.ev(`!document.querySelector('${A} .xbar').hidden`), 'scrollbar shows');
	const th = await p.at(`${A} [data-r=xthumb]`), vert = d === 'ttb' || d === 'btt';
	await p.drag(th.x, th.y, vert ? th.x + 40 : th.x, vert ? th.y : th.y + 40); await p.sleep(250);
	const x1 = (await p.ev(`${h.tl}.getViewState()`)).x;
	t.ok(x1 > 0, 'thumb drag scrolls');
	const s = await h.stage();
	for (let i = 0; i < 30; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: s.x, y: s.y, deltaX: 0, deltaY: 400, modifiers: 8 });
	await p.sleep(250);
	const x2 = (await p.ev(`${h.tl}.getViewState()`)).x;
	t.ok(x2 >= x1, 'shift+wheel scrolls across');
	const th2 = await p.at(`${A} [data-r=xthumb]`), bar = await p.at(`${A} .xbar`);
	t.ok(vert ? Math.abs(th2.l + th2.w - (bar.l + bar.w)) < 2 : Math.abs(th2.t + th2.h - (bar.t + bar.h)) < 2, 'clamped at the end, thumb at the end');
});
for (const d of DIRS) test(`[${d}] level of detail: full, compact with peek, dots with clusters and era names`, async (p, h, t) => {
	const k = kit(p, h); await k.start(d);
	await k.addMany(300, 0, 28800);
	const info = () => p.ev(`({ full: document.querySelectorAll('${A} .cards > .evra-card:not(.compact):not(.group):not(.peek)').length, compact: document.querySelectorAll('${A} .cards > .evra-card.compact').length, clusters: document.querySelectorAll('${A} .lines .cl-t').length, eraNames: document.querySelectorAll('${A} .lines .era-big, ${A} .lines .era-mid').length })`);
	await k.view(10000, 3 * 360); let i = await info(); t.ok(i.full > 5 && !i.compact, 'full ' + JSON.stringify(i));
	await k.view(10000, 25 * 360); i = await info(); t.ok(i.compact > 20 && !i.full, 'compact ' + JSON.stringify(i));
	const c = await p.ev(`(() => { const s = document.querySelector('${A} .stage').getBoundingClientRect(); for (const e of document.querySelectorAll('${A} .cards > .evra-card.compact')) { const r = e.getBoundingClientRect(); const x = r.x + r.width / 2, y = r.y + r.height / 2; if (x < s.left + 20 || x > s.right - 80 || y < s.top + 60 || y > s.bottom - 60) continue; const hit = document.elementFromPoint(x, y); if (hit && hit.closest('.evra-card') === e) return { x, y }; } return null; })()`);
	t.ok(c, 'a compact card under the pointer');
	await p.move(c.x, c.y); await p.sleep(600);
	const pk = await p.at(`${A} .evra-card.peek`), s = await h.stage();
	t.ok(pk && pk.l >= s.l - 1 && pk.t >= s.t - 1 && pk.l + pk.w <= s.l + s.w + 1 && pk.t + pk.h <= s.t + s.h + 1, 'peek opens inside the stage');
	await p.move(s.l + 5, s.t + 5); await p.sleep(300);
	t.ok(!(await p.at(`${A} .evra-card.peek`)), 'peek closes');
	await h.run('fit-all'); await p.sleep(700); i = await info();
	t.ok(!i.full && !i.compact && i.clusters > 5 && i.eraNames > 0, 'dots ' + JSON.stringify(i));
	const cl = await p.ev(`(() => { const e = document.querySelector('${A} .lines .cl-t'); const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
	const sc = await k.scale(); await p.click(cl.x, cl.y); await p.sleep(700);
	t.ok((await k.scale()) > sc, 'clicking a cluster zooms in');
});
