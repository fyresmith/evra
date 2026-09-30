// QA: editing, cards, keyboard, menus, pins, lifespans, undo/redo.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const byId = async (h, id) => (await h.events()).find((e) => e.id === id);
const COMET = 'od0fr4a', ARCHIVE = 'o1vh9cb', SIEGE = 'zrzotia', PLAGUE = 'pnf2q3k', MIRA = '4ru3c01';
/** screen y of a date on the (vertical) timeline */
const yOf = (p, h, t) => p.ev(`(() => { const v = ${h.tl}.getViewState(); const s = document.querySelector('${A} .stage').getBoundingClientRect(); return s.y + (${t} - v.v0) * v.scale; })()`);
const selCount = (p) => p.ev(`document.querySelectorAll('${A} .evra-card.sel').length`);
const selectIds = (p, h, ids) => p.ev(`(() => { ${h.tl}; return 1; })()`).then(async () => {
	// click the first, shift-click the rest
	for (let i = 0; i < ids.length; i++) {
		const c = await p.at(`${A} .evra-card[data-id="${ids[i]}"] .dt`) || await p.at(`${A} .evra-card[data-id="${ids[i]}"]`);
		if (!c) throw new Error('card not visible: ' + ids[i]);
		await p.click(c.x, c.y, i ? { modifiers: 8 } : {});
	}
	await p.sleep(120);
});

/* ---------- adding and editing ---------- */
test('edit: Enter-to-next chains three events, each saved with its own date', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x - 170, s.t + 300); await p.sleep(400);
	for (const name of ['One', 'Two', 'Three']) {
		await p.key('a', 'ctrl'); await p.type(name); await p.key('Enter'); await p.type('desc ' + name); await p.key('Enter'); await p.sleep(400);
	}
	await p.key('Escape'); await p.sleep(200);
	const evs = await h.events();
	t.eq(evs.length, n + 4, 'three named + one trailing new event');
	const [a, b, c] = ['One', 'Two', 'Three'].map((k) => evs.find((e) => e.title === k));
	t.ok(a && b && c, 'all saved');
	t.ok(a.t < b.t && b.t < c.t, 'each one later than the last');
	t.eq(b.text, 'desc Two', 'desc saved');
	const saved = await h.saved();
	t.ok(saved.events.some((e) => e.title === 'Three'), 'on disk');
});
test('edit: empty title becomes Untitled; whitespace trimmed; Shift+Enter keeps a newline', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.key('Backspace'); await p.key('Enter');
	await p.key('a', 'ctrl'); await p.type('  line1  '); await p.key('Escape'); await p.sleep(200);
	const e = await byId(h, SIEGE);
	t.eq(e.title, 'Untitled', 'empty title');
	t.eq(e.text, 'line1', 'trimmed');
});
test('edit: 256 limit also holds when pasting into existing text, and counter says so', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250); await p.key('Enter');
	await p.type('abc');
	await p.send('Input.insertText', { text: 'y'.repeat(260) }); await p.sleep(100);
	await p.send('Input.insertText', { text: 'zzz' }); await p.sleep(100);
	t.ok(await p.ev(`document.querySelector('${A} .evra-card.editing .cnt').textContent === '256/256'`), 'counter');
	await p.key('Escape'); await p.sleep(150);
	const e = await byId(h, SIEGE);
	t.eq(e.text.length, 256, 'clipped');
	t.ok(e.text.startsWith('abc'), 'kept the start');
	t.eq((await h.saved()).events.find((x) => x.id === SIEGE).text.length, 256, 'saved clipped');
});
test('edit: a new event plus its edit undo fully, and redo brings the title back', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x - 170, s.t + 300); await p.sleep(400);
	await p.key('a', 'ctrl'); await p.type('Undo me'); await p.key('Escape'); await p.sleep(200);
	t.ok((await h.events()).some((e) => e.title === 'Undo me'), 'added');
	await p.key('z', 'ctrl'); await p.sleep(100);
	await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await h.events()).length, n, 'two undos remove it');
	await p.key('y', 'ctrl'); await p.key('y', 'ctrl'); await p.sleep(150);
	t.ok((await h.events()).some((e) => e.title === 'Undo me'), 'redo');
});
test('edit: N while editing saves the current edit (no stray text)', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Renamed');
	// clicking elsewhere ends the edit
	await h.focusStage(); await p.sleep(200);
	t.eq((await byId(h, SIEGE)).title, 'Renamed', 'saved on blur');
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`)), 'not editing');
	await p.key('n'); await p.sleep(300); await p.key('Escape'); await p.sleep(150);
	t.ok(!(await h.events()).some((e) => e.title === 'Renamedn' || /n$/.test(e.title) && e.id === SIEGE), 'N not typed into the card');
});

/* ---------- keyboard ---------- */
test('keys: Alt+arrow nudges one day; plain arrow one step; K goes back', async (p, h, t) => {
	await h.open(); await h.focusStage();
	await selectIds(p, h, [SIEGE]);
	const t0 = (await byId(h, SIEGE)).t;
	await p.key('ArrowDown', 'alt'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).t, t0 + 1, 'alt = 1 day');
	await p.key('ArrowUp', 'alt'); await p.key('ArrowUp', 'alt'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).t, t0 - 1, 'alt up');
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).t, t0, 'undone three nudges');
	await p.key('k'); await p.sleep(100);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), 'K selects');
});
test('keys: 0 clears color, 7+ with a 6-color palette does nothing, E edits, L opens menu', async (p, h, t) => {
	await h.open(); await h.focusStage();
	await selectIds(p, h, [SIEGE]);
	await p.key('0'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, null, '0 clears');
	await p.key('7'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, null, '7 ignored');
	await p.key('6'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, '6', '6');
	await p.key('l'); await p.sleep(200);
	t.ok(await h.popOpen(), 'L opens menu');
	await p.key('Escape'); await p.sleep(100);
	await selectIds(p, h, [SIEGE]);
	await p.key('e'); await p.sleep(250);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`), 'E edits');
	await p.key('Escape');
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, '1', 'undo restores original color');
});
test('keys: Ctrl+Z with an empty history and Ctrl+Y with nothing to redo are harmless', async (p, h, t) => {
	await h.open(); await h.focusStage();
	const before = JSON.stringify(await h.doc());
	for (let i = 0; i < 5; i++) { await p.key('z', 'ctrl'); await p.key('y', 'ctrl'); await p.key('z', 'ctrl', 'shift'); }
	await p.sleep(100);
	t.eq(JSON.stringify(await h.doc()), before, 'unchanged');
});
test('regression: keys: Delete on a multi-selection, then undo restores every card', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await h.focusStage();
	await selectIds(p, h, [SIEGE, PLAGUE]);
	t.eq(await selCount(p), 2, 'two selected');
	const n = (await h.events()).length;
	await p.key('Delete'); await p.sleep(150);
	t.eq((await h.events()).length, n - 2, 'deleted both');
	t.ok(/Deleted 2/.test(await h.toast()), 'toast');
	t.ok(await p.ev(`document.querySelector('${A}').contains(document.activeElement)`), 'BUG: focus left the timeline after deleting the focused card (' + await p.ev('document.activeElement.className') + ')');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'undo');
	t.eq((await h.saved()).events.length, n, 'saved');
});
test('keys: S on a lifespan and back does not leave "life" on a moment', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await h.focusStage();
	await selectIds(p, h, [PLAGUE]);
	await h.menu('Plague of Salt'); await h.clickPop('[data-m=life]');
	t.ok((await byId(h, PLAGUE)).life, 'is a life');
	await selectIds(p, h, [PLAGUE]);
	await p.key('s'); await p.sleep(150);
	const e = await byId(h, PLAGUE);
	t.ok(e.end == null, 'now a moment');
	t.ok(!e.life, 'BUG: a single moment still carries life:true (no way to see or clear it from the menu)');
});
test('keys: Ctrl+D duplicates a span keeping its length; Ctrl+V pastes a multi-selection keeping gaps', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await h.focusStage();
	await selectIds(p, h, [PLAGUE]);
	const o = await byId(h, PLAGUE), n = (await h.events()).length;
	await p.key('d', 'ctrl'); await p.sleep(200);
	const dup = (await h.events()).filter((e) => e.title === 'Plague of Salt' && e.id !== PLAGUE)[0];
	t.ok(dup, 'duplicated'); t.eq(dup.end - dup.t, o.end - o.t, 'same length'); t.ok(dup.t > o.t, 'later');
	await selectIds(p, h, [SIEGE, PLAGUE]);
	const s = await byId(h, SIEGE);
	await p.key('c', 'ctrl');
	const st = await h.stage(); await p.move(st.l + 200, st.t + 150); await p.key('v', 'ctrl'); await p.sleep(200);
	const evs = await h.events();
	t.eq(evs.length, n + 3, 'pasted two');
	const ps = evs.slice(-2);
	t.eq(Math.abs(ps[1].t - ps[0].t), Math.abs(o.t - s.t), 'gap kept');
	t.eq(await selCount(p), 2, 'pasted cards selected');
	await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await h.events()).length, n + 1, 'one undo removes the whole paste');
});
test('keys: copying a pinned card and pasting drops the pin', async (p, h, t) => {
	await h.open(); await h.setView(50, 20); await h.focusStage();
	await selectIds(p, h, [ARCHIVE]);
	await p.key('c', 'ctrl'); await p.key('v', 'ctrl'); await p.sleep(200);
	const c = (await h.events()).slice(-1)[0];
	t.eq(c.title, 'Founding of the Archive', 'pasted');
	t.ok(!c.rel, 'no pin on the copy');
});

/* ---------- drags ---------- */
test('drag: Alt drag moves by single days; plain drag snaps', async (p, h, t) => {
	await h.open(); await h.setView(34, 6);
	const c = await h.card('Siege of the Keep begins', '.dt'), t0 = (await byId(h, SIEGE)).t;
	await p.drag(c.x, c.y, c.x, c.y + 37, 10, { modifiers: 1 });
	const t1 = (await byId(h, SIEGE)).t;
	t.ok(t1 !== t0, 'moved');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).t, t0, 'undo');
});
test('drag: resizing a span end, and dragging the end past the start turns it into a moment; undo', async (p, h, t) => {
	await h.open(); await h.setView(38, 8);
	const o = await byId(h, PLAGUE), x = await h.lineX(), ye = await yOf(p, h, o.end), ys = await yOf(p, h, o.t);
	await p.drag(x, ye, x, ye + 80);
	const a = await byId(h, PLAGUE);
	t.ok(a.end > o.end, 'end moved later'); t.eq(a.t, o.t, 'start kept');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await byId(h, PLAGUE)).end, o.end, 'undo');
	await p.drag(x, ye, x, ys - 60);
	const b = await byId(h, PLAGUE);
	t.ok(b.end == null || b.end >= b.t, 'never negative length');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await byId(h, PLAGUE)).end, o.end, 'undo collapse');
});
test('drag: a pinned card dragged changes its gap; the anchor dragged carries it', async (p, h, t) => {
	await h.open(); await h.setView(50, 20);
	const a0 = await byId(h, ARCHIVE), c0 = await byId(h, COMET);
	const ac = await h.card('Founding of the Archive', '.dt'); await p.drag(ac.x, ac.y, ac.x, ac.y + 60);
	const a1 = await byId(h, ARCHIVE);
	t.ok(a1.t > a0.t && a1.rel && a1.rel.offset === a1.t - c0.t, 'gap changed, still pinned');
	const cc = await h.card('The pale comet', '.dt'); await p.drag(cc.x, cc.y, cc.x, cc.y + 60);
	const c2 = await byId(h, COMET), a2 = await byId(h, ARCHIVE);
	t.eq(a2.t - c2.t, a1.rel.offset, 'follows');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await byId(h, ARCHIVE)).t, a1.t, 'undo moves it back too');
});
test('keys: nudging an anchor together with its pinned card moves both by the same amount (was double-moved before keepPins)', async (p, h, t) => {
	await h.open(); await h.setView(50, 20); await h.focusStage();
	await selectIds(p, h, [COMET, ARCHIVE]);
	t.eq(await selCount(p), 2, 'two selected');
	const a0 = await byId(h, ARCHIVE), c0 = await byId(h, COMET);
	await p.key('ArrowDown'); await p.sleep(150);
	const a1 = await byId(h, ARCHIVE), c1 = await byId(h, COMET);
	t.ok(c1.t > c0.t, 'anchor moved');
	t.eq(a1.t - a0.t, c1.t - c0.t, 'pinned card moved by the same amount as the anchor');
});
test('drag: dragging an anchor together with its pinned card moves both by the same amount', async (p, h, t) => {
	await h.open(); await h.setView(50, 20);
	await selectIds(p, h, [COMET, ARCHIVE]);
	const a0 = await byId(h, ARCHIVE), c0 = await byId(h, COMET);
	const cc = await h.card('The pale comet', '.dt'); await p.drag(cc.x, cc.y, cc.x, cc.y + 80);
	const a1 = await byId(h, ARCHIVE), c1 = await byId(h, COMET);
	t.ok(c1.t > c0.t, 'moved');
	t.eq(a1.t - a0.t, c1.t - c0.t, 'moved together by the same amount');
});
test('drag: marquee with shift selects cards; group drag moves them equally; one undo', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const s = await h.stage(), x = await h.lineX();
	const a = await h.card('Siege of the Keep begins'), b = await h.card('Plague of Salt');
	t.ok(a && b, 'visible');
	const y0 = Math.min(a.t, b.t) - 10, y1 = Math.max(a.t + a.h, b.t + b.h) + 10;
	await p.move(s.l + s.w - 20, y0);
	await p.drag(s.l + s.w - 20, y0, s.l + 20, y1, 14, { modifiers: 8 });
	const n = await selCount(p);
	t.ok(n >= 2, 'marquee selected ' + n);
	const before = await h.events();
	const c = await h.card('Siege of the Keep begins', '.dt'); await p.drag(c.x, c.y, c.x, c.y + 50);
	const after = await h.events();
	const moved = after.filter((e) => before.find((b) => b.id === e.id).t !== e.t);
	t.ok(moved.length >= 2, 'several moved');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify((await h.events()).map((e) => e.t)), JSON.stringify(before.map((e) => e.t)), 'one undo');
});

/* ---------- card menu ---------- */
test('menu: new color preset (+) adds to the palette and colors the card; one undo reverts both', async (p, h, t) => {
	await h.open();
	const n = (await h.doc()).palette.length;
	await h.menu('Siege of the Keep begins');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-r=pop] [data-newcolor]'); i.value = '#123456'; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200);
	const d = await h.doc();
	t.eq(d.palette.length, n + 1, 'preset added');
	const pre = d.palette[n];
	t.eq(pre.hex, '#123456', 'hex');
	t.eq((await byId(h, SIEGE)).color, pre.id, 'card uses it');
	t.ok(!(await h.popOpen()), 'menu closed');
	t.ok((await h.saved()).palette.some((x) => x.hex === '#123456'), 'saved');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(150);
	const u = await h.doc();
	t.eq(u.palette.length, n, 'preset gone'); t.eq(u.events.find((e) => e.id === SIEGE).color, '1', 'color back');
	await p.key('7'); // no preset 7 after undo
	await p.key('z', 'ctrl', 'shift'); await p.sleep(150);
	t.eq((await h.doc()).palette.length, n + 1, 'redo');
});
test('menu: colors, "no color" and icons each record one undo step; icon "–" clears it', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	await h.clickPop('.swb[data-color="2"]'); await h.clickPop('.swb[data-color="3"]'); await h.clickPop('.swb.none');
	t.eq((await byId(h, SIEGE)).color, null, 'no color');
	await h.clickPop('[data-icon="⚓"]'); await h.clickPop('[data-icon=""]');
	t.ok(!('icon' in (await byId(h, SIEGE))), 'icon cleared');
	await p.key('Escape'); await h.focusStage();
	await p.key('z', 'ctrl'); await p.sleep(80); t.eq((await byId(h, SIEGE)).icon, '⚓', 'undo icon clear');
	await p.key('z', 'ctrl'); await p.sleep(80); t.ok(!(await byId(h, SIEGE)).icon, 'undo icon');
	await p.key('z', 'ctrl'); await p.sleep(80); t.eq((await byId(h, SIEGE)).color, '3', 'undo no color');
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(80); t.eq((await byId(h, SIEGE)).color, '1', 'back to start');
});
test('regression: undo while the card menu is open leaves the menu editing a stale card (next pick is lost)', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	await h.clickPop('.swb[data-color="4"]');
	t.eq((await byId(h, SIEGE)).color, '4', 'colored');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).color, '1', 'undone');
	const open = await h.popOpen();
	if (open) {
		await h.clickPop('.swb[data-color="5"]');
		t.eq((await byId(h, SIEGE)).color, '5', 'a pick after undo in the still-open menu applies');
	}
});
test('menu: tags are normalised, de-duplicated, and clearing removes the field', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y); await p.type('#War, war,  big battle , ,#x'); await p.key('Enter'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).tags.join('|'), 'War|war|big-battle|x', 'normalised');
	await h.menu('Siege of the Keep begins');
	const tg2 = await h.pop('[data-k=ctags]'); await p.click(tg2.x, tg2.y); await p.key('a', 'ctrl'); await p.key('Backspace'); await p.key('Enter'); await p.sleep(150);
	t.ok(!('tags' in (await byId(h, SIEGE))), 'cleared');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).tags.length, 4, 'undo');
});
test('menu: tags saved by clicking away (change) create exactly one undo step', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y); await p.type('alpha');
	await h.clickPop('.swb[data-color="2"]'); await p.sleep(100);
	const e = await byId(h, SIEGE);
	t.eq((e.tags || []).join(), 'alpha', 'tags saved on blur'); t.eq(e.color, '2', 'color');
	await p.key('Escape'); await h.focusStage();
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(100);
	const u = await byId(h, SIEGE);
	t.ok(!u.tags && u.color === '1', 'two undos restore both');
});
test('menu: span → unknown start → ongoing → life → back to moment, each undoable', async (p, h, t) => {
	await h.open();
	const o = await byId(h, SIEGE);
	for (const m of ['span', 'os', 'oe', 'life']) { await h.menu('Siege of the Keep begins'); await h.clickPop(`[data-m=${m}]`); }
	let e = await byId(h, SIEGE);
	t.ok(e.end > e.t && e.os && e.oe && e.life, 'all set');
	const saved = (await h.saved()).events.find((x) => x.id === SIEGE);
	t.ok(saved.os && saved.oe && saved.life, 'saved');
	await h.menu('Siege of the Keep begins'); await h.clickPop('[data-m=span]');
	e = await byId(h, SIEGE);
	t.ok(e.end == null && !e.os && !e.oe, 'moment again');
	t.ok(!e.life, 'BUG: life flag left on a single moment');
	await h.focusStage();
	for (let i = 0; i < 5; i++) await p.key('z', 'ctrl');
	await p.sleep(150);
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'five undos restore the original');
});
test('menu: approximate set and cleared (Exact removes circa); undo', async (p, h, t) => {
	await h.open();
	const setC = (i) => p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] [data-m=circa]'); s.value = s.options[${i}].value; s.dispatchEvent(new Event('change')); return 1; })()`);
	await h.menu('Siege of the Keep begins'); await setC(3); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).circa, 360 * 5, '±5 years');
	t.ok(/c\./.test(await p.ev(`document.querySelector('${A} .evra-card[data-id="${SIEGE}"]').textContent`)), 'card shows c.');
	await setC(0); await p.sleep(150);
	t.ok(!('circa' in (await byId(h, SIEGE))), 'exact clears');
	await p.key('Escape'); await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).circa, 1800, 'undo');
});
test('menu: pin to the end of a span, anchor end resized, pinned follows; unpin; undo', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await h.menu('Siege of the Keep begins');
	await p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] [data-m=pin]'); s.value = '${PLAGUE}:end'; s.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200);
	const e = await byId(h, SIEGE), pl = await byId(h, PLAGUE);
	t.ok(e.rel && e.rel.from === 'end' && e.rel.offset === e.t - pl.end, 'pinned to the end');
	t.ok(/Pinned/.test(await h.toast()), 'toast');
	const x = await h.lineX(), ye = await yOf(p, h, pl.end);
	await p.drag(x, ye, x, ye + 60);
	const pl2 = await byId(h, PLAGUE), e2 = await byId(h, SIEGE);
	t.ok(pl2.end > pl.end, 'end moved');
	t.eq(e2.t - pl2.end, e.rel.offset, 'pinned follows the end');
	await h.menu('Siege of the Keep begins'); await h.clickPop('[data-m=unpin]');
	t.ok(!(await byId(h, SIEGE)).rel, 'unpinned');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).rel, 'undo unpin');
});
test('regression: making an end-anchor a single moment makes its pinned card jump by the span length', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await h.menu('Siege of the Keep begins');
	await p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] [data-m=pin]'); s.value = '${PLAGUE}:end'; s.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200);
	const e = await byId(h, SIEGE);
	await h.menu('Plague of Salt'); await h.clickPop('[data-m=span]');
	const e2 = await byId(h, SIEGE);
	t.eq(e2.t, e.t, 'the pinned card stays where it was when its anchor loses its end');
});
test('menu: deleting an anchor drops the pin; undo brings the pin back', async (p, h, t) => {
	await h.open(); await h.setView(50, 20);
	await h.menu('The pale comet'); await h.clickPop('[data-m=del]');
	const a = await byId(h, ARCHIVE);
	t.ok(!a.rel, 'pin dropped');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(150);
	const u = await byId(h, ARCHIVE);
	t.ok(u.rel && u.rel.to === COMET, 'pin restored');
	const cc = await h.card('The pale comet', '.dt'); await p.drag(cc.x, cc.y, cc.x, cc.y + 60);
	t.eq((await byId(h, ARCHIVE)).t - (await byId(h, COMET)).t, u.rel.offset, 'still follows after undo');
});
test('menu: the pin list excludes cards that depend on this one (no loops)', async (p, h, t) => {
	await h.open(); await h.setView(50, 20);
	await h.menu('The pale comet');
	const opts = await p.ev(`[...document.querySelectorAll('${A} [data-r=pop] [data-m=pin] option')].map(o => o.value)`);
	t.ok(!opts.includes(ARCHIVE), 'Archive (pinned to the comet) not offered');
	t.ok(!opts.includes(COMET), 'not itself');
});
test('menu: people involved add an age to the card; unticking removes it; undo', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await h.menu('Siege of the Keep begins');
	const cb = await h.pop(`[data-person="${MIRA}"]`);
	t.ok(cb, 'Mira offered');
	await p.click(cb.x, cb.y); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).people.join(), MIRA, 'people saved');
	await p.key('Escape'); await p.sleep(150);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card[data-id="${SIEGE}"] .ag')`), 'age shows');
	await h.menu('Siege of the Keep begins');
	const cb2 = await h.pop(`[data-person="${MIRA}"]`); await p.click(cb2.x, cb2.y); await p.sleep(150);
	t.ok(!('people' in (await byId(h, SIEGE))), 'removed');
	await p.key('Escape'); await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq(((await byId(h, SIEGE)).people || []).join(), MIRA, 'undo');
});
test('menu: flip, duplicate (keeps span length, later), delete; all undo; saved file agrees', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const orig = JSON.stringify(await h.events());
	await h.menu('Plague of Salt'); await h.clickPop('[data-m=flip]');
	t.eq((await byId(h, PLAGUE)).side, 'b', 'flipped');
	await h.menu('Plague of Salt'); await h.clickPop('[data-m=dup]');
	const d = (await h.events()).slice(-1)[0], o = await byId(h, PLAGUE);
	t.eq(d.end - d.t, o.end - o.t, 'length'); t.ok(d.t > o.t, 'later'); t.eq(d.side, 'b', 'side copied');
	await h.menu('Plague of Salt'); await h.clickPop('[data-m=del]');
	t.ok(!(await byId(h, PLAGUE)), 'deleted');
	await h.focusStage(); for (let i = 0; i < 3; i++) await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify(await h.events()), orig, 'undone');
	t.eq(JSON.stringify((await h.saved()).events), orig, 'on disk');
});
test('menu: multi-selection menu colors, flips and deletes all at once', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await h.menu('Siege of the Keep begins');
	t.ok(/2 cards selected/.test(await p.ev(`document.querySelector('${A} [data-r=pop]').textContent`)), 'multi menu');
	await h.clickPop('.swb[data-color="6"]');
	t.ok((await byId(h, SIEGE)).color === '6' && (await byId(h, PLAGUE)).color === '6', 'both colored');
	await h.clickPop('[data-m=flip]');
	t.ok((await byId(h, SIEGE)).side === 'a' && (await byId(h, PLAGUE)).side === 'b', 'both flipped');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).color === '1' && (await byId(h, PLAGUE)).color === '3', 'undo');
});

/* ---------- groups, lifespans ---------- */
test('group card: dragging a crowded year moves every member by whole years; undo', async (p, h, t) => {
	await h.open();
	const e = await byId(h, SIEGE);
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); for (let i = 1; i <= 4; i++) d.events.push({ id: 'g' + i, t: ${e.t} + i * 3, side: 'b', title: 'Crowd ' + i, text: '', color: null, file: null }); t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`);
	await h.run('fit-all'); await p.sleep(600);
	const g = await p.at(`${A} .evra-card.group`); t.ok(g, 'group');
	const before = await h.events();
	await p.drag(g.x, g.y, g.x, g.y + 40);
	const after = await h.events(), moved = after.filter((x) => before.find((b) => b.id === x.id).t !== x.t);
	t.ok(moved.length >= 2, 'members moved');
	const ds = new Set(moved.map((x) => (x.t - before.find((b) => b.id === x.id).t) % 360));
	t.ok(ds.size === 1 && ds.has(0), 'whole years');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify((await h.events()).map((x) => x.t)), JSON.stringify(before.map((x) => x.t)), 'undo');
});
test('lifespan: ages shown on cards linking the person; unmarking life removes them', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await h.menu('Siege of the Keep begins');
	const cb = await h.pop(`[data-person="${MIRA}"]`); await p.click(cb.x, cb.y); await p.sleep(100); await p.key('Escape'); await p.sleep(150);
	const age = await p.ev(`(document.querySelector('${A} .evra-card[data-id="${SIEGE}"] .ag') || {}).textContent || ''`);
	t.ok(/Mira Ashdown · 4/.test(age), 'age ' + age);
	await h.run('fit-all'); await p.sleep(600);
	await p.ev(`${h.tl}; 1`);
	await p.ev(`document.querySelector('${A} .evra-card[data-id="${MIRA}"] [data-act=menu]').click()`); await p.sleep(200);
	await h.clickPop('[data-m=life]');
	t.ok(!(await byId(h, MIRA)).life, 'no longer a life');
	await h.setView(34, 12);
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card[data-id="${SIEGE}"] .ag')`)), 'age gone');
});

/* ---------- long undo/redo run ---------- */
test('undo/redo: twenty mixed edits undo to the original and redo to the final state', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await h.focusStage();
	const orig = JSON.stringify(await h.doc());
	await selectIds(p, h, [SIEGE]);
	const keys = ['2', 's', 'ArrowDown', 'ArrowLeft', 's', '4', 'ArrowDown', 'ArrowRight', '0', 'ArrowUp'];
	for (const k of keys) { await p.key(k); await p.sleep(40); }
	await p.key('d', 'ctrl'); await p.sleep(100);
	await selectIds(p, h, [PLAGUE]);
	for (const k of ['5', 's', 's', 'ArrowDown', 'ArrowLeft']) { await p.key(k); await p.sleep(40); }
	await p.key('Delete'); await p.sleep(100);
	const final = JSON.stringify(await h.doc());
	await h.focusStage();
	for (let i = 0; i < 30; i++) await p.key('z', 'ctrl');
	await p.sleep(200);
	const u = await h.doc();
	t.eq(JSON.stringify(u.events), JSON.parse(orig).events ? JSON.stringify(JSON.parse(orig).events) : '', 'undone to the original events');
	for (let i = 0; i < 30; i++) await p.key('y', 'ctrl');
	await p.sleep(200);
	t.eq(JSON.stringify((await h.doc()).events), JSON.stringify(JSON.parse(final).events), 'redone to the final events');
	t.eq(JSON.stringify((await h.saved()).events), JSON.stringify(JSON.parse(final).events), 'saved');
});

test('regression: keys: Delete one clicked card, then Ctrl+Z straight away brings it back', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	await selectIds(p, h, [SIEGE]);
	await p.key('Delete'); await p.sleep(150);
	t.eq((await h.events()).length, n - 1, 'deleted');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'Ctrl+Z right after Delete undoes it');
});
test('keys: J then Delete then Ctrl+Z (keyboard-only focus) undoes', async (p, h, t) => {
	await h.open(); await h.focusStage();
	const n = (await h.events()).length;
	await p.key('j'); await p.key('Delete'); await p.sleep(150);
	t.eq((await h.events()).length, n - 1, 'deleted');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'undo');
});
test('regression: undo while the card menu is open, then flip from that menu, does nothing', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	await h.clickPop('[data-icon="⚓"]');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.ok(!(await byId(h, SIEGE)).icon, 'undone');
	t.ok(!(await h.popOpen()), 'menu should close (or refresh) on undo, it is still open showing stale state');
});

test('menu: new color preset from the multi-selection menu colors every selected card; one undo', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await h.menu('Siege of the Keep begins');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-r=pop] [data-newcolor]'); i.value = '#abcdef'; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(200);
	const d = await h.doc(), id = d.palette[d.palette.length - 1].id;
	t.ok(d.events.find((e) => e.id === SIEGE).color === id && d.events.find((e) => e.id === PLAGUE).color === id, 'both');
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.doc()).palette.length, 6, 'undo');
});
test('edit: rapid N, Escape, N, Escape adds two cards and never leaves one in edit mode', async (p, h, t) => {
	await h.open(); await h.focusStage();
	const n = (await h.events()).length, s = await h.stage();
	await p.move(s.l + 200, s.t + 400);
	await p.key('n'); await p.key('Escape'); await p.key('n'); await p.key('Escape'); await p.sleep(400);
	t.eq((await h.events()).length, n + 2, 'two added');
	await p.sleep(300);
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`)), 'not stuck editing');
});
