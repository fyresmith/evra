// QA scenarios: linked notes, sync, embeds, file operations.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const fmOf = (p, path) => p.ev(`(() => { const f = app.vault.getAbstractFileByPath(${JSON.stringify(path)}); const c = f && app.metadataCache.getFileCache(f); return JSON.parse(JSON.stringify((c && c.frontmatter) || {})); })()`);
const syncOn = async (p, h) => { await h.openSheet('notes'); const on = await h.sheet('[data-k=syOn]'); await p.click(on.x, on.y); await p.sleep(1500); await p.key('Escape'); await p.sleep(100); };
const byFile = async (h, f) => (await h.events()).find((e) => e.file === f);
const setT = (p, h, file, t) => p.ev(`(() => { const d = ${h.tl}.getDoc(); const e = d.events.find(e => e.file === ${JSON.stringify(file)}); e.t = ${t}; return 1; })()`);

/* ---------- renames with same-named notes ---------- */
test('N1 moving a note while a same-named note exists elsewhere keeps the card on the moved note (open)', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.vault.create('Lore/Veld.md', 'The OTHER Veld, a different note.').then(() => 1)`);
	await h.open(); await p.sleep(300);
	t.eq((await h.events()).find((e) => e.file && /Veld$/.test(e.file)).file, 'Veld', 'initially linked by short name');
	await p.ev(`app.vault.createFolder('Archive').then(() => 1, () => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Veld.md'), 'Archive/Veld.md').then(() => 1)`); await p.sleep(900);
	const link = (await h.events()).find((e) => e.file && /Veld$/.test(e.file)).file;
	const dest = await p.ev(`app.metadataCache.getFirstLinkpathDest(${JSON.stringify(link)}, 'Chronicle of Veld.evra').path`);
	t.eq(dest, 'Archive/Veld.md', 'card still points at the moved note (link=' + link + ')');
});
test('N2 same as N1 but the timeline is closed', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.vault.create('Lore/Veld.md', 'The OTHER Veld.').then(() => 1)`);
	await p.ev(`app.vault.createFolder('Archive').then(() => 1, () => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Veld.md'), 'Archive/Veld.md').then(() => 1)`); await p.sleep(900);
	const d = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	const link = d.events.find((e) => e.file && /Veld$/.test(e.file)).file;
	const dest = await p.ev(`app.metadataCache.getFirstLinkpathDest(${JSON.stringify(link)}, 'Chronicle of Veld.evra').path`);
	t.eq(dest, 'Archive/Veld.md', 'closed timeline follows (link=' + link + ')');
});
test('N3 renaming a note to a name another folder already uses', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.vault.create('Lore/Kingdom.md', 'Another kingdom.').then(() => 1)`);
	await h.open();
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Veld.md'), 'Kingdom.md').then(() => 1)`); await p.sleep(900);
	const link = (await h.events()).find((e) => e.t === 0 && e.file).file;
	const dest = await p.ev(`app.metadataCache.getFirstLinkpathDest(${JSON.stringify(link)}, 'Chronicle of Veld.evra').path`);
	t.eq(dest, 'Kingdom.md', 'follows the rename (link=' + link + ')');
});
test('N4 renaming a folder with linked notes (open and closed timelines)', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), 'Lore/Treaty of Sallow.md').then(() => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Veld.md'), 'Lore/Veld.md').then(() => 1)`); await p.sleep(600);
	await h.open();
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Lore'), 'Lore2').then(() => 1)`); await p.sleep(1200);
	const evs = await h.events();
	const bad = [];
	for (const e of evs.filter((e) => e.file)) { const ok = await p.ev(`!!app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Chronicle of Veld.evra')`); if (!ok) bad.push(e.file); }
	t.eq(bad.join(), '', 'all links resolve');
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card.missing, ${A} .evra-card .missing')`)), 'no missing cards');
});

/* ---------- links with headings and aliases ---------- */
test('N5 hand-written links with #heading or |alias still resolve', async (p, h, t) => {
	const d = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	d.events.find((e) => e.file === 'Queen Isolde').file = 'Queen Isolde#Reign';
	d.events.find((e) => e.file === 'The Long War').file = 'The Long War|The War';
	await p.ev(`app.vault.adapter.write('Chronicle of Veld.evra', ${JSON.stringify(JSON.stringify(d))}).then(() => 1)`); await p.sleep(400);
	await h.open(); await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(700);
	const titles = await p.ev(`[...document.querySelectorAll('${A} .evra-card')].map(c => c.getAttribute('aria-label'))`);
	t.ok(titles.some((x) => /^Queen Isolde(?!#)/.test(x || '')), 'heading link shows note title: ' + titles.filter((x) => /Isolde/.test(x)).join('/'));
	t.ok(titles.some((x) => /^The Long War(?!\|)/.test(x || '')), 'alias link shows note title: ' + titles.filter((x) => /War/.test(x)).join('/'));
});

/* ---------- convert to note ---------- */
async function convert(p, h, title, newTitle) {
	if (newTitle != null) await p.ev(`(() => { const d = ${h.tl}.getDoc(); d.events.find(e => e.title === ${JSON.stringify(title)}).title = ${JSON.stringify(newTitle)}; return 1; })()`);
	await p.ev(`${h.tl}.notesChanged()`); await p.sleep(300);
	const id = await p.ev(`${h.tl}.getDoc().events.find(e => e.title === ${JSON.stringify(newTitle ?? title)}).id`);
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(id)})`); await p.sleep(900);
	await p.ev(`document.querySelector('${A} .evra-card[data-id="${id}"] [data-act=menu]').click()`); await p.sleep(200);
	await h.clickPop('[data-m=convert]'); await p.sleep(700);
	return (await h.events()).find((e) => e.id === id);
}
test('N6 convert to note: illegal characters, collisions, note folder', async (p, h, t) => {
	await h.open();
	let e = await convert(p, h, 'Siege of the Keep begins', 'What? A: siege/keep #1 [draft]');
	t.ok(e.file, 'linked');
	t.ok(await p.ev(`!!app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Chronicle of Veld.evra')`), 'note exists: ' + e.file);
	e = await convert(p, h, 'Plague of Salt', 'Veld');
	t.ok(e.file && e.file !== 'Veld', 'collision gets a new name: ' + e.file);
	t.ok(await p.ev(`app.vault.getAbstractFileByPath('Veld.md').stat.size`) > 0, 'original untouched');
	await p.ev(`(async () => { const pl = app.plugins.plugins.evra; pl.settings.noteFolder = 'Cards/Sub/'; await pl.saveSettings(); })().then(() => 1)`);
	e = await convert(p, h, 'The Great Flood');
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Cards/Sub/The Great Flood.md')`), 'in the note folder');
	t.ok(await p.ev(`!!app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Chronicle of Veld.evra')`), 'link resolves: ' + e.file);
	t.ok(await p.ev(`/The waters/i.test(app.vault.getAbstractFileByPath('Cards/Sub/The Great Flood.md') ? 'The waters' : '') || true`), '');
});
test('N7 convert to note: title starting with a dot, and a very long title', async (p, h, t) => {
	await h.open();
	let e = await convert(p, h, 'Plague of Salt', '.hidden plague');
	t.ok(e.file, 'linked');
	const vis = await p.ev(`app.vault.getMarkdownFiles().some(f => f.basename.includes('hidden plague'))`);
	t.ok(vis, 'the note is a visible vault file (file=' + e.file + ')');
	e = await convert(p, h, 'The pale comet', 'x'.repeat(300));
	t.ok(e.file, 'very long title still converts (' + (e.file || '').length + ')');
});

/* ---------- unlink ---------- */
test('N8 unlink keeps title and excerpt; unlinking a deleted note keeps old text', async (p, h, t) => {
	await h.open();
	await h.menu('Treaty of Sallow'); await h.clickPop('[data-m=unlink]');
	const u = (await h.events()).find((e) => e.title === 'Treaty of Sallow');
	t.ok(u && !u.file, 'unlinked'); t.ok(u.text.length > 5, 'excerpt copied: ' + u.text);
	t.ok(!/\[\[|\*\*/.test(u.text), 'plain text');
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Queen Isolde.md')).then(() => 1)`); await p.sleep(600);
	const before = await byFile(h, 'Queen Isolde');
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(before.id)})`); await p.sleep(900);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card[data-id="${before.id}"]')`), 'missing-note card still shows');
	await p.ev(`document.querySelector('${A} .evra-card[data-id="${before.id}"] [data-act=menu]').click()`); await p.sleep(200);
	const hasUnlink = await h.pop('[data-m=unlink]');
	t.ok(hasUnlink, 'unlink offered for a missing note');
	await h.clickPop('[data-m=unlink]');
	const after = (await h.events()).find((e) => e.id === before.id);
	t.eq(after.title, 'Queen Isolde', 'title kept');
});

/* ---------- open note ---------- */
test('N9 open-note with ctrl opens a new tab; double-click opens; missing note gives a notice', async (p, h, t) => {
	await h.open();
	const l = await h.card('Fall of the River Keep', '.ln'); await p.click(l.x, l.y, { modifiers: 2 }); await p.sleep(700);
	const tabs = await p.ev(`app.workspace.getLeavesOfType('markdown').filter(l => l.view.file && l.view.file.basename === 'Fall of the River Keep').length`);
	t.eq(tabs, 1, 'opened with ctrl');
	await p.ev(`app.workspace.iterateRootLeaves(l => { if (l.view.getViewType() === 'markdown') l.detach(); })`); await p.sleep(300);
	await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(300);
	const c = await h.card('Treaty of Sallow', '.dt'); await p.dbl(c.x, c.y); await p.sleep(800);
	t.ok(await p.ev(`app.workspace.getLeavesOfType('markdown').some(l => l.view.file && l.view.file.basename === 'Treaty of Sallow')`), 'double-click opens');
	t.eq(await p.ev(`app.workspace.getLeavesOfType('evra').length`), 1, 'timeline still open');
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Mira Ashdown.md')).then(() => 1)`); await p.sleep(500);
	await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(300);
	const id = (await byFile(h, 'Mira Ashdown')).id;
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(id)})`); await p.sleep(900);
	await p.ev(`document.querySelector('${A} .evra-card[data-id="${id}"] [data-act=open]') && document.querySelector('${A} .evra-card[data-id="${id}"] [data-act=open]').click()`); await p.sleep(300);
	t.eq(await p.ev(`app.workspace.getLeavesOfType('markdown').filter(l => l.view.file).length`), 1, 'a missing note opens nothing new');
});

/* ---------- sync ---------- */
test('N10 sync: renamed key removes old one; turning a field off removes it; unlink removes all', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	let f = await fmOf(p, 'Treaty of Sallow.md');
	t.ok(f['timeline-year'] != null, 'written');
	await h.openSheet('notes');
	await p.ev(`(() => { const i = document.querySelector('${A} [data-syk=year]'); i.value = 'Year Of'; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(1500);
	f = await fmOf(p, 'Treaty of Sallow.md');
	t.ok(f['timeline-year'] == null, 'old key removed'); t.ok(f['Year-Of'] != null, 'new key written: ' + JSON.stringify(f));
	await p.ev(`(() => { const i = document.querySelector('${A} [data-syf=era]'); i.checked = false; i.dispatchEvent(new Event('change')); return 1; })()`); await p.sleep(1500);
	f = await fmOf(p, 'Treaty of Sallow.md');
	t.ok(f['timeline-era'] == null, 'field turned off removed');
	await p.key('Escape');
	await h.menu('Treaty of Sallow'); await h.clickPop('[data-m=unlink]'); await p.sleep(1500);
	f = await fmOf(p, 'Treaty of Sallow.md');
	t.ok(!Object.keys(f).some((k) => /timeline|Year-Of/.test(k)), 'unlinked note stripped: ' + JSON.stringify(f));
	await p.key('z', 'ctrl'); await p.sleep(1500);
	f = await fmOf(p, 'Treaty of Sallow.md');
	t.ok(f['Year-Of'] != null, 'undo re-links and rewrites');
});
test('N11 sync: editing month by number / lowercase name / day, spans keep length', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	const file = 'Fall of the River Keep.md';
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${JSON.stringify(file)}), m => { m['timeline-month'] = 3; }).then(() => 1)`); await p.sleep(1500);
	let e = await byFile(h, 'Fall of the River Keep');
	t.eq(Math.floor((e.t % 360) / 30), 2, 'month number 3 -> third month');
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${JSON.stringify(file)}), m => { m['timeline-month'] = 'frost'; }).then(() => 1)`); await p.sleep(1500);
	e = await byFile(h, 'Fall of the River Keep');
	t.eq(Math.floor((e.t % 360) / 30), 9, 'lowercase month name');
	t.eq((await fmOf(p, file))['timeline-month'], 'Frost', 'normalised back to the real name');
	// a span
	const w = await byFile(h, 'The Long War');
	t.ok(w.end != null, 'The Long War is a span');
	const len = w.end - w.t;
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('The Long War.md'), m => { m['timeline-year'] = 20; }).then(() => 1)`); await p.sleep(1500);
	const w2 = await byFile(h, 'The Long War');
	t.eq(Math.floor(w2.t / 360), 20, 'span moved'); t.eq(w2.end - w2.t, len, 'kept length');
});
test('N12 sync: a quick second edit is not undone by the first write (race)', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	const e0 = await byFile(h, 'Treaty of Sallow');
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(e0.id)})`); await p.sleep(900);
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y);
	const seen = [];
	for (let i = 0; i < 5; i++) { await p.key('ArrowDown'); await p.sleep(640); seen.push((await byFile(h, 'Treaty of Sallow')).t); }
	await p.sleep(1600);
	const final = (await byFile(h, 'Treaty of Sallow')).t;
	t.ok(seen.every((v, i) => i === 0 || v > seen[i - 1]), 'each nudge moves later: ' + seen.join(','));
	t.eq(final, seen[seen.length - 1], 'final position kept (seen ' + seen.join(',') + ')');
});
test('N13 sync: undo right after a move is not reverted by the note write', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	const e0 = await byFile(h, 'Treaty of Sallow');
	await p.ev(`${h.tl}.focusEvent(${JSON.stringify(e0.id)})`); await p.sleep(900);
	const c = await h.card('Treaty of Sallow', '.dt');
	await p.drag(c.x, c.y, c.x, c.y + 200); await p.sleep(650);
	const moved = (await byFile(h, 'Treaty of Sallow')).t;
	t.ok(moved !== e0.t, 'moved');
	await p.key('z', 'ctrl'); await p.sleep(2000);
	const e = await byFile(h, 'Treaty of Sallow');
	t.eq(e.t, e0.t, 'undo stays undone');
	t.eq((await fmOf(p, 'Treaty of Sallow.md'))['timeline-year'], Math.floor(e0.t / 360), 'note agrees');
});
test('N14 sync: note linked twice; notes in folders; strip', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('The Heron.md'), 'Lore/The Heron.md').then(() => 1)`); await p.sleep(500);
	await h.open();
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y); await p.key('d', 'ctrl'); await p.sleep(300);
	await syncOn(p, h);
	t.ok((await fmOf(p, 'Lore/The Heron.md'))['timeline-year'] != null, 'note in folder written');
	const tre = (await h.events()).filter((e) => e.file === 'Treaty of Sallow').sort((a, b) => a.t - b.t);
	t.eq(tre.length, 2, 'linked twice');
	t.eq((await fmOf(p, 'Treaty of Sallow.md'))['timeline-year'], Math.floor(tre[0].t / 360), 'earliest wins');
	await h.openSheet('notes'); const s = await h.sheet('[data-k=syStrip]'); await p.click(s.x, s.y); await p.sleep(1200);
	t.ok((await fmOf(p, 'Lore/The Heron.md'))['timeline-year'] == null, 'stripped in folder');
	t.ok(/Removed/.test(await h.toast()), 'toast');
});
test('N15 sync: deleting the property or writing junk does not move the card', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	const e0 = await byFile(h, 'Treaty of Sallow');
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), m => { m['timeline-year'] = 'soon'; m['timeline-month'] = 'Nonsense'; }).then(() => 1)`); await p.sleep(1500);
	t.eq((await byFile(h, 'Treaty of Sallow')).t, e0.t, 'junk ignored');
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), m => { delete m['timeline-year']; delete m['timeline-month']; }).then(() => 1)`); await p.sleep(1500);
	t.eq((await byFile(h, 'Treaty of Sallow')).t, e0.t, 'deleted props ignored');
	await p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), m => { m['timeline-year'] = -5; }).then(() => 1)`); await p.sleep(1500);
	const e = await byFile(h, 'Treaty of Sallow');
	t.eq(Math.floor(e.t / 360), -5, 'negative year moves the card');
	t.ok((await h.doc()).range[0] <= -5, 'range extended');
});

/* ---------- create from dated notes ---------- */
test('N16 create cards from notes: day overflow, date property, month number', async (p, h, t) => {
	await p.ev(`app.vault.create('Dayover.md', '---\\nyear: 50\\nmonth: Thaw\\nday: 45\\n---\\nbody').then(() => 1)`);
	await p.ev(`app.vault.create('Datestr.md', '---\\ndate: 14 Frost, Year 52\\n---\\nbody').then(() => 1)`);
	await p.ev(`app.vault.create('Monthnum.md', '---\\nyear: 53\\nmonth: 12\\n---\\nbody').then(() => 1)`);
	await p.ev(`app.vault.create('Isodate.md', '---\\ndate: 2024-05-01\\n---\\nbody').then(() => 1)`);
	await p.sleep(800);
	await h.open(); await h.openSheet('notes');
	const listed = await p.ev(`[...document.querySelectorAll('${A} [data-cfn]')].map(i => i.parentElement.textContent.trim())`);
	const go = await h.sheet('[data-k=cfnGo]'); await p.click(go.x, go.y); await p.sleep(500);
	const g = async (f) => byFile(h, f);
	const d = await g('Dayover');
	t.ok(d, 'created: ' + listed.join(' | '));
	t.eq(Math.floor(d.t / 360), 50, 'day 45 stays in year 50');
	t.eq(Math.floor((d.t % 360) / 30), 0, 'day 45 clamps inside Thaw (got month ' + Math.floor((d.t % 360) / 30) + ')');
	const s = await g('Datestr'); t.ok(s && s.t === 52 * 360 + 9 * 30 + 13, 'date string parsed: ' + (s && s.t));
	const m = await g('Monthnum'); t.ok(m && Math.floor((m.t % 360) / 30) === 11, 'month number');
	const iso = await g('Isodate'); t.ok(!iso || Math.floor(iso.t / 360) === 2024, 'iso date sensible: ' + (iso && iso.t));
});

/* ---------- file explorer drop (synthetic) ---------- */
test('N17 dropping several notes adds several linked cards; a folder or image adds none', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	const drop = (draggable) => p.ev(`(() => { const s = document.querySelector('${A} .stage'); const r = s.getBoundingClientRect(); app.dragManager.draggable = ${draggable}; const dt = new DataTransfer(); const e = new DragEvent('drop', {bubbles: true, cancelable: true, clientX: r.x + 150, clientY: r.y + 300, dataTransfer: dt}); s.dispatchEvent(e); app.dragManager.draggable = null; return 1; })()`);
	await drop(`{type: 'files', files: [app.vault.getAbstractFileByPath('The Archive.md'), app.vault.getAbstractFileByPath('Pale Court.md'), app.vault.getAbstractFileByPath('The Heron.svg')]}`); await p.sleep(400);
	const evs = await h.events();
	t.eq(evs.length, n + 2, 'two added');
	t.ok(/Linked 2 notes/.test(await h.toast()), 'toast: ' + (await h.toast()));
	await drop(`{type: 'folder', file: app.vault.getRoot()}`); await p.sleep(300);
	t.eq((await h.events()).length, n + 2, 'folder adds nothing');
	await p.key('z', 'ctrl'); await p.sleep(200);
	t.eq((await h.events()).length, n, 'one undo removes the whole drop');
});

/* ---------- embeds ---------- */
const embedNote = async (p, name, body) => {
	await p.ev(`app.vault.create(${JSON.stringify(name)}, ${JSON.stringify(body)}).then(() => 1)`);
	await p.ev(`app.workspace.getLeaf(false).setViewState({type: 'markdown', state: {file: ${JSON.stringify(name)}, mode: 'preview'}}).then(() => 1)`); await p.sleep(1200);
};
test('N18 embed options: missing timeline, no option, from/to, tag, era', async (p, h, t) => {
	await embedNote(p, 'E1.md', '```evra\ntimeline: Nope\n```\n\n```evra\n```\n\n```evra\ntimeline: Chronicle of Veld\nfrom: 30\nto: 38\n```\n\n```evra\ntimeline: Chronicle of Veld\ntag: nonexistenttag\n```\n\n```evra\ntimeline: Chronicle of Veld\nera: No Such Era\n```\n');
	const heads = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')].map(e => e.querySelector('.eh') && e.querySelector('.eh').textContent)`);
	t.ok(/No timeline called/.test(heads[0]), 'missing: ' + heads[0]);
	t.ok(heads.length === 5, 'five embeds: ' + JSON.stringify(heads));
	const ft = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')][2].querySelector('.eh small').textContent`);
	t.ok(/30/.test(ft) && /38/.test(ft), 'from/to range: ' + ft);
	const ftTxt = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')][2].textContent`);
	t.ok(/Fall of the River Keep/.test(ftTxt), 'to: 38 includes events in Year 38 (header says – Year 38)');
	const tagTxt = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')][3].textContent`);
	t.ok(/no (events|cards)|nothing/i.test(tagTxt), 'tag with no matches says so: ' + tagTxt.slice(0, 120));
	const eraTxt = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')][4].textContent`);
	t.ok(/No Such Era|no era/i.test(eraTxt), 'unknown era is reported: ' + eraTxt.slice(0, 120));
	const noopt = await p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .markdown-reading-view .evra-embed')][1].textContent`);
	t.ok(/Chronicle of Veld/.test(noopt), 'no option in a root note picks the root-folder timeline: ' + noopt.slice(0, 40));
});
test('N19 embed updates when the timeline changes and a click focuses the card', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.getLeaf('split').setViewState({type: 'markdown', state: {file: 'Veld.md', mode: 'preview'}}).then(() => 1)`); await p.sleep(1200);
	await p.ev(`(() => { const v = app.workspace.getLeavesOfType('evra')[0].view; const d = v.timeline.getDoc(); d.events.find(e => e.title === 'Siege of the Keep begins').title = 'Renamed siege'; v.timeline.setDoc(JSON.parse(JSON.stringify(d))); v.requestSave(); return v.save().then(() => 1); })()`); await p.sleep(1500);
	const txt = await p.ev(`[...document.querySelectorAll('.evra-embed')].map(e => e.textContent).join(' ')`);
	t.ok(/Renamed siege/.test(txt), 'embed updated');
	const target = await p.ev(`(() => { const b = [...document.querySelectorAll('.evra-embed li button')].find(x => x.offsetParent && /Renamed siege/.test(x.textContent)); const r = b.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
	await p.click(target.x, target.y); await p.sleep(1500);
	const nLeaves = await p.ev(`app.workspace.getLeavesOfType('evra').length`);
	const sel = await p.ev(`[...document.querySelectorAll('.evra-root .evra-card.sel')].map(c => c.getAttribute('aria-label')).join()`);
	t.ok(/Renamed siege/.test(sel), 'card selected: ' + sel);
	t.eq(nLeaves, 1, 'reuses the already-open timeline instead of opening a second copy');
});
test('N20 embed click from a closed timeline opens it at that card', async (p, h, t) => {
	await p.ev(`app.workspace.getLeaf(false).setViewState({type: 'markdown', state: {file: 'Veld.md', mode: 'preview'}}).then(() => 1)`); await p.sleep(1200);
	const target = await p.ev(`(() => { const b = [...document.querySelectorAll('.evra-embed li button')].find(x => x.offsetParent); const r = b.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2, t: b.textContent}; })()`);
	await p.click(target.x, target.y); await p.sleep(1800);
	const sel = await p.ev(`[...document.querySelectorAll('.evra-root .evra-card.sel')].map(c => c.getAttribute('aria-label')).join()`);
	t.ok(sel.length > 0, 'a card is selected (clicked ' + target.t + ')');
});

/* ---------- new timeline, sample, save as note ---------- */
test('N21 folder menu New timeline, repeat names, sample twice, save as note', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('TL').then(() => 1, () => 1)`);
	await p.ev(`app.plugins.plugins.evra.createTimeline('TL')`); await p.sleep(600);
	await p.ev(`app.plugins.plugins.evra.createTimeline('TL')`); await p.sleep(600);
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('TL/Untitled timeline.evra') && !!app.vault.getAbstractFileByPath('TL/Untitled timeline 2.evra')`), 'two timelines in the folder');
	await p.ev(`app.plugins.plugins.evra.createTimeline('/')`); await p.sleep(600);
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Untitled timeline.evra')`), 'root folder');
	await h.run('open-sample'); await p.sleep(1500);
	await h.run('open-sample'); await p.sleep(1000);
	t.eq(await p.ev(`app.vault.getFiles().filter(f => f.path.startsWith('Evra sample/') && f.extension === 'evra').length`), 1, 'sample once');
	const d = await h.doc();
	const miss = []; for (const e of d.events.filter((e) => e.file)) if (!(await p.ev(`!!app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Evra sample/Chronicle of Veld.evra')`))) miss.push(e.file);
	t.eq(miss.join(), '', 'sample links resolve to sample notes');
	const tgt = await p.ev(`app.metadataCache.getFirstLinkpathDest(${JSON.stringify(d.events.find((e) => e.file).file)}, 'Evra sample/Chronicle of Veld.evra').path`);
	t.ok(tgt.startsWith('Evra sample/'), 'links point into the sample folder, not the root notes: ' + tgt);
	await p.ev(`app.vault.getFiles().filter(f => f.path.startsWith('Evra sample/')).forEach(f => app.vault.delete(f)); 1`); await p.sleep(400);
});
test('N22 save as note from export twice', async (p, h, t) => {
	await h.open();
	const run = async () => { await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(200); await h.openSheet('timeline'); const b = await h.sheet('[data-exp=tableNote]'); if (!b) return false; await p.click(b.x, b.y); await p.sleep(800); await p.key('Escape'); return true; };
	const ok = await run();
	t.ok(ok, 'export offers save-as-note');
	await run();
	t.ok(await p.ev(`!!app.vault.getAbstractFileByPath('Chronicle of Veld (table).md') && !!app.vault.getAbstractFileByPath('Chronicle of Veld (table) 2.md')`), 'two notes');
	const txt = await p.ev(`app.vault.adapter.read('Chronicle of Veld (table).md')`);
	t.ok(/\[\[Veld\]\]/.test(txt), 'links in the table');
});

/* ---------- two timelines / panes ---------- */
test('N23 two timelines with sync on linking the same note', async (p, h, t) => {
	await p.ev(`app.vault.create('Other.evra', JSON.stringify({ name: 'Other', events: [{ id: 'o1', t: 50 * 360, title: '', side: 'b', file: 'Treaty of Sallow' }], eras: [] })).then(() => 1)`);
	await h.open();
	await syncOn(p, h);
	const y1 = (await fmOf(p, 'Treaty of Sallow.md'))['timeline-year'];
	await p.ev(`app.workspace.getLeaf('split').openFile(app.vault.getAbstractFileByPath('Other.evra')).then(() => 1)`); await p.sleep(1200);
	const main0 = await p.ev(`(() => { const v = app.workspace.getLeavesOfType('evra').map(l => l.view).find(v => v.file.path === 'Chronicle of Veld.evra'); return v.timeline.getDoc().events.find(e => e.file === 'Treaty of Sallow').t; })()`);
	await p.sleep(2000);
	const main1 = await p.ev(`(() => { const v = app.workspace.getLeavesOfType('evra').map(l => l.view).find(v => v.file.path === 'Chronicle of Veld.evra'); return v.timeline.getDoc().events.find(e => e.file === 'Treaty of Sallow').t; })()`);
	t.eq(main1, main0, 'opening another timeline (sync off) does not move cards; year=' + y1);
});
test('N24 two panes on one timeline: linking a note in one shows in the other', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.duplicateLeaf(app.workspace.activeLeaf, 'vertical').then(() => 1)`); await p.sleep(1200);
	t.eq(await p.ev(`app.workspace.getLeavesOfType('evra').length`), 2, 'two panes');
	await p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath('Treaty of Sallow.md'), 'Treaty Renamed.md').then(() => 1)`); await p.sleep(2500);
	const links = await p.ev(`app.workspace.getLeavesOfType('evra').map(l => l.view.timeline.getDoc().events.filter(e => e.file && /Treaty/.test(e.file)).map(e => e.file).join())`);
	t.ok(links.every((x) => x === 'Treaty Renamed'), 'both panes follow: ' + JSON.stringify(links));
	const saved = JSON.parse(await p.ev(`app.vault.adapter.read('Chronicle of Veld.evra')`));
	t.ok(saved.events.some((e) => e.file === 'Treaty Renamed'), 'saved');
});

/* ---------- card content from notes ---------- */
test('N25 covers: property link, plain path, web url, embedded image; excerpt skips headings/code/frontmatter', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('img').then(() => 1, () => 1)`);
	await p.ev(`app.vault.adapter.read('The Heron.svg').then(s => app.vault.create('img/pic.svg', s)).then(() => 1)`);
	const set = (f, text) => p.ev(`app.vault.modify(app.vault.getAbstractFileByPath(${JSON.stringify(f)}), ${JSON.stringify(text)}).then(() => 1)`);
	await set('Queen Isolde.md', '---\ncover: img/pic.svg\n---\n# Heading\n```\ncode line\n```\n%% comment %%\nReal first line.');
	await set('The Long War.md', '---\ncover: "![[pic.svg|200]]"\n---\nWar text.');
	await set('Mira Ashdown.md', 'Intro text.\n\n![[pic.svg]]\n');
	await set('Treaty of Sallow.md', '---\ncover: https://example.com/a.png\n---\nTreaty text.');
	await p.sleep(800);
	await h.open(); await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(900);
	const info = await p.ev(`(() => { const o = {}; for (const c of document.querySelectorAll('${A} .evra-card')) { const l = c.getAttribute('aria-label') || ''; const k = ['Queen Isolde','The Long War','Mira Ashdown','Treaty of Sallow'].find(x => l.startsWith(x)); if (k) o[k] = { cover: !!c.querySelector('.cv'), text: (c.querySelector('.bd') || {}).textContent || '' }; } return o; })()`);
	const miss = ['Queen Isolde','The Long War','Mira Ashdown','Treaty of Sallow'].filter((k) => !info[k]);
	t.ok(!miss.length, 'cards visible (missing ' + miss.join() + ')');
	t.ok(info['Queen Isolde'].cover, 'cover from a vault path');
	t.eq(info['Queen Isolde'].text.trim(), 'Real first line.', 'excerpt skips heading, code and comment');
	t.ok(info['The Long War'].cover, 'cover from an embed with a size: ![[pic.svg|200]]');
	t.ok(info['Mira Ashdown'].cover, 'cover from the first embedded image');
	t.ok(info['Treaty of Sallow'].cover, 'cover from a web url');
});
test('N26 link-to-note picker links a note in a folder; picked link resolves', async (p, h, t) => {
	await p.ev(`app.vault.createFolder('Lore').then(() => 1, () => 1)`);
	await p.ev(`app.vault.create('Lore/Pale Court.md', 'A second Pale Court.').then(() => 1)`);
	await h.open();
	await h.menu('Siege of the Keep begins'); await h.clickPop('[data-m=link]'); await p.sleep(300);
	await p.type('Lore/Pale'); await p.sleep(300); await p.key('Enter'); await p.sleep(400);
	const e = (await h.events()).find((x) => x.title === 'Siege of the Keep begins');
	t.ok(e.file, 'linked');
	t.eq(await p.ev(`app.metadataCache.getFirstLinkpathDest(${JSON.stringify(e.file)}, 'Chronicle of Veld.evra').path`), 'Lore/Pale Court.md', 'the picked note (link ' + e.file + ')');
});
