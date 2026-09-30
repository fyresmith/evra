// QA round 2: notes integration under stress (two timelines on one note, deletes while closed, folder moves, outside edits).
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const fmOf = (p, path) => p.ev(`(() => { const f = app.vault.getAbstractFileByPath(${JSON.stringify(path)}); const c = f && app.metadataCache.getFileCache(f); return JSON.parse(JSON.stringify((c && c.frontmatter) || {})); })()`);
const syncOn = async (p, h) => { await h.openSheet('notes'); const on = await h.sheet('[data-k=syOn]'); await p.click(on.x, on.y); await p.sleep(1500); await p.key('Escape'); await p.sleep(100); };
const viewOf = (path) => `app.workspace.getLeavesOfType('evra').map(l => l.view).find(v => v.file && v.file.path === ${JSON.stringify(path)})`;
const tOf = (p, path, file) => p.ev(`(${viewOf(path)}).timeline.getDoc().events.find(e => e.file === ${JSON.stringify(file)}).t`);
/** Count writes to a file from now on. */
const countWrites = (p, path) => p.ev(`(() => { window.__w = 0; if (window.__wref) app.vault.offref(window.__wref); window.__wref = app.vault.on('modify', f => { if (f.path === ${JSON.stringify(path)}) window.__w++; }); return 1; })()`);
const writes = (p) => p.ev('window.__w');

test('R2B1 two timelines syncing one note: no tug of war, one follows a real change, writes settle', async (p, h, t) => {
	const Y = 360, other = { name: 'Other', opts: { sync: { on: true } }, events: [{ id: 'o1', t: 50 * Y, title: '', side: 'b', file: 'Treaty of Sallow' }, { id: 'o2', t: 10 * Y, title: 'Unlinked', side: 'a' }], eras: [] };
	await p.ev(`app.vault.create('Other.evra', ${JSON.stringify(JSON.stringify(other))}).then(() => 1)`);
	await h.open(); await syncOn(p, h);
	const main0 = await tOf(p, 'Chronicle of Veld.evra', 'Treaty of Sallow');
	t.eq((await fmOf(p, 'Treaty of Sallow.md'))['timeline-year'], Math.floor(main0 / Y), 'main timeline wrote its year');
	await p.ev(`app.workspace.getLeaf('split').openFile(app.vault.getAbstractFileByPath('Other.evra')).then(() => 1)`); await p.sleep(1200);
	// an edit in Other that has nothing to do with the note
	await countWrites(p, 'Treaty of Sallow.md');
	await p.ev(`(${viewOf('Other.evra')}).timeline.run('new-event')`); await p.sleep(2500);
	t.eq(await tOf(p, 'Chronicle of Veld.evra', 'Treaty of Sallow'), main0, 'an unrelated edit in Other doesn’t move the main timeline’s card');
	t.eq(await writes(p), 0, 'nor rewrite the note');
	// a real change, in the note: both follow, and the writes stop
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), m => { m['timeline-year'] = 60; }).then(() => 1)`); await p.sleep(3000);
	t.eq(Math.floor((await tOf(p, 'Chronicle of Veld.evra', 'Treaty of Sallow')) / Y), 60, 'main follows the note');
	t.eq(Math.floor((await tOf(p, 'Other.evra', 'Treaty of Sallow')) / Y), 60, 'Other follows the note');
	await countWrites(p, 'Treaty of Sallow.md'); await p.sleep(3000);
	t.eq(await writes(p), 0, 'no more writes once settled');
	// a move in Other: main follows
	await p.ev(`(() => { const v = ${viewOf('Other.evra')}; app.workspace.setActiveLeaf(v.leaf, { focus: true }); v.timeline.focusEvent('o1'); return 1; })()`); await p.sleep(900);
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y);
	await p.key('ArrowDown'); await p.sleep(2500);
	const o = await tOf(p, 'Other.evra', 'Treaty of Sallow');
	t.ok(o !== 60 * Y, 'Other moved');
	t.eq(Math.floor((await tOf(p, 'Chronicle of Veld.evra', 'Treaty of Sallow')) / 30), Math.floor(o / 30), 'main follows the move (to the month: days aren’t synced by default)');
	await countWrites(p, 'Treaty of Sallow.md'); await p.sleep(2500);
	t.eq(await writes(p), 0, 'settled again');
});

test('R2B2 a linked note deleted while the timeline is closed, then reopened', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(300);
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Treaty of Sallow.md')).then(() => 1)`); await p.sleep(300);
	await h.open();
	const e = await h.ev('Treaty of Sallow');
	t.ok(!!e && e.file === 'Treaty of Sallow', 'the card keeps its link');
	await p.ev(`${h.tl}.run('new-event')`); await p.sleep(1500);
	const saved = await h.saved();
	t.ok(!saved.opts.sync.notes.includes('Treaty of Sallow.md'), 'the deleted note leaves the synced-notes list');
	await p.ev(`app.vault.create('Treaty of Sallow.md', 'Back again.').then(() => 1)`); await p.sleep(400);
	await p.ev(`${h.tl}.run('new-event')`); await p.sleep(1500);
	t.ok((await fmOf(p, 'Treaty of Sallow.md'))['timeline-year'] != null, 'a note made again under the name is linked and synced');
});

test('R2B3 moving a folder of 40 linked notes: one write per closed timeline, links follow', async (p, h, t) => {
	const N = 40;
	await p.ev(`(async () => { await app.vault.createFolder('Many'); for (let i = 0; i < ${N}; i++) await app.vault.create('Many/Note ' + i + '.md', 'n'); return 1; })()`);
	const doc = { name: 'Many', events: Array.from({ length: N }, (_, i) => ({ id: 'm' + i, t: i * 360, title: '', side: 'a', file: i % 2 ? 'Many/Note ' + i : 'Note ' + i })), eras: [] };
	await p.ev(`app.vault.create('Many.evra', ${JSON.stringify(JSON.stringify(doc))}).then(() => 1)`);
	await p.ev(`app.vault.create('Many open.evra', ${JSON.stringify(JSON.stringify({ ...doc, name: 'Many open' }))}).then(() => 1)`);
	await h.open('Many open.evra');
	await countWrites(p, 'Many.evra');
	const t0 = await p.ev('Date.now()');
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Many'), 'Lore/Many').then(() => 1, () => app.vault.createFolder('Lore').then(() => app.fileManager.renameFile(app.vault.getAbstractFileByPath('Many'), 'Lore/Many'))).then(() => 1)`);
	await p.sleep(1500);
	t.eq(await writes(p), 1, 'the closed timeline is written once');
	const closed = JSON.parse(await p.ev(`app.vault.adapter.read('Many.evra')`));
	const bad = [];
	for (const e of closed.events) if (!(await p.ev(`(app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Many.evra') || {}).path === ${JSON.stringify('Lore/Many/')} + ${JSON.stringify(e.id.replace('m', 'Note '))} + '.md'`))) bad.push(e.file);
	t.eq(bad.join(), '', 'closed: every link points at its moved note');
	const open = await h.events(); const badO = [];
	for (const e of open) if (!(await p.ev(`(app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Many open.evra') || {}).path === ${JSON.stringify('Lore/Many/')} + ${JSON.stringify(e.id.replace('m', 'Note '))} + '.md'`))) badO.push(e.file);
	t.eq(badO.join(), '', 'open: every link points at its moved note');
	t.ok((await p.ev('Date.now()')) - t0 < 5000, 'quick');
	// undo history follows too: undoing an edit made after the move keeps the new links
	await p.ev(`${h.tl}.run('new-event')`); await p.sleep(200);
	await p.ev(`${h.tl}.undo()`); await p.sleep(200);
	t.ok((await h.events()).every((e) => !e.file || e.file.startsWith('Lore/') || !e.file.includes('/')), 'undo keeps the new links');
});

test('R2B4 the file changes on disk while the timeline has unsaved changes: both kept', async (p, h, t) => {
	await h.open();
	// an unsaved edit here: a new card (saving waits two seconds)
	const n0 = (await h.events()).length;
	await p.ev(`${h.tl}.run('new-event')`); await p.sleep(100);
	// meanwhile another editor renames a different card and saves
	await p.ev(`(async () => { const f = app.vault.getAbstractFileByPath('Chronicle of Veld.evra'); const d = JSON.parse(await app.vault.read(f)); d.events.find(e => e.title === 'Siege of the Keep begins').title = 'Siege (edited outside)'; await app.vault.modify(f, JSON.stringify(d, null, '\\t')); return 1; })()`);
	await p.sleep(800);
	const evs = await h.events();
	t.eq(evs.length, n0 + 1, 'the new card is still here');
	t.ok(evs.some((e) => e.title === 'Siege (edited outside)'), 'the outside edit shows');
	const saved = await h.saved();
	t.eq(saved.events.length, n0 + 1, 'saved with the new card');
	t.ok(saved.events.some((e) => e.title === 'Siege (edited outside)'), 'saved with the outside edit');
	// with nothing unsaved, an outside edit simply shows
	await p.ev(`(async () => { const f = app.vault.getAbstractFileByPath('Chronicle of Veld.evra'); const d = JSON.parse(await app.vault.read(f)); d.events = d.events.filter(e => e.title !== 'Siege (edited outside)'); await app.vault.modify(f, JSON.stringify(d, null, '\\t')); return 1; })()`);
	await p.sleep(800);
	t.ok(!(await h.events()).some((e) => e.title === 'Siege (edited outside)'), 'an outside delete shows');
});
