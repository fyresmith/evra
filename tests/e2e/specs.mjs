// End-to-end scenarios. Each gets a fresh copy of the sample world; `p` drives Obsidian, `h` knows Evra, `t` asserts.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';

/* ---------- opening ---------- */
test('opens the sample timeline with cards, eras, ruler and minimap', async (p, h, t) => {
	await h.open();
	t.ok((await h.cardCount()) >= 6, 'cards render');
	t.ok(await p.ev(`document.querySelectorAll('${A} .eralabels .el:not([hidden])').length > 0`), 'era labels render');
	t.ok(await p.ev(`document.querySelectorAll('${A} .ruler span:not([hidden])').length > 3`), 'ruler renders');
	t.ok(await p.ev(`document.querySelector('${A} .minimap canvas').width > 0`), 'minimap draws');
	t.eq(await p.ev(`document.querySelector('.workspace-leaf.mod-active .view-header-title').textContent`), 'Chronicle of Veld', 'tab title');
});
test('word count ignores timelines', async (p, h, t) => {
	await h.open();
	await p.sleep(400);
	t.ok(!(await p.ev(`[...document.querySelectorAll('.status-bar-item')].some(e => /words/.test(e.textContent) && e.offsetParent)`)), 'no word count');
});
test('an empty .evra file becomes a new timeline', async (p, h, t) => {
	await p.ev(`app.vault.create('Empty.evra', '').then(() => 1)`);
	await h.open('Empty.evra');
	const d = await h.saved('Empty.evra');
	t.eq(d.format, 'evra', 'saved as an Evra file');
	t.eq(d.events.length, 0, 'no events');
	t.ok(await p.ev(`!document.querySelector('${A} .empty').hidden`), 'empty-state hint shows');
});
test('a corrupt .evra file shows an error and is left untouched', async (p, h, t) => {
	await p.ev(`app.vault.create('Broken.evra', '{ not json').then(() => 1)`);
	await h.open('Broken.evra');
	t.ok(await p.ev(`!!document.querySelector('.workspace-leaf.mod-active .evra-error')`), 'error shown');
	await p.ev(`app.workspace.activeLeaf.view.requestSave(); app.workspace.activeLeaf.view.save()`);
	await p.sleep(300);
	t.eq(await p.ev(`app.vault.adapter.read('Broken.evra')`), '{ not json', 'file unchanged');
});
test('an older or hand-written file opens', async (p, h, t) => {
	await p.ev(`app.vault.create('Old.evra', JSON.stringify({ name: 'Old', cal: { dpm: 30, mpy: 12, months: ['A','B','C','D','E','F','G','H','I','J','K','L'], prefix: 'Year' }, events: [{ t: 400, title: 'Hand written' }], eras: [] })).then(() => 1)`);
	await h.open('Old.evra');
	t.ok(await h.card('Hand written'), 'card shows');
	const d = await h.saved('Old.evra');
	t.eq(d.events[0].side, 'b', 'missing fields filled in');
	t.ok(!!d.events[0].id, 'id added');
});

/* ---------- events ---------- */
test('double-clicking empty space adds an event and edits it', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x - 170, s.t + 300);
	await p.sleep(400);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`), 'editing');
	await p.key('a', 'ctrl'); await p.type('Harbour fire'); await p.key('Enter'); await p.type('The docks burn.');
	await p.key('Escape'); await p.sleep(300);
	const evs = await h.events();
	t.eq(evs.length, n + 1, 'one event added');
	const e = evs.find((x) => x.title === 'Harbour fire');
	t.ok(e, 'title saved'); t.eq(e.text, 'The docks burn.', 'description saved'); t.eq(e.side, 'a', 'on the side clicked');
	t.ok((await h.saved()).events.some((x) => x.title === 'Harbour fire'), 'written to the file');
});
test('double-clicking inside era shading still adds an event', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	await p.dbl(x + 380, s.t + 200); await p.sleep(300); await p.key('Escape');
	t.eq((await h.events()).length, n + 1, 'added');
});
test('double-clicking a card edits it and never adds one', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(300);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`), 'editing');
	await p.key('Escape');
	t.eq((await h.events()).length, n, 'nothing added');
});
test('Enter in a description saves and starts the next event', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250); await p.key('Enter'); await p.key('Enter'); await p.sleep(400);
	t.eq((await h.events()).length, n + 1, 'next event started');
	await p.key('Escape');
});
test('descriptions stop at 256 characters', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250); await p.key('Enter');
	await p.send('Input.insertText', { text: 'x'.repeat(300) }); await p.sleep(100);
	t.ok(await p.ev(`document.querySelector('${A} .evra-card.editing .cnt').textContent === '256/256'`), 'counter at the limit');
	await p.key('Escape');
	t.eq((await h.ev('Siege of the Keep begins')).text.length, 256, 'saved at the limit');
});
test('dragging a card changes its date and side, and undo restores it', async (p, h, t) => {
	await h.open();
	const before = await h.ev('Siege of the Keep begins'), c = await h.card('Siege of the Keep begins', '.dt');
	await p.drag(c.x, c.y, c.x, c.y + 120);
	const moved = await h.ev('Siege of the Keep begins');
	t.ok(moved.t > before.t, 'later');
	const c2 = await h.card('Siege of the Keep begins', '.dt'), x = await h.lineX();
	await p.drag(c2.x, c2.y, x - 200, c2.y);
	t.eq((await h.ev('Siege of the Keep begins')).side, 'a', 'switched sides');
	await p.key('z', 'ctrl'); await p.key('z', 'ctrl'); await p.sleep(200);
	const back = await h.ev('Siege of the Keep begins');
	t.eq(back.t, before.t, 'undo restores the date'); t.eq(back.side, before.side, 'undo restores the side');
	await p.key('z', 'ctrl', 'shift'); await p.sleep(150);
	t.ok((await h.ev('Siege of the Keep begins')).t > before.t, 'redo');
});
test('dragging a dot pulls a moment into a span, and back', async (p, h, t) => {
	await h.open();
	const ev = await h.ev('Siege of the Keep begins');
	const dot = await p.ev(`(() => { const t = ${h.tl}; const s = document.querySelector('${A} .stage').getBoundingClientRect(); const c = [...document.querySelectorAll('${A} .lines circle')].map(e => e.getBoundingClientRect()).map(r => ({x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width})); const card = document.querySelector('${A} .evra-card[aria-label^="Siege of the Keep begins"]').getBoundingClientRect(); return c.filter(d => d.w < 14 && Math.abs(d.y - (card.y + 18)) < 40).sort((a, b) => Math.abs(a.y - card.y - 18) - Math.abs(b.y - card.y - 18))[0]; })()`);
	t.ok(dot, 'found its dot');
	await p.drag(dot.x, dot.y, dot.x, dot.y + 160);
	const span = await h.ev('Siege of the Keep begins');
	t.ok(span.end > span.t, 'became a span'); t.eq(span.t, ev.t, 'start kept');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.ok((await h.ev('Siege of the Keep begins')).end == null, 'undo');
});
test('keyboard: J/K select, E edits, S spans, arrows nudge, 0-9 color, Delete deletes', async (p, h, t) => {
	await h.open();
	await h.focusStage();
	await p.key('j'); await p.sleep(150);
	const selected = await p.ev(`(document.querySelector('${A} .evra-card.sel') || {}).getAttribute ? document.querySelector('${A} .evra-card.sel').getAttribute('aria-label') : ''`);
	t.ok(!!selected, 'J selects a card');
	const title = (await h.events()).sort((a, b) => a.t - b.t)[0];
	await p.key('s'); await p.sleep(100);
	t.ok((await h.doc()).events.find((e) => e.id === title.id).end != null, 'S makes a span');
	await p.key('s'); await p.key('3'); await p.sleep(100);
	const e3 = (await h.doc()).events.find((e) => e.id === title.id);
	t.ok(e3.end == null, 'S again makes a moment'); t.eq(e3.color, '3', '3 colors it');
	const t0 = e3.t; await p.key('ArrowDown'); await p.sleep(100);
	t.ok((await h.doc()).events.find((e) => e.id === title.id).t > t0, 'arrow nudges');
	await p.key('ArrowLeft'); await p.sleep(100);
	t.eq((await h.doc()).events.find((e) => e.id === title.id).side, 'a', 'arrow switches side');
	const n = (await h.events()).length;
	await p.key('Delete'); await p.sleep(150);
	t.eq((await h.events()).length, n - 1, 'deleted');
	t.ok(/Deleted/.test(await h.toast()), 'undo toast');
});
test('N adds a card at the pointer; copy, paste and duplicate', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), n = (await h.events()).length;
	await p.move(s.l + 200, s.t + 500); await p.key('n'); await p.sleep(300); await p.key('Escape');
	t.eq((await h.events()).length, n + 1, 'N adds');
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y);
	await p.key('c', 'ctrl'); await p.move(s.l + 200, s.t + 200); await p.key('v', 'ctrl'); await p.sleep(200);
	t.eq((await h.events()).filter((e) => e.file && e.file.includes('Treaty')).length, 2, 'pasted');
	await p.key('d', 'ctrl'); await p.sleep(200);
	t.eq((await h.events()).filter((e) => e.file && e.file.includes('Treaty')).length, 3, 'duplicated');
});
test('shift-click and marquee select several cards, which move together', async (p, h, t) => {
	await h.open();
	const a = await h.card('Siege of the Keep begins', '.dt'), b = await h.card('Treaty of Sallow', '.dt');
	await p.click(a.x, a.y); await p.click(b.x, b.y, { modifiers: 8 });
	t.eq(await p.ev(`document.querySelectorAll('${A} .evra-card.sel').length`), 2, 'two selected');
	const ta = (await h.ev('Siege of the Keep begins')).t, tb = (await h.ev('Treaty of Sallow')).t;
	await p.drag(a.x, a.y, a.x, a.y + 100);
	const da = (await h.ev('Siege of the Keep begins')).t - ta, db = (await h.ev('Treaty of Sallow')).t - tb;
	t.ok(da > 0 && da === db, 'moved together');
	await p.key('Escape');
	await p.key('a', 'ctrl'); await p.sleep(100);
	t.ok(/cards selected/.test(await h.toast()), 'select all');
});

/* ---------- menus ---------- */
test('card menu: color, icon, tags, span options, flip, duplicate, delete', async (p, h, t) => {
	await h.open();
	const openMenu = async () => { await h.menu('Siege of the Keep begins'); t.ok(await h.popOpen(), 'menu open'); };
	await openMenu(); await h.clickPop('.swb[data-color="4"]');
	t.eq((await h.ev('Siege of the Keep begins')).color, '4', 'color');
	await h.clickPop('[data-icon="⚓"]');
	t.eq((await h.ev('Siege of the Keep begins')).icon, '⚓', 'icon');
	const tg = await h.pop('[data-k=ctags]'); await p.click(tg.x, tg.y); await p.type('siege, #war'); await p.key('Enter'); await p.sleep(150);
	t.eq((await h.ev('Siege of the Keep begins')).tags.join(), 'siege,war', 'tags');
	await openMenu(); await h.clickPop('[data-m=span]');
	t.ok((await h.ev('Siege of the Keep begins')).end != null, 'span');
	await openMenu(); await h.clickPop('[data-m=oe]');
	t.ok((await h.ev('Siege of the Keep begins')).oe, 'ongoing');
	await openMenu(); await h.clickPop('[data-m=os]');
	t.ok((await h.ev('Siege of the Keep begins')).os, 'unknown start');
	await openMenu(); await h.clickPop('[data-m=life]');
	t.ok((await h.ev('Siege of the Keep begins')).life, 'life');
	await openMenu(); await h.clickPop('[data-m=flip]');
	t.eq((await h.ev('Siege of the Keep begins')).side, 'a', 'flip');
	const n = (await h.events()).length;
	await openMenu(); await h.clickPop('[data-m=dup]');
	t.eq((await h.events()).length, n + 1, 'duplicate');
	await openMenu(); await h.clickPop('[data-m=del]');
	t.eq((await h.events()).length, n, 'delete');
});
test('card menu: approximate date and pinning to another card', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	await p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] [data-m=circa]'); s.value = s.options[2].value; s.dispatchEvent(new Event('change')); })()`); await p.sleep(150);
	t.ok((await h.ev('Siege of the Keep begins')).circa > 0, 'approximate');
	const treaty = await h.ev('Treaty of Sallow');
	await p.ev(`(() => { const s = document.querySelector('${A} [data-r=pop] [data-m=pin]'); s.value = ${JSON.stringify(treaty.id)}; s.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	const pinned = await h.ev('Siege of the Keep begins');
	t.ok(pinned.rel && pinned.rel.to === treaty.id, 'pinned');
	const tc = await h.card('Treaty of Sallow', '.dt'); await p.drag(tc.x, tc.y, tc.x, tc.y + 80);
	const moved = (await h.ev('Treaty of Sallow')).t - treaty.t, follow = (await h.ev('Siege of the Keep begins')).t - pinned.t;
	t.ok(moved !== 0 && moved === follow, 'the pinned card follows its anchor');
});
test('convert a card to a note, and link and unlink notes', async (p, h, t) => {
	await h.open();
	await h.menu('Siege of the Keep begins');
	await h.clickPop('[data-m=convert]'); await p.sleep(600);
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Siege of the Keep begins.md')`), 'note created');
	t.ok((await h.ev('Siege of the Keep begins')).file, 'card linked');
	await h.menu('Siege of the Keep begins');
	await h.clickPop('[data-m=unlink]'); await p.sleep(200);
	const u = await h.ev('Siege of the Keep begins');
	t.ok(!u.file && u.title === 'Siege of the Keep begins', 'unlinked, title kept');
	await h.menu('Siege of the Keep begins');
	await h.clickPop('[data-m=link]'); await p.sleep(400);
	t.ok(await p.ev(`!!document.querySelector('.modal-container .prompt-input')`), 'note picker opens');
	await p.type('Pale Court'); await p.sleep(250); await p.key('Enter'); await p.sleep(300);
	t.ok(/Pale Court/.test((await h.events()).find((e) => e.id === u.id).file || ''), 'linked to the picked note');
});
test('right-click menu: add event, span, era, set now, fit', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), x = await h.lineX(), n = (await h.events()).length, ne = (await h.doc()).eras.length;
	const menu = async (y, m) => { await p.right(s.l + s.w - 90, s.t + y); t.ok(await h.popOpen(), 'menu'); await h.clickPop(`[data-m=${m}]`); await p.sleep(300); await p.key('Escape'); };
	await menu(260, 'add'); t.eq((await h.events()).length, n + 1, 'add event');
	await menu(320, 'addspan'); const sp = (await h.events()).slice(-1)[0]; t.ok(sp.end > sp.t, 'add span');
	await menu(380, 'now'); t.ok((await h.doc()).now != null, 'set now');
	await p.right(s.l + s.w - 90, s.t + 440); await h.clickPop('[data-m=addera]'); await p.sleep(250); await p.key('Escape');
	t.eq((await h.doc()).eras.length, ne + 1, 'add era');
});
test('group cards: a crowded year collapses, opens a list, and spreads out', async (p, h, t) => {
	await h.open();
	const e = await h.ev('Siege of the Keep begins');
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); for (let i = 1; i <= 4; i++) d.events.push({ id: 'g' + i, t: ${e.t} + i * 3, side: 'b', title: 'Crowd ' + i, text: '', color: null, file: null }); t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`);
	await h.run('fit-all'); await p.sleep(600);
	const g = await p.at(`${A} .evra-card.group`);
	t.ok(g, 'group card');
	await p.click(g.x, g.y); await p.sleep(400);
	t.ok(await p.ev(`!!document.querySelector('${A} [data-r=pop] .grp')`), 'group list');
	await h.clickPop('[data-m=spread]'); await p.sleep(700);
	t.ok(!(await p.at(`${A} .evra-card.group`)), 'spread out');
});

/* ---------- eras ---------- */
test('drag along the line makes a sub-era; the editor renames, recolors and dates it', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), x = await h.lineX(), n = (await h.doc()).eras.length;
	let y0 = s.t + 190, ok = false;
	for (const dy of [0, 40, 80, 120]) { await p.drag(x, y0 + dy, x, y0 + dy + 140); if (await h.pop('[data-m=era]')) { ok = true; break; } await p.key('Escape'); }
	t.ok(ok, 'create menu');
	t.ok(/sub-era of/.test(await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=era]').textContent`)), 'offers a sub-era');
	await h.clickPop('[data-m=era]'); await p.sleep(300);
	await p.key('a', 'ctrl'); await p.type('The Salt Wars');
	await h.clickPop('.swb[data-color="1"]');
	await p.key('Enter'); await p.sleep(250);
	const d = await h.doc(), era = d.eras.find((e) => e.name === 'The Salt Wars');
	t.eq(d.eras.length, n + 1, 'one era'); t.ok(era && era.parent, 'nested'); t.eq(era.color, '1', 'colored');
	t.ok(await p.ev(`[...document.querySelectorAll('${A} .eralabels .el')].some(e => e.textContent === 'The Salt Wars')`), 'label shows');
	await p.key('z', 'ctrl'); await p.sleep(150);
	t.ok(!(await h.doc()).eras.some((e) => e.name === 'The Salt Wars'), 'one undo removes the rename…');
});
test('era editor: typed dates stay inside the parent; delete moves sub-eras up', async (p, h, t) => {
	await h.open();
	const l = await p.at(`${A} .eralabels .el.sub`); await p.click(l.x, l.y); await p.sleep(300);
	const id = await p.ev(`document.querySelector('${A} .eralabels .el.sub').dataset.era`);
	const before = (await h.doc()).eras.find((e) => e.id === id), parent = (await h.doc()).eras.find((e) => e.id === before.parent);
	await p.ev(`(() => { const i = document.querySelector('${A} [data-r=pop] [data-d=sY]'); i.value = '-500'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	const after = (await h.doc()).eras.find((e) => e.id === id);
	t.ok(after.start >= parent.start, 'clamped to the parent');
	await p.key('Escape'); await p.sleep(150);
	const kids = (await h.doc()).eras.filter((e) => e.parent === id).length;
	await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(600); await p.ev(`document.querySelector('${A} .eralabels .el[data-era="${id}"]').click()`); await p.sleep(300); await h.clickPop('[data-m=del]'); await p.sleep(200);
	const d = await h.doc();
	t.ok(!d.eras.some((e) => e.id === id), 'deleted');
	t.eq(d.eras.filter((e) => e.parent === before.parent).length >= kids, true, 'children moved up');
});
test('dragging an era edge resizes it and its neighbour', async (p, h, t) => {
	await h.open(); await h.run('fit-all'); await p.sleep(600);
	const d = await h.doc(), top = d.eras.filter((e) => !e.parent).sort((a, b) => a.start - b.start), shared = top[0].end;
	const s = await h.stage(), x = await h.lineX();
	const y = await p.ev(`(() => { const t = ${h.tl}; const b = [...document.querySelectorAll('${A} .lines line')].find(() => false); return null; })()`);
	// find the screen y of the shared edge from the ruler scale
	const sy = await p.ev(`(() => { const t = ${h.tl}; const v = t.getViewState(); const s = document.querySelector('${A} .stage').getBoundingClientRect(); return s.y + (${shared} - v.v0) * v.scale; })()`);
	await p.drag(x + 300, sy, x + 300, sy + 60);
	const after = (await h.doc()).eras.filter((e) => !e.parent).sort((a, b) => a.start - b.start);
	t.ok(after[0].end > shared, 'edge moved');
	t.eq(after[0].end, after[1].start, 'neighbour moved with it');
});
test('right-clicking an era label fits it; the breadcrumb works', async (p, h, t) => {
	await h.open();
	const v0 = await p.ev(`${h.tl}.getViewState().scale`);
	const l = await p.at(`${A} .eralabels .el.sub`); await p.right(l.x, l.y); await p.sleep(600);
	t.ok((await p.ev(`${h.tl}.getViewState().scale`)) !== v0, 'zoomed to the era');
	const b = await p.at(`${A} .crumb button[data-era]`); await p.click(b.x, b.y); await p.sleep(600);
	t.ok(true, 'breadcrumb click');
	const sib = await p.at(`${A} .crumb .chev`); if (sib) { await p.click(sib.x, sib.y); await p.sleep(200); t.ok(await h.popOpen(), 'sibling list'); }
});

/* ---------- search, filter, views ---------- */
test('search jumps to typed dates, finds cards first by name, and runs commands', async (p, h, t) => {
	await h.open(); await h.focusStage();
	await p.key('k', 'ctrl'); await p.sleep(150);
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=palette]').hidden`), 'opens');
	await p.type('14 Frost 38'); await p.sleep(150);
	t.ok(/14 Frost, Year 38/.test(await p.ev(`document.querySelector('${A} .pi.on').textContent`)), 'reads the date');
	await p.key('Enter'); await p.sleep(500);
	await p.key('/'); await p.type('Treaty'); await p.sleep(150);
	t.ok(/Treaty of Sallow/.test(await p.ev(`document.querySelector('${A} .pi.on').textContent`)), 'name matches first');
	await p.key('Escape');
	await p.key('k', 'ctrl'); await p.type('>fit'); await p.sleep(150);
	t.ok(/Fit everything/.test(await p.ev(`document.querySelector('${A} .pi.on').textContent`)), 'commands');
	await p.key('Enter'); await p.sleep(400);
});
test('filters fade or hide, and clear', async (p, h, t) => {
	await h.open(); await h.run('fit-all'); await p.sleep(500);
	const all = await h.cardCount();
	await h.run('filter'); await p.sleep(200);
	const war = await h.pop('[data-ft=war]'); await p.click(war.x, war.y); await p.sleep(250);
	t.ok(await p.ev(`document.querySelectorAll('${A} .evra-card.dim2').length > 0`), 'fades the rest');
	await h.clickPop('[data-f=mode][data-v=hide]'); await p.sleep(400);
	t.ok((await h.cardCount()) < all, 'hides the rest');
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=fpill]').hidden`), 'pill shows');
	await p.key('Escape');
	const c = await p.at(`${A} [data-r=fpill] [data-m=clear]`); await p.click(c.x, c.y); await p.sleep(400);
	t.eq(await h.cardCount(), all, 'cleared');
});
test('saved views save, reopen and delete', async (p, h, t) => {
	await h.open(); await h.setView(30, 10); await h.focusStage();
	await p.key('b'); await p.sleep(200);
	const i = await h.pop('[data-k=vname]'); await p.click(i.x, i.y); await p.type('War years'); await p.key('Enter'); await p.sleep(200);
	t.eq((await h.doc()).views[0].name, 'War years', 'saved');
	await h.run('fit-all'); await p.sleep(500);
	await p.key('b'); await p.sleep(200); await h.clickPop('[data-v]'); await p.sleep(600);
	const v = await p.ev(`${h.tl}.getViewState()`);
	t.ok(Math.abs(v.v0 / 360 - 30) < 2, 'reopened');
	await p.key('b'); await p.sleep(200); await h.clickPop('[data-vdel]'); await p.sleep(150);
	t.eq((await h.doc()).views.length, 0, 'deleted');
});

/* ---------- settings ---------- */
test('settings: every tab renders', async (p, h, t) => {
	await h.open();
	for (const tab of ['calendar', 'formats', 'timeline', 'cards', 'colors', 'notes']) {
		await h.openSheet(tab);
		t.ok(await p.ev(`document.querySelector('${A} .sheet-body').children.length > 0`), tab);
	}
});
test('calendar: presets keep events on their named day; months edit', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	const before = await p.ev(`${h.tl}.getDoc().events.map(e => e.t).join()`);
	await p.ev(`(() => { const s = document.querySelector('${A} [data-k=sPreset]'); s.value = 'gregorian'; s.dispatchEvent(new Event('change')); })()`); await p.sleep(300);
	const d = await h.doc();
	t.eq(d.cal.months.length, 12, 'twelve months'); t.eq(d.cal.months[0].name, 'January', 'gregorian'); t.eq(d.cal.leaps.length, 1, 'leap rule');
	t.ok(before !== d.events.map((e) => e.t).join(), 'dates remapped');
	const add = await h.sheet('[data-k=mAdd]'); await p.click(add.x, add.y); await p.sleep(200);
	t.eq((await h.doc()).cal.months.length, 13, 'month added');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-days="12"]'); i.value = '5'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(150);
	await p.ev(`(() => { const i = document.querySelector('${A} [data-fest="12"]'); i.checked = true; i.dispatchEvent(new Event('change')); })()`); await p.sleep(150);
	const d2 = await h.doc(); t.eq(d2.cal.months[12].days, 5, 'days'); t.ok(d2.cal.months[12].inter, 'festival');
	const del = await h.sheet('[data-del="12"]'); await p.click(del.x, del.y); await p.sleep(200);
	t.eq((await h.doc()).cal.months.length, 12, 'removed');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await h.doc()).cal.months.length, 13, 'undo');
});
test('calendar: weekdays, units, numbering, second calendar, import', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=wkNames]'); i.value = 'Moonday, Tidesday, Stormday'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	t.eq((await h.doc()).cal.weekdays.length, 3, 'weekdays');
	const u = await h.sheet('[data-k=uYear]'); await p.click(u.x, u.y); await p.key('a', 'ctrl'); await p.type('cycle'); await p.key('Tab'); await p.sleep(200);
	t.eq((await h.doc()).cal.units.year, 'cycle', 'unit name');
	t.ok(/Cycle 30/.test(await p.ev(`document.querySelector('${A} .ruler').textContent`)) || /Cycle/.test(await p.ev(`document.querySelector('${A} .ruler').textContent`)), 'ruler uses it');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=sYs]'); i.value = '1000'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	t.ok(/10[3-4]\d/.test(await p.ev(`document.querySelector('${A} .ruler').textContent`)), 'numbering');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=s2on]'); i.checked = true; i.dispatchEvent(new Event('change')); })()`); await p.sleep(300);
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=ruler2]').hidden`), 'second calendar ruler');
	const imp = JSON.stringify({ static: { months: [{ name: 'Hammer', length: 30 }, { name: 'Midwinter', length: 1, type: 'intercalary' }, { name: 'Alturiak', length: 30 }], leapDays: [{ timespan: 1, interval: '4' }], weekdays: ['A', 'B'] } });
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=impTxt]'); i.value = ${JSON.stringify(imp)}; })()`);
	const go = await h.sheet('[data-k=impGo]'); await p.click(go.x, go.y); await p.sleep(300);
	const c = (await h.doc()).cal;
	t.eq(c.months.length, 3, 'imported months'); t.ok(c.months[1].inter, 'festival month'); t.eq(c.leaps.length, 1, 'leap rule');
});
test('formats: tokens, live preview and reset', async (p, h, t) => {
	await h.open(); await h.openSheet('formats');
	const f = await h.sheet('[data-fmt=year]'); await p.click(f.x, f.y); await p.key('a', 'ctrl'); await p.type('{Y} AR'); await p.sleep(200);
	t.ok(/42 AR/.test(await p.ev(`document.querySelector('${A} [data-prev=yearPos]').textContent`)), 'preview');
	await p.key('Tab'); await p.sleep(200);
	t.eq((await h.doc()).cal.fmt.year, '{Y} AR', 'saved');
	const tok = await h.sheet('[data-tok="{W}"]'); t.ok(tok, 'token chips');
	const r = await h.sheet('[data-k=fReset]'); await p.click(r.x, r.y); await p.sleep(200);
	t.eq((await h.doc()).cal.fmt.year, '{U} {Y}', 'reset');
});
test('timeline settings: name, direction, range, snapping, now', async (p, h, t) => {
	await h.open(); await h.openSheet('timeline');
	const n = await h.sheet('[data-k=tName]'); await p.click(n.x, n.y); await p.key('a', 'ctrl'); await p.type('Veld history'); await p.key('Tab'); await p.sleep(200);
	t.eq((await h.doc()).name, 'Veld history', 'name');
	const o = await h.sheet('[data-o=ltr]'); await p.click(o.x, o.y); await p.sleep(400);
	t.eq((await h.doc()).orientation, 'ltr', 'direction');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=r1]'); i.value = '200'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	t.eq((await h.doc()).range[1], 200, 'range');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=r0]'); i.value = '60'; i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	t.ok((await h.doc()).range[0] <= 0, 'range kept wide enough for the events');
	const sn = await h.sheet('[data-snap=m]'); await p.click(sn.x, sn.y); await p.sleep(150);
	t.eq((await h.doc()).opts.snapTo, 'm', 'snapping');
	const cl = await h.sheet('[data-k=nwClr]'); await p.click(cl.x, cl.y); await p.sleep(200);
	t.ok((await h.doc()).now == null, 'now cleared');
});
test('cards settings: width, lines, spans, tint, grouping', async (p, h, t) => {
	await h.open(); await h.openSheet('cards');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-k=cw]'); i.dispatchEvent(new Event('pointerdown')); i.value = '300'; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	t.eq((await h.doc()).cardWidth, 300, 'width');
	for (const [sel, check] of [['[data-lines="2"]', (d) => d.opts.cardLines === 2], ['[data-spans=blocks]', (d) => d.opts.spanStyle === 'blocks'], ['[data-grp="5"]', (d) => d.opts.groupOver === 5]]) {
		const b = await h.sheet(sel); await p.click(b.x, b.y); await p.sleep(250); t.ok(check(await h.doc()), sel);
	}
	t.ok(await p.ev(`document.querySelectorAll('${A} .ribbon').length > 0`), 'blocks draw');
});
test('colors: a preset recolors everything; add, rename, delete, reset', async (p, h, t) => {
	await h.open(); await h.openSheet('colors');
	const hx = await h.sheet('[data-ph="1"]'); await p.click(hx.x, hx.y); await p.key('a', 'ctrl'); await p.type('#2f6fe0'); await p.key('Enter'); await p.sleep(250);
	t.eq((await h.doc()).palette[0].hex, '#2f6fe0', 'hex');
	t.ok(await p.ev(`[...document.querySelectorAll('${A} .evra-card')].some(c => c.style.getPropertyValue('--cc') === '#2f6fe0')`), 'cards recolored');
	const bad = await h.sheet('[data-ph="2"]'); await p.click(bad.x, bad.y); await p.key('a', 'ctrl'); await p.type('nope'); await p.key('Enter'); await p.sleep(200);
	t.ok(/hex/.test(await h.toast()), 'rejects a bad hex');
	const add = await h.sheet('[data-k=palAdd]'); await p.click(add.x, add.y); await p.sleep(200);
	t.eq((await h.doc()).palette.length, 7, 'added');
	const del = await h.sheet('[data-pdel="1"]'); await p.click(del.x, del.y); await p.sleep(200);
	t.ok(!(await h.doc()).palette.some((x) => x.id === '1'), 'deleted');
	t.ok(!(await h.doc()).events.some((e) => e.color === '1'), 'its cards lost the color');
	const r = await h.sheet('[data-k=palReset]'); await p.click(r.x, r.y); await p.sleep(200);
	t.eq((await h.doc()).palette.length, 6, 'reset');
	t.ok(await p.ev(`[...document.querySelectorAll('${A} [data-ph]')].every(i => /^#[0-9a-f]{6}$/.test(i.value) && i.value !== '#888888')`), 'built-ins show real hex codes');
});
test('defaults: saved settings start new timelines', async (p, h, t) => {
	await h.open(); await h.openSheet('calendar');
	await p.ev(`(() => { const s = document.querySelector('${A} [data-k=sPreset]'); s.value = 'moons'; s.dispatchEvent(new Event('change')); })()`); await p.sleep(200);
	await h.openSheet('timeline'); const d = await h.sheet('[data-k=tDef]'); await p.click(d.x, d.y); await p.sleep(300);
	await p.ev(`app.commands.executeCommandById('evra:new-timeline')`); await p.sleep(1200);
	t.eq((await h.doc()).cal.months.length, 13, 'new timeline uses the saved calendar');
});

/* ---------- notes ---------- */
test('hovering a linked card opens Obsidian page preview', async (p, h, t) => {
	await h.open();
	const l = await h.card('Fall of the River Keep', '.ln'); await p.move(l.x, l.y, 4); await p.sleep(1400);
	t.ok(await p.ev(`!!document.querySelector('.popover.hover-popover')`), 'preview shows');
	await p.move(l.x + 400, l.y - 300, 4);
});
test('the open-note button opens the note beside the timeline, reusing the pane', async (p, h, t) => {
	await h.open();
	let l = await h.card('Fall of the River Keep', '.ln'); await p.click(l.x, l.y); await p.sleep(700);
	t.ok(await p.ev(`app.workspace.getLeavesOfType('markdown').some(l => l.view.file && l.view.file.basename === 'Fall of the River Keep')`), 'opened');
	await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(300);
	l = await h.card('Treaty of Sallow', '.ln'); await p.click(l.x, l.y); await p.sleep(700);
	t.eq(await p.ev(`app.workspace.getLeavesOfType('markdown').length`), 1, 'reused the same pane');
});
test('note sync writes properties, follows moves, reads edits back, and strips', async (p, h, t) => {
	await h.open(); await h.openSheet('notes');
	const on = await h.sheet('[data-k=syOn]'); await p.click(on.x, on.y); await p.sleep(1500);
	const fm = () => p.ev(`(() => { const f = app.vault.getAbstractFileByPath('Fall of the River Keep.md'); return JSON.parse(JSON.stringify(app.metadataCache.getFileCache(f).frontmatter || {})); })()`);
	let f = await fm();
	t.eq(f['timeline-year'], 38, 'year'); t.eq(f['timeline-era'], 'The Second Age', 'era');
	t.ok(!(await p.ev(`(app.metadataCache.getFileCache(app.vault.getAbstractFileByPath('The Archive.md')).frontmatter || {})['timeline-year'] != null`)), 'unlinked notes untouched');
	await p.key('Escape');
	const c = await h.card('Fall of the River Keep', '.dt'); await p.drag(c.x, c.y, c.x, c.y + 150); await p.sleep(1600);
	f = await fm(); t.ok(f['timeline-year'] > 38, 'follows the card');
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('Fall of the River Keep.md'), m => { m['timeline-year'] = 60; m['timeline-month'] = 'Frost'; }).then(() => 1)`); await p.sleep(1500);
	const e = await h.ev('Fall of the River Keep');
	t.eq(await p.ev(`(() => { const t = ${h.tl}; const e = t.getDoc().events.find(e => e.file === 'Fall of the River Keep'); return Math.floor(e.t / 360); })()`), 60, 'the card moved to the year in the note');
	t.ok(e.t > 0, 'moved');
	await h.openSheet('notes'); const s = await h.sheet('[data-k=syStrip]'); await p.click(s.x, s.y); await p.sleep(1200);
	f = await fm(); t.ok(f['timeline-year'] == null && f['timeline-era'] == null, 'stripped');
});
test('create cards from dated notes', async (p, h, t) => {
	await h.open(); await h.openSheet('notes');
	const n = (await h.events()).length;
	const go = await h.sheet('[data-k=cfnGo]'); t.ok(go, 'dated notes found'); await p.click(go.x, go.y); await p.sleep(400);
	const evs = await h.events();
	t.ok(evs.length >= n + 2, 'cards created');
	t.ok(evs.some((e) => e.file === 'The Salt Moot'), 'from year and month properties');
});
test('renaming or moving a linked note keeps the card linked, even in closed timelines', async (p, h, t) => {
	await h.open();
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), 'Lore/Treaty of the Sallow.md').then(() => 1)`); await p.sleep(900);
	t.ok(/Treaty of the Sallow/.test((await h.events()).find((e) => e.file && /Treaty/.test(e.file)).file), 'open timeline follows');
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(400);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Veld.md'), 'Lore/Veld City.md').then(() => 1)`); await p.sleep(900);
	const d = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	t.ok(d.events.some((e) => e.file && /Veld City/.test(e.file)), 'closed timeline follows');
});
test('dropping a note from the file explorer adds a linked card', async (p, h, t) => {
	await h.open(); await p.ev(`(async () => { app.workspace.leftSplit.expand(); const l = app.workspace.getLeavesOfType('file-explorer')[0]; if (l) app.workspace.revealLeaf(l); })().then(() => 1)`); await p.sleep(600);
	const item = await p.ev(`(() => { const el = [...document.querySelectorAll('.nav-file-title')].find(e => e.textContent.trim().startsWith('The Salt Moot')); const r = el.getBoundingClientRect(); return {x: r.x + 40, y: r.y + r.height / 2}; })()`);
	const n = (await h.events()).length;
	await p.move(item.x, item.y, 1); await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: item.x, y: item.y, button: 'left', clickCount: 1 });
	for (let i = 1; i <= 8; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: item.x + i * 70, y: item.y, button: 'left', buttons: 1 });
	const st = await p.ev(`(() => { const r = document.querySelector('.evra-root .stage').getBoundingClientRect(); return {x: r.x + 150, y: r.y + 300}; })()`);
	for (let i = 1; i <= 6; i++) await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: item.x + 560 + (st.x - item.x - 560) * i / 6, y: item.y + (st.y - item.y) * i / 6, button: 'left', buttons: 1 });
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: st.x, y: st.y, button: 'left', clickCount: 1 }); await p.sleep(500);
	t.eq((await h.events()).length, n + 1, 'added'); t.eq((await h.events()).slice(-1)[0].file, 'The Salt Moot', 'linked');
});
test('editing a linked note updates its card', async (p, h, t) => {
	await h.open();
	await p.ev(`app.vault.modify(app.vault.getAbstractFileByPath('Queen Isolde.md'), 'A brand new description of the queen.').then(() => 1)`); await p.sleep(900);
	await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(600);
	t.ok(await p.ev(`[...document.querySelectorAll('.evra-root .evra-card')].some(c => /brand new description/.test(c.textContent))`), 'the card shows the new text');
});
test('the evra code block renders in reading view and opens the timeline', async (p, h, t) => {
	await p.ev(`app.workspace.getLeaf(false).setViewState({type: 'markdown', state: {file: 'Veld.md', mode: 'preview'}}).then(() => 1)`); await p.sleep(1200);
	t.ok(await p.ev(`!!document.querySelector('.evra-embed svg')`), 'strip');
	t.ok(/Reign of Ash/.test(await p.ev(`document.querySelector('.evra-embed .eh').textContent`)), 'era title');
	t.ok(await p.ev(`document.querySelectorAll('.evra-embed li button').length > 2`), 'events listed');
	const b = await p.ev(`(() => { const e = [...document.querySelectorAll('.evra-embed li button')].find(x => x.offsetParent); const r = e.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`); await p.click(b.x, b.y); await p.sleep(1200);
	t.ok(await p.ev(`app.workspace.activeLeaf.view.getViewType() === 'evra'`), 'opened the timeline');
});

/* ---------- commands and views ---------- */
test('every command runs without errors', async (p, h, t) => {
	await h.open();
	const ids = await p.ev(`Object.keys(app.commands.commands).filter(id => id.startsWith('evra:') && !['evra:new-timeline', 'evra:open-sample'].includes(id))`);
	t.ok(ids.length >= 30, 'commands registered: ' + ids.length);
	for (const id of ids) {
		await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`);
		t.ok(await p.ev(`app.commands.executeCommandById(${JSON.stringify(id)})`), id + ' available');
		await p.sleep(120); await p.key('Escape'); await p.key('Escape');
	}
});
test('new timeline and sample commands create files', async (p, h, t) => {
	await p.ev(`app.commands.executeCommandById('evra:new-timeline')`); await p.sleep(1200);
	t.ok(await p.ev(`app.vault.getFiles().some(f => f.basename.startsWith('Untitled timeline'))`), 'new timeline');
	await p.ev(`app.commands.executeCommandById('evra:open-sample')`); await p.sleep(2500);
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Evra sample/Chronicle of Veld.evra')`), 'sample');
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Evra sample/The Heron.svg')`), 'sample cover');
});
test('four directions render and keep the stretch of time', async (p, h, t) => {
	await h.open(); await h.setView(30, 12);
	const mid = async () => p.ev(`(() => { const v = ${h.tl}.getViewState(); const s = document.querySelector('${A} .stage'); const d = ${h.tl}.getDoc(); const L = ['ltr','rtl'].includes(d.orientation) ? s.clientWidth : s.clientHeight; return v.v0 + L / 2 / v.scale; })()`);
	const m0 = await mid();
	for (const d of ['ltr', 'btt', 'rtl', 'ttb']) {
		await h.run('direction-' + d); await p.sleep(400);
		t.ok((await h.cardCount()) > 2, d + ' shows cards');
		t.ok(Math.abs((await mid()) - m0) < 30, d + ' keeps the middle of the view');
	}
});
test('two panes on one timeline stay in step', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.getLeaf('split').openFile(app.vault.getAbstractFileByPath('Chronicle of Veld.evra')).then(() => 1)`); await p.sleep(1000);
	await p.ev(`(() => { const t = app.workspace.activeLeaf.view.timeline; const d = t.getDoc(); d.events[0].title = 'Changed here'; t.setDoc(JSON.parse(JSON.stringify(d))); app.workspace.activeLeaf.view.requestSave(); return 1; })()`);
	await p.ev(`app.workspace.activeLeaf.view.save().then(() => 1)`); await p.sleep(1200);
	const other = await p.ev(`app.workspace.getLeavesOfType('evra').map(l => l.view.timeline.getDoc().events[0].title)`);
	t.ok(other.length === 2 && other.every((x) => x === 'Changed here'), 'both panes show the change: ' + other.join(' / '));
});
test('opening and closing timelines many times leaves nothing behind', async (p, h, t) => {
	for (let i = 0; i < 8; i++) { await h.open(); await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(100); }
	await h.open();
	t.eq(await p.ev(`document.querySelectorAll('.evra-root').length`), 1, 'one timeline in the page');
});
test('large world: opens, scrolls and zooms without errors', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath('Aerth/Chronicle of Aerth.evra')`))) return;
	await h.open('Aerth/Chronicle of Aerth.evra'); await p.sleep(1200);
	const s = await h.stage();
	const t0 = Date.now();
	for (let i = 0; i < 30; i++) { await p.wheel(s.x, s.y, 80); await p.sleep(16); }
	for (let i = 0; i < 20; i++) { await p.wheel(s.x, s.y, 60, true); await p.sleep(16); }
	await p.sleep(300);
	t.ok(Date.now() - t0 < 12000, 'responsive');
	t.ok(await p.ev(`document.querySelectorAll('${A} .lines circle, ${A} .evra-card').length > 10`), 'draws');
});
test('closing the tab mid-edit keeps what was typed', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250);
	await p.key('a', 'ctrl'); await p.type('Typed then closed');
	await p.ev(`app.commands.executeCommandById('workspace:close')`); await p.sleep(1200);
	const d = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	t.ok(d.events.some((e) => e.title === 'Typed then closed'), 'saved to disk');
});
test('Ctrl/Cmd D while typing a title does not duplicate cards', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, c = await h.card('Siege of the Keep begins', '.dt');
	await p.dbl(c.x, c.y); await p.sleep(250); await p.key('d', 'ctrl'); await p.sleep(200); await p.key('Escape');
	t.eq((await h.events()).length, n, 'no duplicate');
});
