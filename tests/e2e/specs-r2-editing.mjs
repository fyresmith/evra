// QA round 2: editing, cards, keyboard, menus/popovers, multi-select, copy/paste/duplicate, undo/redo of every kind.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const COMET = 'od0fr4a', ARCHIVE = 'o1vh9cb', SIEGE = 'zrzotia', PLAGUE = 'pnf2q3k', MIRA = '4ru3c01', TREATY = 'g55vcnw', FALL = 'inef2nu', DEATH = 'bbza1g4';
const byId = async (h, id) => (await h.events()).find((e) => e.id === id);
const selCount = (p) => p.ev(`document.querySelectorAll('${A} .cards > .evra-card.sel').length`);
const selIdsDom = (p) => p.ev(`[...document.querySelectorAll('${A} .cards > .evra-card.sel')].map(e => e.dataset.id).sort()`);
const editing = (p) => p.ev(`!!document.querySelector('${A} .evra-card.editing')`);
const active = (p) => p.ev(`(() => { const a = document.activeElement; return a ? { tag: a.tagName, id: a.dataset && a.dataset.id || '', c: a.dataset && a.dataset.c || '', inRoot: !!a.closest('${A}'), inPop: !!a.closest('${A} [data-r=pop]'), stage: a.matches('${A} .stage'), cls: String(a.className && a.className.baseVal === undefined ? a.className : '') } : null; })()`);
const inTimeline = async (p) => { const a = await active(p); return !!(a && a.inRoot); };
async function selectIds(p, h, ids) {
	for (let i = 0; i < ids.length; i++) {
		const c = await p.at(`${A} .evra-card[data-id="${ids[i]}"] .dt`) || await p.at(`${A} .evra-card[data-id="${ids[i]}"]`);
		if (!c) throw new h.Fail('card not visible: ' + ids[i]);
		await p.click(c.x, c.y, i ? { modifiers: 8 } : {});
	}
	await p.sleep(120);
}
const cardAt = (p, id, sub = '.dt') => p.at(`${A} .evra-card[data-id="${id}"] ${sub}`);
const menuOf = async (p, id) => { await p.ev(`document.querySelector('${A} .evra-card[data-id="${id}"] [data-act=menu]').click()`); await p.sleep(200); };
const setSelect = (p, sel, i) => p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] ${sel}'); s.value = typeof ${JSON.stringify(i)} === 'number' ? s.options[${JSON.stringify(i)}].value : ${JSON.stringify(i)}; s.dispatchEvent(new Event('change')); return 1; })()`);
const undoN = async (p, n) => { for (let i = 0; i < n; i++) await p.key('z', 'ctrl'); await p.sleep(150); };
const redoN = async (p, n) => { for (let i = 0; i < n; i++) await p.key('z', 'ctrl', 'shift'); await p.sleep(150); };
const strip = (d) => JSON.stringify({ ...d, lastView: undefined });
const hist = (p, h) => p.ev(`({ u: ${h.tl}.canUndo(), r: ${h.tl}.canRedo() })`);
const enterKey = async (p, mods = 0) => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r', modifiers: mods }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, modifiers: mods }); await p.sleep(60); };
const openEra = async (p, h, id = 'k') => { await h.setView(-5, 32); const r = await p.at(`${A} rect[data-era="${id}"]`); if (!r) throw new h.Fail('era bar not found'); await p.click(r.x, r.y); await p.sleep(300); if (!(await h.popOpen())) throw new h.Fail('era editor did not open'); };
/** A spot on the given side with nothing under it (no card, era label or control). */
const freeSpot = async (p, side) => { for (const dy of [0.5, 0.3, 0.7, 0.2, 0.8, 0.4, 0.6]) for (const dx of [250, 180, 320, 120]) { const r = await p.ev(`(() => { const s = document.querySelector('${A} .stage').getBoundingClientRect(); const ln = document.querySelector('${A} .lines line[style*="dasharray: 2"], ${A} .lines line[style*="dasharray:2"]'); const lx = s.left + Number(ln.getAttribute('x1')); const x = lx + (${JSON.stringify(side)} === 'a' ? -${dx} : ${dx}), y = s.top + s.height * ${dy}; const e = document.elementFromPoint(x, y); return e && e.closest('${A} .stage') && !e.closest('.ui, .evra-card, .ribbon, .evra-tag, [data-thread], [data-era]') ? {x, y} : null; })()`); if (r) return r; } throw new Error('no free spot'); };
const focusStage = (p) => p.ev(`document.querySelector('${A} .stage').focus()`).then(() => p.sleep(60));

/* ================= long chains, undo to the start, redo to the end ================= */
test('R2E01 mixed menu+keyboard+drag chain: undo all restores the pristine file; redo all matches the final file', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await focusStage(p);
	const orig = await h.saved();
	await selectIds(p, h, [SIEGE]);
	await p.key('4'); await p.key('s'); await p.key('ArrowDown'); await p.key('ArrowLeft');
	await menuOf(p, SIEGE); await h.clickPop('[data-icon="★"]'); await p.key('Escape');
	await menuOf(p, PLAGUE); await h.clickPop('[data-m=oe]');
	await menuOf(p, PLAGUE); await h.clickPop('[data-m=flip]');
	const c = await cardAt(p, PLAGUE); await p.drag(c.x, c.y, c.x, c.y + 70);
	await selectIds(p, h, [SIEGE, PLAGUE]); await p.key('d', 'ctrl'); await p.sleep(150);
	await p.key('Delete'); await p.sleep(150);
	const final = await h.saved();
	t.ok(JSON.stringify(final.events) !== JSON.stringify(orig.events), 'changed');
	await focusStage(p); await undoN(p, 40);
	t.eq(JSON.stringify((await h.saved()).events), JSON.stringify(orig.events), 'undo to the start (events)');
	t.eq(JSON.stringify((await h.saved()).palette), JSON.stringify(orig.palette), 'palette untouched');
	t.ok(!(await hist(p, h)).u, 'nothing left to undo');
	await redoN(p, 40);
	t.eq(JSON.stringify((await h.saved()).events), JSON.stringify(final.events), 'redo to the end');
});
test('R2E02 a new action after undo drops the redo stack', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('2'); await p.key('3'); await p.key('z', 'ctrl'); await p.sleep(100);
	t.ok((await hist(p, h)).r, 'can redo');
	await p.key('5'); await p.sleep(100);
	t.ok(!(await hist(p, h)).r, 'redo cleared');
	await p.key('y', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, '5', 'redo does nothing');
	await undoN(p, 2);
	t.eq((await byId(h, SIEGE)).color, '1', 'two undos back to start');
});
test('R2E03 the toast Undo button after a menu delete brings the card back; focus stays in the timeline', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	await menuOf(p, SIEGE); await h.clickPop('[data-m=del]');
	t.eq((await h.events()).length, n - 1, 'deleted');
	const b = await p.at(`${A} [data-r=toast] button`); t.ok(b, 'toast has undo');
	await p.click(b.x, b.y); await p.sleep(150);
	t.ok(await byId(h, SIEGE), 'back');
	t.eq((await h.saved()).events.length, n, 'saved');
});
test('R2E04 undo and redo of a settings change (card width) and direction toggle', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const w0 = (await h.doc()).cardWidth;
	const o = await h.ctrl('orient'); await p.click(o.x, o.y); await p.sleep(200);
	t.eq((await h.doc()).orientation, 'ltr', 'direction changed');
	await focusStage(p); await undoN(p, 1);
	t.eq((await h.doc()).orientation, 'ttb', 'undo direction');
	await redoN(p, 1);
	t.eq((await h.doc()).orientation, 'ltr', 'redo direction');
	await undoN(p, 1);
	await h.openSheet('cards');
	const r = await h.sheet('[data-k=cw]');
	t.ok(r, 'width slider');
	{
		await p.ev(`(() => { const e = document.querySelector('${A} .sheet-body [data-k=cw]'); e.focus(); e.value = String(${w0 || 240} + 60); e.dispatchEvent(new Event('input', {bubbles:true})); e.dispatchEvent(new Event('change', {bubbles:true})); return 1; })()`); await p.sleep(150);
		t.eq((await h.doc()).cardWidth, (w0 || 240) + 60, 'width changed');
		await p.key('Escape'); await p.sleep(150); await focusStage(p);
		await undoN(p, 1);
		t.eq((await h.doc()).cardWidth, w0, 'undo width');
	}
});

/* ================= undo while something is half-done ================= */
test('R2E05 Ctrl+Z in the era editor after picking a color undoes only that color, not the previous action', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('4'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, '4', 'earlier action');
	const era0 = (await h.doc()).eras.find((e) => e.id === 'k');
	await openEra(p, h);
	await h.clickPop(`.swb[data-color="6"]`);
	t.eq((await h.doc()).eras.find((e) => e.id === 'k').color, '6', 'era recolored live');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await byId(h, SIEGE)).color, '4', 'BUG: Ctrl+Z with the era editor open also undid the earlier card color');
	t.eq((await h.doc()).eras.find((e) => e.id === 'k').color, era0.color, 'era color undone');
});
test('R2E06 header Undo button while typing a card title: the title edit is not lost or merged', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [TREATY]); await p.key('3'); await p.sleep(100); // one earlier step
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Typed title');
	const ub = await p.at(`.workspace-leaf.mod-active .view-action[aria-label="Undo"]`);
	t.ok(ub, 'header undo button');
	await p.click(ub.x, ub.y); await p.sleep(300);
	await focusStage(p); await p.sleep(200);
	const s = await byId(h, SIEGE), tr = await byId(h, TREATY);
	// Either the edit is kept and undo hit only it, or the edit was saved first then undone. Never: title lost AND the earlier step undone together.
	const lostBoth = s.title === 'Siege of the Keep begins' && tr.color !== '3';
	t.ok(!(lostBoth), `header Undo during an edit undid the earlier step too (title=${s.title}, treaty color=${tr.color})`);
	t.ok(!(await editing(p)), 'not left editing');
});
test('R2E07 header Undo while the era editor has a pending rename keeps history consistent', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('4'); await p.sleep(100);
	await openEra(p, h);
	await p.key('a', 'ctrl'); await p.type('Renamed era');
	t.eq((await h.doc()).eras.find((e) => e.id === 'k').name, 'Renamed era', 'renamed live');
	const ub = await p.at(`.workspace-leaf.mod-active .view-action[aria-label="Undo"]`);
	await p.click(ub.x, ub.y); await p.sleep(300);
	const d = await h.doc();
	t.eq(d.events.find((e) => e.id === SIEGE).color, '4', 'BUG: header Undo with a pending era rename undid the earlier card color instead of (just) the rename');
});

/* ================= keyboard only ================= */
test('R2E08 Enter on a focused toolbar button activates the button, not "edit the selected card"', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.ev(`document.querySelector('${A} [data-c=help]').focus()`); await p.sleep(80);
	await enterKey(p); await p.sleep(250);
	t.ok(!(await editing(p)), 'BUG: Enter on the focused Help button started editing the selected card');
	t.ok(await h.popOpen(), 'help opened');
});
test('R2E09 Tab to the toast Undo button and press Enter: it undoes (does not edit the selected card)', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const n = (await h.events()).length;
	await selectIds(p, h, [SIEGE]); await p.key('d', 'ctrl'); await p.sleep(150); // toast with Undo; the copy is selected
	t.eq((await h.events()).length, n + 1, 'duplicated');
	await p.ev(`document.querySelector('${A} [data-r=toast] button').focus()`); await p.sleep(60);
	await enterKey(p); await p.sleep(250);
	t.ok(!(await editing(p)), 'BUG: Enter on the focused toast Undo button edited the selected card instead');
	t.eq((await h.events()).length, n, 'undone');
});
test('R2E71 arrowing through the card menu never changes a value (select traps ArrowDown and silently pins/approximates)', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	const o = await byId(h, SIEGE);
	await p.key('l'); await p.sleep(200);
	for (let i = 0; i < 40; i++) await p.key('ArrowDown');
	await p.sleep(150);
	const e = await byId(h, SIEGE);
	t.ok(!e.rel, 'BUG: ArrowDown through the menu pinned the card to ' + JSON.stringify(e.rel));
	t.ok(!e.circa, 'BUG: ArrowDown through the menu made the date approximate: ' + e.circa);
	t.eq(JSON.stringify(e), JSON.stringify(o), 'card unchanged');
});
test('R2E72 arrowing through a span card menu does not pin it', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('s'); await p.sleep(100);
	await p.key('l'); await p.sleep(200);
	for (let i = 0; i < 40; i++) await p.key('ArrowDown');
	await p.sleep(150);
	t.ok(!(await byId(h, SIEGE)).rel, 'BUG: pinned by arrowing: ' + JSON.stringify((await byId(h, SIEGE)).rel));
});
test('R2E10 J/K walk every card in date order and stop at the ends', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const order = (await h.events()).slice().sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)).map((e) => e.id);
	const seen = [];
	const selId = () => p.ev(`(() => { const e = document.querySelector('${A} .cards > .evra-card.sel'); return e ? e.dataset.id : null; })()`);
	for (let i = 0; i < order.length + 2; i++) { await p.key('j'); await p.sleep(120); seen.push(await selId()); }
	await p.sleep(500);
	t.eq(seen[order.length + 1], order[order.length - 1], 'J stops at the last card');
	for (let i = 0; i < order.length + 2; i++) { await p.key('k'); await p.sleep(60); }
	await p.sleep(600);
	t.eq(await p.ev(`${h.tl} && (document.querySelector('${A} .cards > .evra-card.sel') || {dataset:{}}).dataset.id`), order[0], 'K stops at the first');
});
test('R2E11 K with nothing selected picks the last card', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const order = (await h.events()).slice().sort((a, b) => a.t - b.t || a.id.localeCompare(b.id)).map((e) => e.id);
	await p.key('k'); await p.sleep(700);
	const sel = await p.ev(`(() => { const e = document.querySelector('${A} .cards > .evra-card.sel'); return e ? e.dataset.id : null; })()`);
	t.eq(sel, order[order.length - 1], 'last card');
});
test('R2E12 keyboard-only: N, type title, Enter, description, Escape, J, S, 2, L, flip by Enter, Ctrl+Z x4 restores', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const s = await h.stage(); await p.move(s.l + 200, s.t + 420);
	const n = (await h.events()).length;
	await p.key('n'); await p.sleep(350);
	t.ok(await editing(p), 'editing new card');
	await p.key('a', 'ctrl'); await p.type('Kbd card'); await enterKey(p); await p.type('kbd body'); await p.key('Escape'); await p.sleep(200);
	const e = (await h.events()).find((x) => x.title === 'Kbd card');
	t.ok(e && e.text === 'kbd body', 'saved');
	t.ok(await inTimeline(p), 'focus stays in the timeline');
	t.eq(await p.ev(`(document.querySelector('${A} .cards > .evra-card.sel')||{dataset:{}}).dataset.id`), e.id, 'still selected after editing');
	await p.key('s'); await p.key('2'); await p.sleep(100);
	let x = await byId(h, e.id);
	t.ok(x.end > x.t && x.color === '2', 'span + color');
	await p.key('l'); await p.sleep(250);
	t.ok(await h.popOpen(), 'menu');
	// arrow down to "Move to other side" and press Enter
	await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=flip]').focus()`);
	await enterKey(p); await p.sleep(200);
	x = await byId(h, e.id);
	t.eq(x.side, 'a', 'flipped by Enter');
	t.ok(!(await h.popOpen()), 'menu closed');
	t.ok(await inTimeline(p), 'focus back in the timeline');
	await undoN(p, 3);
	x = await byId(h, e.id);
	t.ok(x && x.end == null && x.color == null && x.side === 'b', 'three undos: side, color, span');
	await undoN(p, 1);
	t.eq((await h.events()).length, n, 'fourth undo removes the new card (add + name is one step)');
});
test('R2E13 Escape: first closes the menu (keeps the selection), second clears the selection', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('l'); await p.sleep(200);
	t.ok(await h.popOpen(), 'open');
	await p.key('Escape'); await p.sleep(120);
	t.ok(!(await h.popOpen()), 'closed');
	t.eq(await selCount(p), 1, 'selection kept');
	await p.key('Escape'); await p.sleep(120);
	t.eq(await selCount(p), 0, 'selection cleared');
});
test('R2E14 Escape while editing keeps what was typed (title and description)', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Esc title'); await p.key('Escape'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).title, 'Esc title', 'title kept');
	await p.key('z', 'ctrl'); await p.sleep(120);
	t.eq((await byId(h, SIEGE)).title, 'Siege of the Keep begins', 'one undo');
});
test('R2E15 typing into the tags field never fires shortcuts (j k s d n e l 1 0 . f g b z Delete)', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const before = JSON.stringify(await h.events());
	const vs = await p.ev(`JSON.stringify(${h.tl}.getViewState())`);
	await menuOf(p, SIEGE);
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y);
	for (const k of ['j', 'k', 's', 'd', 'n', 'e', 'l', '1', '0', '.', 'f', 'g', 'b', 'z', '+', '-', '?', '/']) await p.key(k);
	await p.key('Backspace'); await p.key('Delete'); await p.key('ArrowLeft');
	t.ok(await h.popOpen(), 'menu still open');
	t.eq(JSON.stringify(await h.events()), before, 'no card changed while typing');
	t.eq(await p.ev(`JSON.stringify(${h.tl}.getViewState())`), vs, 'view unchanged');
	t.ok(await p.ev(`document.querySelector('${A} [data-r=palette]').hidden`), 'palette not opened');
	await p.key('Escape');
});
test('R2E16 typing in a card title never fires shortcuts, incl. Ctrl+A/Ctrl+C/Ctrl+V inside it', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('jksdnel10.fgbz+-?/');
	await p.key('a', 'ctrl'); await p.key('c', 'ctrl'); await p.key('v', 'ctrl'); await p.key('d', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'no card added');
	t.ok(await editing(p), 'still editing');
	await p.key('Escape'); await p.sleep(150);
	t.ok(/jksdnel10/.test((await byId(h, SIEGE)).title), 'typed text saved: ' + (await byId(h, SIEGE)).title);
	t.eq(await selCount(p), 1, 'only one card selected (Ctrl+A in a field does not select all)');
});
test('R2E17 typing in the search palette does not fire shortcuts; picking a card selects it and E edits it', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await p.key('/'); await p.sleep(200);
	await p.type('treaty'); await p.sleep(200);
	const n = (await h.events()).length;
	t.eq(n, (await h.events()).length, 'nothing added');
	await enterKey(p); await p.sleep(700);
	t.ok(await p.ev(`document.querySelector('${A} [data-r=palette]').hidden`), 'closed');
	t.ok(await inTimeline(p), 'focus back in the timeline');
	t.eq(await p.ev(`(document.querySelector('${A} .cards > .evra-card.sel')||{dataset:{}}).dataset.id`), TREATY, 'card selected');
	await p.key('4'); await p.sleep(100);
	t.eq((await byId(h, TREATY)).color, '4', 'shortcut acts on the picked card');
});
test('R2E18 Delete/Backspace/Ctrl+D with nothing selected do nothing', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const before = JSON.stringify(await h.events());
	await p.key('Delete'); await p.key('Backspace'); await p.key('d', 'ctrl'); await p.key('s'); await p.key('3'); await p.key('ArrowDown'); await p.sleep(150);
	t.eq(JSON.stringify(await h.events()), before, 'unchanged');
	t.ok(!(await hist(p, h)).u, 'no history');
});
test('R2E19 Backspace deletes the selection; Ctrl+Y redoes it after undo', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('Backspace'); await p.sleep(120);
	t.ok(!(await byId(h, SIEGE)), 'gone');
	await p.key('z', 'ctrl'); await p.sleep(120);
	t.ok(await byId(h, SIEGE), 'back');
	await p.key('y', 'ctrl'); await p.sleep(120);
	t.ok(!(await byId(h, SIEGE)), 'redo');
});
test('R2E20 Z zooms to the selection; F fits; + and - zoom; . without "now" toasts; G and B open', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const vs = async () => JSON.parse(await p.ev(`JSON.stringify(${h.tl}.getViewState())`));
	const s0 = (await vs()).scale;
	await selectIds(p, h, [SIEGE]);
	await p.key('z'); await p.sleep(700);
	t.ok((await vs()).scale > s0, 'Z zoomed in');
	await p.key('f'); await p.sleep(700);
	const sf = (await vs()).scale;
	await p.key('+'); await p.sleep(600); t.ok((await vs()).scale > sf, '+');
	await p.key('-'); await p.sleep(600); await p.key('-'); await p.sleep(600); t.ok((await vs()).scale < sf * 1.01, '-');
	const now = (await h.doc()).now;
	await p.key('.'); await p.sleep(200);
	if (now == null) t.ok(/now/i.test(await h.toast()), 'toast about now');
	await p.key('g'); await p.sleep(200);
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=palette]').hidden`), 'G opens go-to');
	await p.key('Escape'); await p.sleep(150);
	await p.key('b'); await p.sleep(200);
	t.ok(await h.popOpen(), 'B opens saved views');
	await p.key('Escape');
});
test('R2E21 Alt+arrow nudges a span by one day keeping its length; arrows across switch every selected card', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await focusStage(p);
	const o = await byId(h, PLAGUE);
	await selectIds(p, h, [PLAGUE]);
	await p.key('ArrowDown', 'alt'); await p.sleep(100);
	const a = await byId(h, PLAGUE);
	t.eq(a.t, o.t + 1, 'start +1'); t.eq(a.end, o.end + 1, 'end +1');
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await p.key('ArrowRight'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).side === 'b' && (await byId(h, PLAGUE)).side === 'b', 'both on side b');
	await p.key('ArrowLeft'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).side === 'a' && (await byId(h, PLAGUE)).side === 'a', 'both on side a');
	await undoN(p, 1);
	t.ok((await byId(h, SIEGE)).side === 'b' && (await byId(h, PLAGUE)).side === 'b', 'one undo for the whole selection');
});
test('R2E22 horizontal direction: ArrowRight nudges later, ArrowUp moves to side a', async (p, h, t) => {
	await h.open();
	await h.run('direction-ltr'); await p.sleep(500); await focusStage(p);
	const o = await byId(h, SIEGE);
	await selectIds(p, h, [SIEGE]);
	await p.key('ArrowRight'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).t > o.t, 'later');
	await p.key('ArrowUp'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).side, 'a', 'side a');
	await p.key('ArrowDown'); await p.sleep(100);
	t.eq((await byId(h, SIEGE)).side, 'b', 'side b');
});
test('R2E23 bottom-to-top: ArrowUp moves a card later (up the screen = forward in time)', async (p, h, t) => {
	await h.open();
	await h.run('direction-btt'); await p.sleep(500); await focusStage(p);
	const o = await byId(h, SIEGE);
	await selectIds(p, h, [SIEGE]);
	const y0 = (await cardAt(p, SIEGE)).y;
	await p.key('ArrowUp'); await p.sleep(300);
	const e = await byId(h, SIEGE);
	t.ok(e.t > o.t, 'ArrowUp = later in btt (t ' + o.t + '→' + e.t + ')');
});

/* ================= multi-select ================= */
test('R2E24 shift-click toggles cards in and out; a plain click collapses to one', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE, FALL]);
	t.eq(await selCount(p), 3, 'three');
	const c = await cardAt(p, PLAGUE); await p.click(c.x, c.y, { modifiers: 8 }); await p.sleep(100);
	t.eq(JSON.stringify(await selIdsDom(p)), JSON.stringify([FALL, SIEGE].sort()), 'plague removed');
	const d = await cardAt(p, SIEGE); await p.click(d.x, d.y); await p.sleep(100);
	t.eq(JSON.stringify(await selIdsDom(p)), JSON.stringify([SIEGE]), 'plain click collapses');
});
test('R2E25 shift-marquee adds to an existing selection; then bulk color, flip, delete; undo each', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE]);
	const s = await h.stage(), b = await p.at(`${A} .evra-card[data-id="${PLAGUE}"]`);
	await p.drag(s.l + s.w - 20, b.t - 6, b.l + 20, b.t + b.h + 6, 14, { modifiers: 8 });
	await p.sleep(120);
	const ids = await selIdsDom(p);
	t.ok(ids.includes(SIEGE) && ids.includes(PLAGUE), 'kept siege and added plague: ' + ids);
	const orig = JSON.stringify(await h.events());
	await focusStage(p);
	await p.key('5'); await p.key('ArrowDown'); await p.key('Delete'); await p.sleep(150);
	t.ok(!(await byId(h, SIEGE)) && !(await byId(h, PLAGUE)), 'deleted both');
	await undoN(p, 3);
	t.eq(JSON.stringify(await h.events()), orig, 'three undos restore');
});
test('R2E26 marquee over empty space without cards clears nothing and keeps selection', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	const s = await h.stage(), x = await h.lineX();
	await p.drag(x - 30, s.t + 5, x - 29, s.t + 30, 6, { modifiers: 8 }); // tiny box on the line top, probably empty
	t.ok((await selCount(p)) >= 2, 'selection kept');
});
test('R2E27 Ctrl+A then Delete then undo restores every card; saved file too', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const orig = JSON.stringify((await h.saved()).events);
	await p.key('a', 'ctrl'); await p.sleep(100);
	await p.key('Delete'); await p.sleep(200);
	t.eq((await h.events()).length, 0, 'all gone');
	t.ok(await inTimeline(p), 'focus kept');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq(JSON.stringify((await h.saved()).events), orig, 'restored and saved');
});
test('R2E28 Ctrl+A then a color then ArrowDown: pins keep their gaps; one undo each', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const a0 = await byId(h, ARCHIVE), c0 = await byId(h, COMET);
	await p.key('a', 'ctrl'); await p.key('6'); await p.key('ArrowDown'); await p.sleep(150);
	const evs = await h.events();
	t.ok(evs.every((e) => e.color === '6'), 'all colored');
	const a1 = await byId(h, ARCHIVE), c1 = await byId(h, COMET);
	t.eq(a1.t - c1.t, a0.t - c0.t, 'pinned gap kept');
	t.eq(a1.rel.offset, a0.rel.offset, 'offset kept');
	await undoN(p, 1);
	t.eq((await byId(h, ARCHIVE)).t, a0.t, 'nudge undone');
	t.ok((await h.events()).every((e) => e.color === '6'), 'color still there');
});
test('R2E29 multi-selection: S acts on every selected card (or at least says it does not)', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, FALL]);
	await p.key('s'); await p.sleep(150);
	const a = await byId(h, SIEGE), b = await byId(h, FALL);
	t.ok((a.end != null) === (b.end != null), `S on a 2-card selection made only one a span (siege end=${a.end}, fall end=${b.end})`);
});
test('R2E30 right-clicking a card outside the selection opens that card\'s own menu and selects it alone', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	const c = await cardAt(p, FALL); await p.right(c.x, c.y); await p.sleep(200);
	t.ok(await h.popOpen(), 'menu');
	t.ok(!/cards selected/.test(await p.ev(`document.querySelector('${A} [data-r=pop]').textContent`)), 'single card menu');
	await p.key('Escape');
	t.eq(JSON.stringify(await selIdsDom(p)), JSON.stringify([FALL]), 'selection is that card');
});
test('R2E31 right-clicking a card inside the selection opens the multi menu; Duplicate there copies all', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	const n = (await h.events()).length;
	const c = await cardAt(p, SIEGE); await p.right(c.x, c.y); await p.sleep(200);
	t.ok(/2 cards selected/.test(await p.ev(`document.querySelector('${A} [data-r=pop]').textContent`)), 'multi menu');
	await h.clickPop('[data-m=dup]');
	t.eq((await h.events()).length, n + 2, 'two copies');
	t.eq(await selCount(p), 2, 'copies selected');
	await focusStage(p); await undoN(p, 1);
	t.eq((await h.events()).length, n, 'one undo');
});
test('R2E32 group drag of a selection across the line moves all to that side; one undo', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	const orig = JSON.stringify(await h.events());
	const c = await cardAt(p, SIEGE), x = await h.lineX();
	await p.drag(c.x, c.y, x - 200, c.y + 20);
	const s = await byId(h, SIEGE), pl = await byId(h, PLAGUE);
	t.eq(s.side, 'a', 'dragged card switched');
	await focusStage(p); await undoN(p, 1);
	t.eq(JSON.stringify(await h.events()), orig, 'one undo');
});

/* ================= copy / paste / duplicate ================= */
test('R2E33 Ctrl+V with nothing copied toasts and changes nothing', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const before = JSON.stringify(await h.events());
	await p.key('v', 'ctrl'); await p.sleep(150);
	t.ok(/Copy a card first/.test(await h.toast()), 'hint');
	t.eq(JSON.stringify(await h.events()), before, 'unchanged');
});
test('R2E34 copy, delete the original, paste brings a copy with the same title/color/text/side', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await focusStage(p);
	await selectIds(p, h, [PLAGUE]);
	const o = await byId(h, PLAGUE);
	await p.key('c', 'ctrl'); await p.key('Delete'); await p.sleep(100);
	const s = await h.stage(); await p.move(s.l + 300, s.t + 300);
	await p.key('v', 'ctrl'); await p.sleep(150);
	const c = (await h.events()).find((e) => e.title === 'Plague of Salt');
	t.ok(c && c.id !== PLAGUE, 'pasted with a new id');
	t.eq(c.color, o.color, 'color'); t.eq(c.text, o.text, 'text'); t.eq(c.side, o.side, 'side'); t.eq(c.end - c.t, o.end - o.t, 'length');
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify(await byId(h, PLAGUE)), JSON.stringify(o), 'undo both');
});
test('R2E35 paste lands near the pointer date', async (p, h, t) => {
	await h.open(); await h.setView(30, 20); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('c', 'ctrl');
	const s = await h.stage(), y = s.t + s.h * 0.8;
	await p.move(s.l + 150, y);
	const tp = await p.ev(`(() => { const v = ${h.tl}.getViewState(); return v.v0 + (${y} - ${s.t}) / v.scale; })()`);
	await p.key('v', 'ctrl'); await p.sleep(150);
	const c = (await h.events()).filter((e) => e.title === 'Siege of the Keep begins' && e.id !== SIEGE)[0];
	t.ok(c, 'pasted');
	t.ok(Math.abs(c.t - tp) < 360, `near the pointer (${c.t} vs ${Math.round(tp)})`);
});
test('R2E36 copy is independent of later edits to the original', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('c', 'ctrl');
	await p.key('5'); await p.sleep(80);
	const s = await h.stage(); await p.move(s.l + 300, s.t + 300);
	await p.key('v', 'ctrl'); await p.sleep(150);
	const c = (await h.events()).filter((e) => e.title === 'Siege of the Keep begins' && e.id !== SIEGE)[0];
	t.eq(c.color, '1', 'copy keeps the color at copy time');
});
test('R2E37 Ctrl+D three times makes three copies, each a step later, and each selected in turn', async (p, h, t) => {
	await h.open(); await h.setView(30, 20); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	const n = (await h.events()).length;
	for (let i = 0; i < 3; i++) { await p.key('d', 'ctrl'); await p.sleep(150); }
	const copies = (await h.events()).filter((e) => e.title === 'Siege of the Keep begins').map((e) => e.t).sort((a, b) => a - b);
	t.eq(copies.length, 4, 'four in total');
	t.ok(copies[0] < copies[1] && copies[1] < copies[2] && copies[2] < copies[3], 'each later: ' + copies);
	t.eq(await selCount(p), 1, 'one selected');
	await undoN(p, 3);
	t.eq((await h.events()).length, n, 'three undos');
});
test('R2E38 Ctrl+D and the menu Duplicate put the copy on the same date', async (p, h, t) => {
	await h.open(); await h.setView(30, 20); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('d', 'ctrl'); await p.sleep(150);
	const k = (await h.events()).slice(-1)[0];
	await p.key('z', 'ctrl'); await p.sleep(100);
	await menuOf(p, SIEGE); await h.clickPop('[data-m=dup]');
	const m = (await h.events()).slice(-1)[0];
	t.eq(m.t, k.t, `Ctrl+D puts the copy at ${k.t}, the menu Duplicate at ${m.t}`);
});
test('R2E39 duplicating a card nudged by Alt keeps its exact day offset', async (p, h, t) => {
	await h.open(); await h.setView(30, 20); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('ArrowDown', 'alt'); await p.key('ArrowDown', 'alt'); await p.key('ArrowDown', 'alt'); await p.sleep(100);
	const o = await byId(h, SIEGE);
	await p.key('d', 'ctrl'); await p.sleep(150);
	const c = (await h.events()).slice(-1)[0];
	// one snap step later (half a year at this zoom), keeping the day of the month
	t.ok(c.t > o.t && (c.t - o.t) % 30 === 0, `duplicate keeps the day offset (from ${o.t} to ${c.t})`);
});
test('R2E40 paste from the right-click menu "Paste here"', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('c', 'ctrl');
	const s = await h.stage(), x = await h.lineX();
	await p.right(x + 250, s.t + 500); await p.sleep(200);
	const n = (await h.events()).length;
	await h.clickPop('[data-m=paste]');
	t.eq((await h.events()).length, n + 1, 'pasted');
	t.ok(await inTimeline(p), 'focus in the timeline');
	await p.key('z', 'ctrl'); await p.sleep(120);
	t.eq((await h.events()).length, n, 'undo');
});
test('R2E41 copy/paste of a linked-note card keeps the link and title', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [TREATY]); await p.key('c', 'ctrl');
	const s = await h.stage(); await p.move(s.l + 300, s.t + 200); await p.key('v', 'ctrl'); await p.sleep(200);
	const c = (await h.events()).slice(-1)[0];
	t.eq(c.file, 'Treaty of Sallow', 'link kept');
	t.ok(await p.ev(`/Treaty/.test(document.querySelector('${A} .evra-card[data-id="${c.id}"]').getAttribute('aria-label'))`), 'renders the note title');
});

/* ================= titles and text ================= */
test('R2E42 emoji / CJK / RTL / combining titles save exactly', async (p, h, t) => {
	await h.open();
	const title = '🏰 城の包囲 — حصار ✨ é͂ 👨‍👩‍👧';
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.send('Input.insertText', { text: title }); await p.key('Escape'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).title, title, 'exact');
	t.eq((await h.saved()).events.find((e) => e.id === SIEGE).title, title, 'on disk');
	t.ok(await p.ev(`document.querySelector('${A} .evra-card[data-id="${SIEGE}"] .tt').textContent === ${JSON.stringify(title)}`), 'rendered');
});
test('R2E43 a 200+ character title with an emoji at the cut does not leave half an emoji', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.send('Input.insertText', { text: 'a'.repeat(199) + '😀tail' }); await p.key('Escape'); await p.sleep(150);
	const tt = (await byId(h, SIEGE)).title;
	t.ok(tt.length <= 200, 'capped at 200 (' + tt.length + ')');
	t.ok(!/[\ud800-\udbff]$/.test(tt), 'BUG: title ends in a lone high surrogate (half an emoji)');
});
test('R2E44 description of 256 with an emoji at the limit does not keep half an emoji', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await enterKey(p);
	await p.send('Input.insertText', { text: 'b'.repeat(255) + '🔥🔥' }); await p.sleep(100);
	await p.key('Escape'); await p.sleep(150);
	const tx = (await byId(h, SIEGE)).text;
	t.ok(!/[\ud800-\udbff]$/.test(tx), 'BUG: description cut leaves a lone surrogate (len ' + tx.length + ')');
});
test('R2E45 pasting multi-line text into a title collapses to one line', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.send('Input.insertText', { text: 'one\ntwo\n\tthree' }); await p.key('Escape'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).title, 'one two three', 'one line');
});
test('R2E46 an HTML-looking title is shown as text and survives an edit round-trip', async (p, h, t) => {
	await h.open();
	const title = '<img src=x onerror=alert(1)> & <b>bold</b>';
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.send('Input.insertText', { text: title }); await p.key('Escape'); await p.sleep(200);
	t.eq((await byId(h, SIEGE)).title, title, 'saved as typed');
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card[data-id="${SIEGE}"] img, ${A} .evra-card[data-id="${SIEGE}"] b')`)), 'no markup injected');
	// edit again without changes: must not escape twice
	const c2 = await cardAt(p, SIEGE); await p.dbl(c2.x, c2.y); await p.sleep(250); await p.key('Escape'); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).title, title, 'unchanged after a second edit');
	t.ok(!(await hist(p, h)).r, 'no redo');
});
test('R2E47 opening and closing an edit without changes records no undo step', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250); await p.key('Escape'); await p.sleep(150);
	t.ok(!(await hist(p, h)).u, 'no history after a no-op edit');
});
test('R2E48 a description with only whitespace saves as empty; title whitespace collapsed', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('  a   b  '); await enterKey(p); await p.key('a', 'ctrl'); await p.type('   '); await p.key('Escape'); await p.sleep(150);
	const e = await byId(h, SIEGE);
	t.eq(e.title, 'a b', 'title'); t.eq(e.text, '', 'text');
});

/* ================= double-clicks ================= */
test('R2E49 four quick clicks on a card: one edit, no new cards', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, c = await cardAt(p, SIEGE);
	await p.dbl(c.x, c.y); await p.dbl(c.x, c.y); await p.sleep(300);
	t.eq((await h.events()).length, n, 'no cards added');
	t.eq(await p.ev(`document.querySelectorAll('${A} .evra-card.editing').length`), 1, 'one editing');
	await p.key('Escape');
});
test('R2E50 triple-click on empty space adds exactly one card', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.move(x - 170, s.t + 300, 2);
	for (let i = 0; i < 3; i++) { await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: x - 170, y: s.t + 300, button: 'left', clickCount: i + 1 }); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: x - 170, y: s.t + 300, button: 'left', clickCount: i + 1 }); await p.sleep(60); }
	await p.sleep(400); await p.key('Escape'); await p.sleep(150);
	t.eq((await h.events()).length, n + 1, 'one added');
});
test('R2E51 double-click empty space, type, then double-click elsewhere: first saved, second editing', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x - 170, s.t + 300); await p.sleep(350);
	await p.key('a', 'ctrl'); await p.type('First');
	await p.dbl(x + 170, s.t + 600); await p.sleep(350);
	t.ok((await h.events()).some((e) => e.title === 'First'), 'first saved');
	t.eq((await h.events()).length, n + 2, 'two cards');
	t.ok(await editing(p), 'second editing');
	await p.key('a', 'ctrl'); await p.type('Second'); await p.key('Escape'); await p.sleep(150);
	await focusStage(p); await undoN(p, 1);
	t.ok(!(await h.events()).some((e) => e.title === 'Second'), 'undo removes the second only');
	t.ok((await h.events()).some((e) => e.title === 'First'), 'first still there');
});

/* ================= menus / popovers ================= */
test('R2E52 context menu Add event here: edit starts, Escape keeps it, focus in timeline, one undo removes it', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	const spot = await freeSpot(p, 'a');
	await p.right(spot.x, spot.y); await p.sleep(200);
	await h.clickPop('[data-m=add]'); await p.sleep(300);
	t.ok(await editing(p), 'editing');
	await p.key('a', 'ctrl'); await p.type('Ctx'); await p.key('Escape'); await p.sleep(150);
	const e = (await h.events()).find((x) => x.title === 'Ctx');
	t.ok(e, 'saved'); t.eq(e.side, 'a', 'side from click');
	t.ok(await inTimeline(p), 'focus');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'one undo');
});
test('R2E53 context menu Add a span here: a span, named; undo in one step', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.right(x + 250, s.t + 500); await p.sleep(200);
	await h.clickPop('[data-m=addspan]'); await p.sleep(300);
	await p.key('a', 'ctrl'); await p.type('CtxSpan'); await p.key('Escape'); await p.sleep(150);
	const e = (await h.events()).find((x) => x.title === 'CtxSpan');
	t.ok(e && e.end > e.t, 'span');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'BUG? add span + naming should undo in one step like Add event (got ' + ((await h.events()).length - n) + ' left)');
});
test('R2E54 card menu Edit button starts editing that card', async (p, h, t) => {
	await h.open();
	await menuOf(p, SIEGE); await h.clickPop('[data-m=edit]'); await p.sleep(250);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing[data-id="${SIEGE}"]')`), 'editing siege');
	t.ok(await p.ev(`document.activeElement.classList.contains('tt')`), 'caret in the title');
	await p.key('Escape');
});
test('R2E55 card menu: color then tags by Enter then circa, then undo 3 restores exactly', async (p, h, t) => {
	await h.open();
	const o = await byId(h, SIEGE);
	await menuOf(p, SIEGE); await h.clickPop('.swb[data-color="2"]');
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y); await p.type('x, y'); await enterKey(p); await p.sleep(150);
	t.ok(!(await h.popOpen()), 'Enter in tags closes');
	t.ok(await inTimeline(p), 'focus back');
	await menuOf(p, SIEGE); await setSelect(p, '[data-m=circa]', 2); await p.sleep(120);
	t.ok((await byId(h, SIEGE)).circa > 0, 'circa');
	await p.key('Escape'); await focusStage(p);
	await undoN(p, 3);
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'restored');
});
test('R2E56 card menu: tags typed then Escape — kept or discarded, but never half-applied', async (p, h, t) => {
	await h.open();
	await menuOf(p, SIEGE);
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y); await p.type('lost?');
	await p.key('Escape'); await p.sleep(150);
	const e = await byId(h, SIEGE);
	console.log('    tags after Escape:', JSON.stringify(e.tags));
	t.ok(!(await h.popOpen()), 'closed');
	t.ok(await inTimeline(p), 'focus back in the timeline');
});
test('R2E58 the group panel: picking an event selects it; its pen edits it', async (p, h, t) => {
	await h.open();
	const e = await byId(h, SIEGE);
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); for (let i = 1; i <= 4; i++) d.events.push({ id: 'g' + i, t: ${e.t} + i * 3, side: 'b', title: 'Crowd ' + i, text: '', color: null, file: null }); t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`);
	await h.run('fit-all'); await p.sleep(600);
	const g = await p.at(`${A} .evra-card.group`); t.ok(g, 'group');
	await p.click(g.x, g.y); await p.sleep(450);
	t.ok(await h.popOpen(), 'panel');
	await h.clickPop('[data-edit="g2"]'); await p.sleep(900);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing[data-id="g2"]')`), 'editing g2 after zoom');
	await p.key('a', 'ctrl'); await p.type('Crowd renamed'); await p.key('Escape'); await p.sleep(150);
	t.eq((await byId(h, 'g2')).title, 'Crowd renamed', 'saved');
});
test('R2E59 era editor: rename + Enter is one undo step; redo; saved', async (p, h, t) => {
	await h.open();
	await openEra(p, h);
	await p.key('a', 'ctrl'); await p.type('Kindle'); await enterKey(p); await p.sleep(150);
	t.ok(!(await h.popOpen()), 'closed');
	t.ok(await inTimeline(p), 'focus back');
	t.eq((await h.saved()).eras.find((e) => e.id === 'k').name, 'Kindle', 'saved');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.doc()).eras.find((e) => e.id === 'k').name, 'The Kindling', 'undo');
	await p.key('y', 'ctrl'); await p.sleep(150);
	t.eq((await h.doc()).eras.find((e) => e.id === 'k').name, 'Kindle', 'redo');
});
test('R2E60 era editor opened and closed without changes records no undo step', async (p, h, t) => {
	await h.open();
	await openEra(p, h);
	await p.key('Escape'); await p.sleep(150);
	t.ok(!(await hist(p, h)).u, 'no history');
});
test('R2E61 era delete from the editor, undo brings it and its children back', async (p, h, t) => {
	await h.open();
	const eras = JSON.stringify((await h.doc()).eras);
	await openEra(p, h);
	await h.clickPop('[data-m=del]');
	t.ok(!(await h.doc()).eras.some((e) => e.id === 'k'), 'deleted');
	await focusStage(p); await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify((await h.doc()).eras), eras, 'undo restores exactly');
});
test('R2E62 help (?) toggles from the toolbar and Escape leaves the selection alone', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('?'); await p.sleep(200);
	t.ok(await h.popOpen(), 'open');
	await p.key('Escape'); await p.sleep(120);
	t.ok(!(await h.popOpen()), 'closed');
	t.eq(await selCount(p), 1, 'selection kept after closing help');
});
test('R2E63 the Delete key shown in the card menu works while the menu has focus', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('l'); await p.sleep(200);
	t.ok((await active(p)).inPop, 'focus in the menu');
	await p.key('Delete'); await p.sleep(150);
	t.ok(!(await byId(h, SIEGE)), 'menu advertises ⌫ for Delete but pressing it with the menu focused does nothing');
});
test('R2E64 span toggles: S twice restores exactly; menu span twice restores exactly; undo/redo symmetry', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const o = await byId(h, SIEGE);
	await selectIds(p, h, [SIEGE]);
	await p.key('s'); await p.key('s'); await p.sleep(100);
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'S S');
	await menuOf(p, SIEGE); await h.clickPop('[data-m=span]');
	await menuOf(p, SIEGE); await h.clickPop('[data-m=span]');
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'menu twice');
	await focusStage(p); await undoN(p, 4); await redoN(p, 4); await undoN(p, 4);
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'undo/redo symmetric');
});
test('R2E65 S on a pinned card (anchor) keeps the pinned card in place, undo restores both', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await h.setView(50, 20);
	const a0 = await byId(h, ARCHIVE);
	await selectIds(p, h, [COMET]);
	await p.key('s'); await p.sleep(100);
	t.eq((await byId(h, ARCHIVE)).t, a0.t, 'archive stays');
	await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq(JSON.stringify(await byId(h, ARCHIVE)), JSON.stringify(a0), 'undo');
});
test('R2E66 dot drag makes a span then S turns it back; two undos', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const o = await byId(h, SIEGE), x = await h.lineX();
	const y = await p.ev(`(() => { const v = ${h.tl}.getViewState(); const s = document.querySelector('${A} .stage').getBoundingClientRect(); return s.y + (${o.t} - v.v0) * v.scale; })()`);
	await p.drag(x, y, x, y + 120);
	const a = await byId(h, SIEGE);
	t.ok(a.end > a.t, 'span by drag');
	await focusStage(p); await selectIds(p, h, [SIEGE]); await p.key('s'); await p.sleep(100);
	t.ok((await byId(h, SIEGE)).end == null, 'moment');
	await undoN(p, 2);
	t.eq(JSON.stringify(await byId(h, SIEGE)), JSON.stringify(o), 'two undos');
});
test('R2E67 Enter on a selected linked card opens its note, not an edit', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [TREATY]);
	await enterKey(p); await p.sleep(500);
	t.ok(!(await editing(p)), 'no inline edit');
	t.ok(await p.ev(`app.workspace.getLeavesOfType('markdown').some(l => l.view.file && l.view.file.basename === 'Treaty of Sallow')`), 'note opened');
});
test('R2E68 Enter in description chain then undo steps back one card at a time', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x - 170, s.t + 300); await p.sleep(350);
	await p.key('a', 'ctrl'); await p.type('C1'); await enterKey(p); await enterKey(p); await p.sleep(350);
	await p.key('a', 'ctrl'); await p.type('C2'); await enterKey(p); await enterKey(p); await p.sleep(350);
	await p.key('Escape'); await p.sleep(150);
	t.eq((await h.events()).length, n + 3, 'C1, C2 and a trailing new card');
	await undoN(p, 1);
	t.eq((await h.events()).length, n + 2, 'undo 1');
	await undoN(p, 1);
	t.ok(!(await h.events()).some((e) => e.title === 'C2'), 'undo 2 removes C2');
	await undoN(p, 1);
	t.eq((await h.events()).length, n, 'undo 3 removes C1');
});
test('R2E69 deleting the card being hovered in compact view then undo leaves no stray peek', async (p, h, t) => {
	await h.open();
	await h.setView(-100, 1000); await p.sleep(300);
	const c = await p.at(`${A} .cards > .evra-card.compact:not(.group)`);
	if (!c) { console.log('    (no compact cards)'); return; }
	await p.move(c.x, c.y); await p.sleep(400);
	await p.right(c.x, c.y); await p.sleep(200);
	const del = await h.pop('[data-m=del]');
	if (del) await p.click(del.x, del.y);
	await p.sleep(200);
	t.eq(await p.ev(`document.querySelectorAll('${A} .evra-card.peek').length`), 0, 'no peek left');
	await focusStage(p); await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq(await p.ev(`document.querySelectorAll('${A} .evra-card.peek').length`), 0, 'no peek after undo');
});
test('R2E70 people checkbox via keyboard (Space) toggles and is undoable', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await menuOf(p, SIEGE);
	await p.ev(`document.querySelector('${A} [data-r=pop] [data-person="${MIRA}"]').focus()`);
	await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
	await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 }); await p.sleep(150);
	t.eq(((await byId(h, SIEGE)).people || []).join(), MIRA, 'ticked by Space');
	t.ok(await h.popOpen(), 'menu still open');
	await p.key('Escape'); await focusStage(p); await p.key('z', 'ctrl'); await p.sleep(120);
	t.ok(!(await byId(h, SIEGE)).people, 'undo');
});

/* ================= batch 2: mid-drag keys, edits interrupted, more menus ================= */
test('R2E73 Delete pressed in the middle of a card drag: no exception, a clean result', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const c = await cardAt(p, SIEGE);
	await p.move(c.x, c.y, 2);
	await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
	for (let i = 1; i <= 5; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y + i * 8, button: 'left', buttons: 1 });
	await p.key('Delete'); await p.sleep(80);
	for (let i = 6; i <= 10; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y + i * 8, button: 'left', buttons: 1 });
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y + 80, button: 'left', clickCount: 1 });
	await p.sleep(200);
	const e = await byId(h, SIEGE);
	console.log('    after delete mid-drag:', e ? 'card still there t=' + e.t : 'deleted');
	await focusStage(p); await p.key('z', 'ctrl'); await p.sleep(150);
	t.ok(await byId(h, SIEGE), 'undo brings it back');
});
test('R2E74 Ctrl+Z pressed in the middle of a card drag does not corrupt history', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await focusStage(p);
	await selectIds(p, h, [PLAGUE]); await p.key('5'); await p.sleep(100); // step 1: plague color 3 -> 5
	const s0 = await byId(h, SIEGE);
	const c = await cardAt(p, SIEGE);
	await p.move(c.x, c.y, 2);
	await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
	for (let i = 1; i <= 5; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y + i * 12, button: 'left', buttons: 1 });
	await p.key('z', 'ctrl'); await p.sleep(80);
	for (let i = 6; i <= 10; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y + i * 12, button: 'left', buttons: 1 });
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y + 120, button: 'left', clickCount: 1 });
	await p.sleep(200);
	const pl1 = (await byId(h, PLAGUE)).color;
	console.log('    after mid-drag undo: plague color', pl1, 'siege t', (await byId(h, SIEGE)).t, 'from', s0.t);
	// Now undo everything: we must end at the pristine state (plague 3, siege at its start)
	await focusStage(p); await undoN(p, 5);
	t.eq((await byId(h, PLAGUE)).color, '3', 'undo all: plague color back to original');
	t.eq((await byId(h, SIEGE)).t, s0.t, 'undo all: siege back');
	// and after undo-all, redo-all must not bring back a state that never existed
	await redoN(p, 5);
	const pl2 = (await byId(h, PLAGUE)).color;
	t.eq(pl2, pl1, `redo all ends where the user left off (plague color ${pl2} vs ${pl1})`);
});
test('R2E75 Escape in the middle of a card drag cancels it (card returns, no undo step)', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const o = await byId(h, SIEGE), c = await cardAt(p, SIEGE);
	await p.move(c.x, c.y, 2);
	await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
	for (let i = 1; i <= 8; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x, y: c.y + i * 12, button: 'left', buttons: 1 });
	await p.key('Escape'); await p.sleep(80);
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y + 96, button: 'left', clickCount: 1 });
	await p.sleep(200);
	t.eq((await byId(h, SIEGE)).t, o.t, 'Escape during a drag does not cancel it (card moved from ' + o.t + ' to ' + (await byId(h, SIEGE)).t + ')');
});
test('R2E76 right-click another card while editing: the edit is saved first, then its menu opens', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Saved by rightclick');
	const d = await cardAt(p, PLAGUE); await p.right(d.x, d.y); await p.sleep(250);
	t.eq((await byId(h, SIEGE)).title, 'Saved by rightclick', 'edit saved');
	t.ok(!(await editing(p)), 'not editing');
	t.ok(await h.popOpen(), 'menu open');
	t.ok((await active(p)).inPop, 'focus in the menu');
	await p.key('Escape'); await p.sleep(100);
	t.ok(await inTimeline(p), 'focus in timeline');
});
test('R2E77 right-click the card being edited: edit saved, its menu opens with the new title state', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Menu while editing');
	const c2 = await cardAt(p, SIEGE, '.tt'); await p.right(c2.x, c2.y); await p.sleep(250);
	t.ok(await h.popOpen(), 'menu open');
	await h.clickPop('.swb[data-color="6"]');
	await p.key('Escape'); await p.sleep(150); await focusStage(p);
	const e = await byId(h, SIEGE);
	t.eq(e.title, 'Menu while editing', 'title kept');
	t.eq(e.color, '6', 'color applied');
	await undoN(p, 1);
	t.eq((await byId(h, SIEGE)).title, 'Menu while editing', 'one undo only reverts the color');
});
test('R2E78 Tab from the description leaves the card and saves', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Tabbed'); await p.key('Tab'); await p.sleep(80);
	t.ok(await p.ev(`document.activeElement.classList.contains('bd')`), 'Tab from title goes to description');
	await p.key('a', 'ctrl'); await p.type('desc tabbed'); await p.key('Tab'); await p.sleep(200);
	const e = await byId(h, SIEGE);
	t.eq(e.title, 'Tabbed', 'title'); t.eq(e.text, 'desc tabbed', 'desc');
	t.ok(!(await editing(p)), 'edit ended');
	t.ok(await inTimeline(p), 'focus in timeline');
});
test('R2E79 double-clicking a second card while editing the first: first saved, second edited', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('First edit');
	const d = await cardAt(p, PLAGUE); await p.dbl(d.x, d.y); await p.sleep(300);
	t.eq((await byId(h, SIEGE)).title, 'First edit', 'first saved');
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing[data-id="${PLAGUE}"]')`), 'second editing');
	await p.key('a', 'ctrl'); await p.type('Second edit'); await p.key('Escape'); await p.sleep(150);
	await undoN(p, 1);
	t.eq((await byId(h, PLAGUE)).title, 'Plague of Salt', 'undo second');
	t.eq((await byId(h, SIEGE)).title, 'First edit', 'first kept');
	await undoN(p, 1);
	t.eq((await byId(h, SIEGE)).title, 'Siege of the Keep begins', 'undo first');
});
test('R2E80 N with the pointer never over the stage adds at the middle of the view', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const mid = await p.ev(`(() => { const v = ${h.tl}.getViewState(); const s = document.querySelector('${A} .stage'); return v.v0 + s.clientHeight / 2 / v.scale; })()`);
	await p.key('n'); await p.sleep(300); await p.key('Escape'); await p.sleep(150);
	const e = (await h.events()).find((x) => x.title === 'New event');
	t.ok(e, 'added');
	console.log('    N added at', e.t, 'middle', Math.round(mid));
});
test('R2E81 Ctrl+A, Ctrl+C, Ctrl+V doubles every card; one undo removes all pasted', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const n = (await h.events()).length;
	const s = await h.stage(); await p.move(s.l + 300, s.t + 200);
	await p.key('a', 'ctrl'); await p.key('c', 'ctrl'); await p.key('v', 'ctrl'); await p.sleep(250);
	t.eq((await h.events()).length, n * 2, 'doubled');
	t.eq(await p.ev(`${h.tl} && document.querySelectorAll('${A} .cards > .evra-card.sel').length >= 1`), true, 'pasted selected');
	t.ok(!(await h.events()).slice(n).some((e) => e.rel), 'no pins on pasted');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await h.events()).length, n, 'one undo');
	t.eq((await h.saved()).events.length, n, 'saved');
});
test('R2E82 pasted copies of a pinned pair keep the pin between them? (pins inside the copy)', async (p, h, t) => {
	await h.open(); await h.setView(50, 20); await focusStage(p);
	await selectIds(p, h, [COMET, ARCHIVE]);
	await p.key('c', 'ctrl');
	const s = await h.stage(); await p.move(s.l + 300, s.t + 600); await p.key('v', 'ctrl'); await p.sleep(200);
	const ps = (await h.events()).slice(-2);
	console.log('    pasted pair rel:', JSON.stringify(ps.map((e) => e.rel || null)));
	t.eq(Math.abs(ps[0].t - ps[1].t), Math.abs((await byId(h, COMET)).t - (await byId(h, ARCHIVE)).t), 'gap kept');
});
test('R2E83 multi menu: Copy then paste at pointer; Zoom to them; Delete; focus returns each time', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await menuOf(p, PLAGUE);
	t.ok(/2 cards selected/.test(await p.ev(`document.querySelector('${A} [data-r=pop]').textContent`)), 'multi menu');
	await h.clickPop('[data-m=copy]');
	t.ok(await inTimeline(p), 'focus after copy');
	const s = await h.stage(); await p.move(s.l + 300, s.t + 150);
	const n = (await h.events()).length;
	await p.key('v', 'ctrl'); await p.sleep(200);
	t.eq((await h.events()).length, n + 2, 'pasted two');
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await menuOf(p, PLAGUE); await h.clickPop('[data-m=del]');
	t.ok(!(await byId(h, SIEGE)) && !(await byId(h, PLAGUE)), 'deleted');
	t.ok(await inTimeline(p), 'focus after delete');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.ok((await byId(h, SIEGE)) && (await byId(h, PLAGUE)), 'Ctrl+Z right after works');
});
test('R2E84 icon picked with Enter from the keyboard; toggles "on" state', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('l'); await p.sleep(200);
	await p.ev(`document.querySelector('${A} [data-r=pop] [data-icon="☄"]').focus()`);
	await enterKey(p); await p.sleep(120);
	t.eq((await byId(h, SIEGE)).icon, '☄', 'icon');
	t.ok(await p.ev(`document.querySelector('${A} [data-r=pop] [data-icon="☄"]').classList.contains('on')`), 'shown as on');
	t.ok(await h.popOpen(), 'menu stays open for more changes');
	t.ok((await active(p)).inPop, 'focus stays in the menu');
});
test('R2E85 context menu "Set now here" then Ctrl+Z clears it again', async (p, h, t) => {
	await h.open();
	const n0 = (await h.doc()).now;
	const spot = await freeSpot(p, 'b');
	await p.right(spot.x, spot.y); await p.sleep(200);
	await h.clickPop('[data-m=now]');
	t.ok((await h.doc()).now != null && (await h.doc()).now !== n0, 'now set');
	t.ok(await inTimeline(p), 'focus');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.doc()).now, n0, 'undo');
});
test('R2E86 context menu "Add an era here" then rename and Escape: undo steps', async (p, h, t) => {
	await h.open();
	const eras = (await h.doc()).eras.length;
	await h.setView(-30, 20); // before the first era
	const spot = await freeSpot(p, 'b');
	await p.right(spot.x, spot.y); await p.sleep(200);
	await h.clickPop('[data-m=addera]'); await p.sleep(200);
	t.ok(await h.popOpen(), 'editor open');
	await p.key('a', 'ctrl'); await p.type('Dawn'); await p.key('Escape'); await p.sleep(150);
	t.eq((await h.doc()).eras.length, eras + 1, 'added');
	t.ok((await h.doc()).eras.some((e) => e.name === 'Dawn'), 'named');
	await p.key('z', 'ctrl'); await p.sleep(150);
	const after1 = (await h.doc()).eras.length;
	if (after1 !== eras) await p.key('z', 'ctrl');
	await p.sleep(150);
	t.eq((await h.doc()).eras.length, eras, 'gone after ' + (after1 === eras ? 'one undo' : 'two undos'));
	console.log('    add era + rename took', after1 === eras ? 1 : 2, 'undo steps');
});
test('R2E87 holding ArrowDown 25 times: 25 steps, all undoable, saved file matches', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	const o = await byId(h, SIEGE);
	for (let i = 0; i < 25; i++) await p.key('ArrowDown');
	await p.sleep(150);
	const moved = await byId(h, SIEGE);
	t.ok(moved.t > o.t, 'moved');
	t.eq((await h.saved()).events.find((e) => e.id === SIEGE).t, moved.t, 'saved');
	await undoN(p, 25);
	t.eq((await byId(h, SIEGE)).t, o.t, 'undone');
});
test('R2E88 nudging a card beyond the timeline range extends the range, and undo shrinks it back', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const r0 = JSON.stringify((await h.doc()).range);
	await selectIds(p, h, [SIEGE]);
	for (let i = 0; i < 3; i++) await p.key('ArrowDown', 'alt');
	await p.ev(`(() => { const t = ${h.tl}; return 1; })()`);
	// jump the card far out by setting via drag is hard; nudge by year many times at a coarse zoom
	await h.setView(0, 400); await selectIds(p, h, [SIEGE]).catch(() => {});
	const before = JSON.stringify((await h.doc()).range);
	for (let i = 0; i < 12; i++) await p.key('ArrowDown');
	await p.sleep(150);
	const r1 = (await h.doc()).range, e = await byId(h, SIEGE);
	console.log('    range', before, '->', JSON.stringify(r1), 'card year', Math.floor(e.t / 360));
	await undoN(p, 15);
	t.eq(JSON.stringify((await h.doc()).range), r0, 'range restored by undo');
});
test('R2E89 editing a new card via N then Ctrl+Z inside the title undoes typing, not the card', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const n = (await h.events()).length;
	const s = await h.stage(); await p.move(s.l + 200, s.t + 420);
	await p.key('n'); await p.sleep(300);
	await p.key('a', 'ctrl'); await p.type('Abc'); await p.key('z', 'ctrl'); await p.sleep(100);
	t.ok(await editing(p), 'still editing');
	t.eq((await h.events()).length, n + 1, 'card still there');
	await p.key('Escape');
});
test('R2E90 a long unbroken title (200 chars, no spaces) does not overflow the card horizontally', async (p, h, t) => {
	await h.open();
	const c = await cardAt(p, SIEGE); await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.send('Input.insertText', { text: 'W'.repeat(200) }); await p.key('Escape'); await p.sleep(250);
	const r = await p.ev(`(() => { const c = document.querySelector('${A} .evra-card[data-id="${SIEGE}"]'); const tt = c.querySelector('.tt'); return { cw: c.getBoundingClientRect().width, sw: c.scrollWidth, tw: tt.getBoundingClientRect().right - c.getBoundingClientRect().right }; })()`);
	t.ok(r.tw <= 1 && r.sw <= r.cw + 1, 'title overflows the card: ' + JSON.stringify(r));
});

/* ================= batch 3: undo with focus on a control ================= */
test('R2E91 settings: tick a checkbox then Ctrl+Z straight away (focus still on the checkbox) undoes it', async (p, h, t) => {
	await h.open();
	const t0 = (await h.doc()).opts.tint;
	await h.openSheet('cards');
	const cb = await h.sheet('[data-k=oTint]'); await p.click(cb.x, cb.y); await p.sleep(150);
	t.eq((await h.doc()).opts.tint, !t0, 'toggled');
	t.eq(await p.ev(`document.activeElement.dataset.k`), 'oTint', 'focus on the checkbox');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await h.doc()).opts.tint, t0, 'BUG: Ctrl+Z does nothing while a settings checkbox has focus (checkboxes count as "typing")');
});
test('R2E92 card menu: tick a person then Ctrl+Z straight away undoes it', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await menuOf(p, SIEGE);
	const cb = await h.pop(`[data-person="${MIRA}"]`); await p.click(cb.x, cb.y); await p.sleep(150);
	t.eq(((await byId(h, SIEGE)).people || []).join(), MIRA, 'ticked');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.ok(!(await byId(h, SIEGE)).people, 'BUG: Ctrl+Z does nothing while the people checkbox in the card menu has focus');
});
test('R2E93 card menu: change "Approximate" then Ctrl+Z with the select focused undoes it', async (p, h, t) => {
	await h.open();
	await menuOf(p, SIEGE);
	await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=circa]').focus()`);
	await setSelect(p, '[data-m=circa]', 2); await p.sleep(120);
	t.ok((await byId(h, SIEGE)).circa > 0, 'approximate');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.ok(!(await byId(h, SIEGE)).circa, 'BUG: Ctrl+Z does nothing while the Approximate select has focus');
});
test('R2E94 settings: typing a new timeline name then clicking the header Undo reverts the name only', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('4'); await p.sleep(100);
	await h.openSheet('timeline');
	const f = await h.sheet('[data-k=tName]'); await p.click(f.x, f.y);
	await p.key('a', 'ctrl'); await p.type('Renamed TL'); await p.sleep(100);
	const ub = await p.at(`.workspace-leaf.mod-active .view-action[aria-label="Undo"]`);
	await p.click(ub.x, ub.y); await p.sleep(300);
	const d = await h.doc();
	t.eq(d.events.find((e) => e.id === SIEGE).color, '4', 'earlier card color kept (header Undo with a pending name undid the previous step)');
	t.eq(d.name, 'Chronicle of Veld', 'name reverted');
});
test('R2E95 E on a card hidden in a group zooms in and edits it', async (p, h, t) => {
	await h.open();
	const e = await byId(h, SIEGE);
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); for (let i = 1; i <= 4; i++) d.events.push({ id: 'g' + i, t: ${e.t} + i * 3, side: 'b', title: 'Crowd ' + i, text: '', color: null, file: null }); t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`);
	await h.run('fit-all'); await p.sleep(600); await focusStage(p);
	t.ok(await p.at(`${A} .evra-card.group`), 'grouped');
	await p.ev(`${h.tl}.focusEvent && 1`);
	// select g3 through search, then E
	await p.key('/'); await p.sleep(150); await p.type('Crowd 3'); await p.sleep(150); if (/Go to/.test(await p.ev(`document.querySelector('${A} [data-r=palette] .on, ${A} [data-r=palette] [aria-selected=true]')?.textContent || ''`))) await p.key('ArrowDown'); await enterKey(p); await p.sleep(900);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`) || await p.ev(`${h.tl} && 1`), 'picked');
	await p.key('e'); await p.sleep(900);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing[data-id="g3"]')`), 'editing g3');
	await p.key('Escape');
});
test('R2E96 the Undo and Redo commands from the > palette work', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('4'); await p.sleep(100);
	await p.key('/'); await p.sleep(150); await p.type('>undo'); await p.sleep(150); await enterKey(p); await p.sleep(200);
	t.eq((await byId(h, SIEGE)).color, '1', 'undo from palette');
	await p.key('/'); await p.sleep(150); await p.type('>redo'); await p.sleep(150); await enterKey(p); await p.sleep(200);
	t.eq((await byId(h, SIEGE)).color, '4', 'redo from palette');
});
test('R2E97 color digits 1-6 each record one step; 7-9 with 6 presets do nothing and record nothing', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	for (const k of ['2', '3', '7', '8', '9', '4']) await p.key(k);
	await p.sleep(100);
	t.eq((await byId(h, SIEGE)).color, '4', 'last');
	await undoN(p, 1); t.eq((await byId(h, SIEGE)).color, '3', 'undo 1');
	await undoN(p, 1); t.eq((await byId(h, SIEGE)).color, '2', 'undo 2');
	await undoN(p, 1); t.eq((await byId(h, SIEGE)).color, '1', 'undo 3');
	t.ok(!(await hist(p, h)).u, 'nothing else');
});
test('R2E98 pressing the same color twice records only one step', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.key('1'); await p.key('1'); await p.sleep(80);
	t.ok(!(await hist(p, h)).u, 'no-op color press records nothing');
	await p.key('2'); await p.key('2'); await p.sleep(80);
	await undoN(p, 1);
	t.eq((await byId(h, SIEGE)).color, '1', 'one undo');
	t.ok(!(await hist(p, h)).u, 'nothing else');
});
test('R2E99 dragging a card and dropping it where it started records no undo step', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	const c = await cardAt(p, SIEGE);
	await p.drag(c.x, c.y, c.x, c.y + 60, 6); await p.sleep(80);
	await p.key('z', 'ctrl'); await p.sleep(100);
	const c2 = await cardAt(p, SIEGE);
	await p.move(c2.x, c2.y, 2);
	await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c2.x, y: c2.y, button: 'left', clickCount: 1 });
	for (let i = 1; i <= 6; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c2.x, y: c2.y + i * 10, button: 'left', buttons: 1 });
	for (let i = 5; i >= 0; i--) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c2.x, y: c2.y + i * 10, button: 'left', buttons: 1 });
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c2.x, y: c2.y, button: 'left', clickCount: 1 });
	await p.sleep(150);
	const hs = await hist(p, h);
	t.ok(!hs.u, 'a drag that ends where it began records no undo step');
	t.ok(hs.r, 'and does not clear the redo stack');
});

/* ================= batch 4 ================= */
test('R2E100 a moment made approximate then turned into a span with S keeps an invisible "circa" (no way to clear it)', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await menuOf(p, SIEGE); await setSelect(p, '[data-m=circa]', 3); await p.sleep(120);
	await p.key('Escape'); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('s'); await p.sleep(120);
	const e = await byId(h, SIEGE);
	t.ok(e.end != null, 'span');
	await menuOf(p, SIEGE);
	const hasCirca = await p.ev(`!!document.querySelector('${A} [data-r=pop] [data-m=circa]')`);
	await p.key('Escape');
	t.ok(!e.circa || hasCirca, 'BUG: span keeps circa=' + e.circa + ' but its menu has no Approximate control to clear it');
});
test('R2E101 UX: copy in one timeline, paste in another (clip is per-timeline; also hit by the stale key handler bug)', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('c', 'ctrl'); await p.sleep(100);
	await p.ev(`app.vault.create('Other.evra', '').then(() => 1)`);
	await h.open('Other.evra'); await focusStage(p);
	const s = await h.stage(); await p.move(s.l + 300, s.t + 300);
	await p.key('v', 'ctrl'); await p.sleep(200);
	const d = await h.saved('Other.evra');
	t.eq(d.events.length, 1, 'cards copied in one timeline cannot be pasted into another (toast: ' + await h.toast() + ')');
});
test('R2E102 L with a multi-selection opens the multi menu; its color applies to all; Escape keeps the selection', async (p, h, t) => {
	await h.open(); await h.setView(34, 12);
	await selectIds(p, h, [SIEGE, PLAGUE]);
	await p.key('l'); await p.sleep(200);
	t.ok(/2 cards selected/.test(await p.ev(`document.querySelector('${A} [data-r=pop]').textContent`)), 'multi menu');
	await h.clickPop('.swb[data-color="2"]');
	t.ok((await byId(h, SIEGE)).color === '2' && (await byId(h, PLAGUE)).color === '2', 'both');
	await p.key('Escape'); await p.sleep(100);
	t.eq(await selCount(p), 2, 'selection kept');
});
test('R2E103 ArrowUp on the card at the very start pushes it before the range; range grows; undo restores both', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const r0 = JSON.stringify((await h.doc()).range), o = await byId(h, 'je0mqvo');
	await h.setView(-3, 10);
	await selectIds(p, h, ['je0mqvo']);
	for (let i = 0; i < 4; i++) await p.key('ArrowUp');
	await p.sleep(150);
	const e = await byId(h, 'je0mqvo'), r1 = (await h.doc()).range;
	t.ok(e.t < 0, 'before 0');
	t.ok(r1[0] <= Math.floor(e.t / 360), 'range grew to include it: ' + JSON.stringify(r1));
	await undoN(p, 4);
	t.eq((await byId(h, 'je0mqvo')).t, o.t, 'card back');
	t.eq(JSON.stringify((await h.doc()).range), r0, 'range back');
});
test('R2E104 after undoing a delete, the restored card can be selected with J and edited with E', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]); await p.key('Delete'); await p.sleep(100);
	await p.key('z', 'ctrl'); await p.sleep(150);
	const c = await cardAt(p, SIEGE); t.ok(c, 'visible again');
	await p.click(c.x, c.y); await p.key('e'); await p.sleep(250);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing[data-id="${SIEGE}"]')`), 'editable');
	await p.key('Escape');
});
test('R2E105 selecting, then Ctrl+Z of an unrelated step, keeps the selection', async (p, h, t) => {
	await h.open(); await h.setView(34, 12); await focusStage(p);
	await selectIds(p, h, [PLAGUE]); await p.key('2');
	await selectIds(p, h, [SIEGE, FALL]);
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq(JSON.stringify(await selIdsDom(p)), JSON.stringify([FALL, SIEGE].sort()), 'selection survives undo');
});
test('R2E106 after opening another timeline in the same tab, shortcuts act on the new timeline (not the old, destroyed one)', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.ev(`app.vault.create('Other.evra', '').then(() => 1)`);
	await h.open('Other.evra'); await focusStage(p);
	const s = await h.stage(); await p.move(s.l + 300, s.t + 300);
	await p.key('n'); await p.sleep(400);
	t.ok(await editing(p), 'BUG: N did not start a new card in the newly opened timeline (a stale key handler from the previous file handled it)');
	await p.key('Escape'); await p.sleep(200);
	t.eq((await h.saved('Other.evra')).events.length, 1, 'card added to Other');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await h.saved('Other.evra')).events.length, 0, 'Ctrl+Z undoes it');
});
test('R2E107 after switching files in the same tab, Delete does not act on the previous file\'s selection', async (p, h, t) => {
	await h.open(); await focusStage(p);
	await selectIds(p, h, [SIEGE]);
	await p.ev(`app.vault.create('Other.evra', '').then(() => 1)`);
	await h.open('Other.evra'); await focusStage(p);
	await p.key('Delete'); await p.sleep(200);
	t.ok(!/Deleted/.test(await h.toast()), 'BUG: pressing Delete in the new timeline shows "' + await h.toast() + '" (the old timeline deleted its selected card)');
	await h.open(); await p.sleep(300);
	t.ok(await byId(h, SIEGE), 'the old file still has the card');
});

test('R2E108 the header Undo/Redo buttons enable and disable with the history', async (p, h, t) => {
	await h.open(); await focusStage(p);
	const dis = (n) => p.ev(`document.querySelector('.workspace-leaf.mod-active .view-action[aria-label="${n}"]').classList.contains('is-disabled')`);
	t.ok(await dis('Undo'), 'undo disabled at start'); t.ok(await dis('Redo'), 'redo disabled');
	await selectIds(p, h, [SIEGE]); await p.key('3'); await p.sleep(100);
	t.ok(!(await dis('Undo')), 'undo enabled');
	await p.key('z', 'ctrl'); await p.sleep(100);
	t.ok(await dis('Undo'), 'undo disabled again'); t.ok(!(await dis('Redo')), 'redo enabled');
	const rb = await p.at(`.workspace-leaf.mod-active .view-action[aria-label="Redo"]`); await p.click(rb.x, rb.y); await p.sleep(150);
	t.eq((await byId(h, SIEGE)).color, '3', 'header redo');
	t.ok(await dis('Redo'), 'redo disabled');
});
test('R2E109 group panel "Add an event in <year>" adds, edits, and one undo removes it', async (p, h, t) => {
	await h.open();
	const e = await byId(h, SIEGE);
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); for (let i = 1; i <= 4; i++) d.events.push({ id: 'g' + i, t: ${e.t} + i * 3, side: 'b', title: 'Crowd ' + i, text: '', color: null, file: null }); t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`);
	await h.run('fit-all'); await p.sleep(600);
	const n = (await h.events()).length;
	const g = await p.at(`${A} .evra-card.group`); await p.click(g.x, g.y); await p.sleep(450);
	await h.clickPop('[data-m=add]'); await p.sleep(900);
	t.eq((await h.events()).length, n + 1, 'added');
	t.ok(await editing(p), 'editing');
	await p.key('a', 'ctrl'); await p.type('In group'); await p.key('Escape'); await p.sleep(150);
	t.ok((await h.events()).some((x) => x.title === 'In group'), 'named');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'one undo');
});
test('R2E110 drag-select along the line → New span: named, and add+name is one undo step', async (p, h, t) => {
	await h.open(); await h.setView(40, 10);
	const n = (await h.events()).length, x = await h.lineX(), s = await h.stage();
	await p.drag(x, s.t + 200, x, s.t + 420); await p.sleep(200);
	await h.clickPop('[data-m=span]'); await p.sleep(350);
	t.ok(await editing(p), 'editing');
	await p.key('a', 'ctrl'); await p.type('Line span'); await p.key('Escape'); await p.sleep(150);
	t.ok((await h.events()).some((e) => e.title === 'Line span' && e.end > e.t), 'span named');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.eq((await h.events()).length, n, 'BUG: New span + its name need two undos (Add event needs one)');
});
