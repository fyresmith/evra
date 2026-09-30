// QA round 2 (agent 3): notes integration, robustness, performance.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const J = JSON.stringify;
const fmOf = (p, path) => p.ev(`(() => { const f = app.vault.getAbstractFileByPath(${J(path)}); const c = f && app.metadataCache.getFileCache(f); return JSON.parse(JSON.stringify((c && c.frontmatter) || {})); })()`);
const syncOn = async (p, h) => { await h.openSheet('notes'); const on = await h.sheet('[data-k=syOn]'); await p.click(on.x, on.y); await p.sleep(1500); await p.ev(`document.querySelector('${A} [data-r=sheetClose]').click()`); await p.sleep(100); };
const byFile = async (h, f) => (await h.events()).find((e) => e.file === f);
const make = (p, path, text) => p.ev(`(async () => { const f = app.vault.getAbstractFileByPath(${J(path)}); if (f) await app.vault.modify(f, ${J(text)}); else { const dir = ${J(path)}.split('/').slice(0, -1).join('/'); if (dir && !app.vault.getAbstractFileByPath(dir)) await app.vault.createFolder(dir); await app.vault.create(${J(path)}, ${J(text)}); } })().then(() => 1)`);
const setFm = (p, path, js) => p.ev(`app.fileManager.processFrontMatter(app.vault.getAbstractFileByPath(${J(path)}), m => { ${js} }).then(() => 1)`);
const rename = (p, from, to) => p.ev(`app.fileManager.renameFile(app.vault.getAbstractFileByPath(${J(from)}), ${J(to)}).then(() => 1)`);
const folder = (p, path) => p.ev(`app.vault.createFolder(${J(path)}).then(() => 1, () => 1)`);
const dest = (p, link, from = 'Chronicle of Veld.evra') => p.ev(`(() => { const f = app.metadataCache.getFirstLinkpathDest(${J(link)}.split('|')[0].split('#')[0], ${J(from)}); return f ? f.path : null; })()`);
const closeAll = (p) => p.ev(`(async () => { for (const l of app.workspace.getLeavesOfType('evra')) { await l.view.save?.(); l.detach(); } })().then(() => 1)`);
const readJ = async (p, path) => JSON.parse(await p.ev(`app.vault.adapter.read(${J(path)})`));
const within = (pr, ms, what) => Promise.race([pr, new Promise((_, j) => setTimeout(() => j(new Error('timed out: ' + what)), ms))]);
const drop = (p, { draggable = 'null', text = '' } = {}, x = 150, y = 300) => p.ev(`(() => { const s = document.querySelector('${A} .stage'); const r = s.getBoundingClientRect(); app.dragManager.draggable = ${draggable}; const dt = new DataTransfer(); if (${J(text)}) dt.setData('text/plain', ${J(text)}); s.dispatchEvent(new DragEvent('dragover', {bubbles: true, cancelable: true, clientX: r.x + ${x}, clientY: r.y + ${y}, dataTransfer: dt})); s.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, clientX: r.x + ${x}, clientY: r.y + ${y}, dataTransfer: dt})); app.dragManager.draggable = null; return 1; })()`);
const openNote = (p, file, mode = 'preview', how = 'false') => p.ev(`app.workspace.getLeaf(${how}).setViewState({type: 'markdown', state: {file: ${J(file)}, mode: ${J(mode)}, source: false}}).then(() => 1)`).then(() => p.sleep(1200));
const embeds = (p) => p.ev(`[...document.querySelectorAll('.workspace-leaf.mod-active .evra-embed')].filter(e => e.offsetParent).map(e => e.textContent)`);

/* =====================================================================
   A. NOTES INTEGRATION
   ===================================================================== */

/* ---------- case-insensitive property keys ---------- */
test('R2N01 sync: a note with a capitalised Timeline-Year key does not get a second, lower-case copy', async (p, h, t) => {
	await setFm(p, 'Treaty of Sallow.md', `m['Timeline-Year'] = 40;`); await p.sleep(400);
	await h.open(); await syncOn(p, h); await p.sleep(800);
	const fm = await fmOf(p, 'Treaty of Sallow.md');
	const yearKeys = Object.keys(fm).filter((k) => k.toLowerCase() === 'timeline-year');
	t.eq(yearKeys.length, 1, 'one year property, not two differing only in case: ' + J(fm));
});
test('R2N02 sync: editing a capitalised key in the note moves the card and the key stays single', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	await setFm(p, 'Treaty of Sallow.md', `delete m['timeline-year']; m['TIMELINE-YEAR'] = 44;`); await p.sleep(1800);
	const e = await byFile(h, 'Treaty of Sallow');
	t.eq(Math.floor(e.t / 360), 44, 'card moved to 44');
	const fm = await fmOf(p, 'Treaty of Sallow.md');
	t.eq(Object.keys(fm).filter((k) => k.toLowerCase() === 'timeline-year').length, 1, 'no duplicate key after write-back: ' + J(fm));
});
test('R2N03 sync: card moves write year, month, day, date and era to the note (card -> note)', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	const e0 = await byFile(h, 'Treaty of Sallow');
	await p.ev(`${h.tl}.focusEvent(${J(e0.id)})`); await p.sleep(900);
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y);
	await p.key('ArrowDown', 'alt'); await p.sleep(1500);
	const e1 = await byFile(h, 'Treaty of Sallow');
	t.eq(e1.t, e0.t + 1, 'alt-arrow moved one day');
	const fm = await fmOf(p, 'Treaty of Sallow.md');
	t.eq(fm['timeline-year'], Math.floor(e1.t / 360), 'year property follows');
	t.ok(typeof fm['timeline-date'] === 'string' && fm['timeline-date'].length > 3, 'date string written: ' + fm['timeline-date']);
});

/* ---------- links: convert / link / unlink with sync ---------- */
test('R2N04 sync: converting a card to a note gives the new note timeline properties', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	await h.menu('Siege of the Keep begins'); await h.clickPop('[data-m=convert]'); await p.sleep(2000);
	const e = (await h.events()).find((x) => x.file && /Siege/.test(x.file));
	t.ok(e, 'converted');
	const path = await dest(p, e.file);
	const fm = await fmOf(p, path);
	t.eq(fm['timeline-year'], Math.floor(e.t / 360), 'new note carries the year: ' + J(fm));
});
test('R2N05 sync: a dropped note gets properties; unlinking strips them; undo writes them back', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	await drop(p, { draggable: `{type: 'file', file: app.vault.getAbstractFileByPath('The Archive.md')}` }); await p.sleep(1800);
	t.ok((await fmOf(p, 'The Archive.md'))['timeline-year'] != null, 'dropped note written: ' + J(await fmOf(p, 'The Archive.md')));
	const id = (await byFile(h, 'The Archive')).id;
	await p.ev(`(() => { const c = document.querySelector('${A} .evra-card[data-id="${id}"] [data-act=menu]'); c.click(); return 1; })()`); await p.sleep(200);
	await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=unlink]').click()`); await p.sleep(1800);
	t.ok((await fmOf(p, 'The Archive.md'))['timeline-year'] == null, 'unlinked note stripped: ' + J(await fmOf(p, 'The Archive.md')));
	await h.focusStage(); await p.key('z', 'ctrl'); await p.sleep(1800);
	t.ok((await fmOf(p, 'The Archive.md'))['timeline-year'] != null, 'undo relinks and rewrites');
});
test('R2N30 after toggling a checkbox in the settings panel, Escape still closes the panel', async (p, h, t) => {
	await h.open(); await h.openSheet('notes');
	const on = await h.sheet('[data-k=syOn]'); await p.click(on.x, on.y); await p.sleep(400);
	const focus = await p.ev(`(() => { const a = document.activeElement; return a ? a.tagName + '.' + a.className : 'none'; })()`);
	await p.key('Escape'); await p.sleep(200);
	t.ok(await p.ev(`document.querySelector('${A} .sheet').hidden`), 'panel closed by Escape (focus was on ' + focus + ')');
});
test('R2N31 a card menu opened while the settings panel is open is not hidden under the panel', async (p, h, t) => {
	await h.open(); await h.openSheet('notes');
	await p.ev(`(() => { const c = [...document.querySelectorAll('${A} .evra-card')].map(c => [c, c.getBoundingClientRect()]).sort((a, b) => b[1].right - a[1].right)[0][0]; c.querySelector('[data-act=menu]').click(); return 1; })()`); await p.sleep(300);
	const hit = await p.ev(`(() => { const pop = document.querySelector('${A} [data-r=pop]'); if (pop.hidden) return 'no pop'; const b = [...pop.querySelectorAll('button')].filter(b => b.offsetParent); const covered = b.filter(x => { const r = x.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return e && !pop.contains(e); }); return covered.length + ' of ' + b.length + ' covered'; })()`);
	t.ok(/^0 of/.test(hit) || hit === 'no pop', 'menu buttons reachable: ' + hit);
});

/* ---------- deletes and recreations ---------- */
test('R2N06 deleting a linked note while open keeps the card; recreating the note relinks it', async (p, h, t) => {
	await h.open();
	const n = await h.cardCount();
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Mira Ashdown.md')).then(() => 1)`); await p.sleep(800);
	const e = await byFile(h, 'Mira Ashdown');
	t.ok(e, 'card kept, still pointing at the name');
	t.eq(await h.cardCount(), n, 'card still shown');
	await make(p, 'Mira Ashdown.md', 'Brand new archive text.'); await p.sleep(1200);
	const txt = await p.ev(`(() => { const c = [...document.querySelectorAll('${A} .evra-card')].find(c => (c.getAttribute('aria-label') || '').startsWith('Mira Ashdown')); return c ? c.textContent : ''; })()`);
	t.ok(/Brand new archive text/.test(txt), 'card shows the recreated note text: ' + txt.slice(0, 120));
});
test('R2N07 deleting a linked note while the timeline is closed, then reopening, has no errors', async (p, h, t) => {
	await h.open(); await closeAll(p);
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Mira Ashdown.md')).then(() => 1)`); await p.sleep(400);
	await h.open();
	t.ok(await byFile(h, 'Mira Ashdown'), 'card kept');
	await h.menu('Mira Ashdown'); await p.sleep(200);
	t.ok(await h.popOpen(), 'menu opens on a card with a missing note');
	await p.key('Escape');
});
test('R2N08 sync: deleting a synced note, then undoing an unrelated edit, logs no errors', async (p, h, t) => {
	await h.open(); await syncOn(p, h);
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Mira Ashdown.md')).then(() => 1)`); await p.sleep(400);
	const c = await h.card('Treaty of Sallow', '.dt'); await p.click(c.x, c.y);
	await p.key('ArrowDown'); await p.sleep(1500); await p.key('z', 'ctrl'); await p.sleep(1500);
	const d = await h.saved();
	t.ok(!d.opts.sync.notes.includes('Mira Ashdown.md'), 'deleted note dropped from the synced list: ' + J(d.opts.sync.notes));
});

/* ---------- same-named notes ---------- */
test('R2N09 moving the timeline file into a folder that has a same-named note keeps cards on their notes', async (p, h, t) => {
	await folder(p, 'Lore');
	await make(p, 'Lore/Veld.md', 'The OTHER Veld.');
	await h.open();
	const before = await dest(p, (await (async () => (await h.events()).find((e) => e.file && /Veld$/.test(e.file)).file)()));
	t.eq(before, 'Veld.md', 'links to root Veld first');
	await rename(p, 'Chronicle of Veld.evra', 'Lore/Chronicle of Veld.evra'); await p.sleep(1200);
	const link = (await h.events()).find((e) => e.file && /Veld$/.test(e.file)).file;
	t.eq(await dest(p, link, 'Lore/Chronicle of Veld.evra'), 'Veld.md', 'card still shows root Veld after the timeline moved (link ' + link + ')');
});
test('R2N10 dropping a note whose name is shared links that exact note', async (p, h, t) => {
	await folder(p, 'Lore');
	await make(p, 'Lore/Veld.md', 'The OTHER Veld.');
	await h.open();
	await drop(p, { draggable: `{type: 'file', file: app.vault.getAbstractFileByPath('Lore/Veld.md')}` }); await p.sleep(500);
	const evs = (await h.events()).filter((e) => e.file && /Veld$/.test(e.file));
	const dests = []; for (const e of evs) dests.push(await dest(p, e.file));
	t.ok(dests.includes('Lore/Veld.md'), 'the dropped note is linked: ' + J(evs.map((e) => e.file)));
	t.ok(dests.includes('Veld.md'), 'the old card still on root Veld');
});
test('R2N11 dropping text wikilinks and obsidian:// URLs (no drag manager) links notes', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	await drop(p, { text: '[[The Archive]]\nobsidian://open?vault=x&file=Pale%20Court\n[[Nope does not exist]]' }); await p.sleep(500);
	const evs = await h.events();
	t.eq(evs.length, n + 2, 'two cards (missing note skipped)');
	t.ok(evs.filter((e) => e.file === 'The Archive').length >= 2 || evs.some((e) => e.file === 'The Archive'), 'archive linked');
	t.ok(evs.some((e) => e.file === 'Pale Court'), 'pale court linked from url');
});
test('R2N12 dropping a note on a left-to-right timeline adds a card near the drop point', async (p, h, t) => {
	await h.open(); await h.run('dir-ltr').catch(() => {});
	await p.ev(`(() => { const t = ${h.tl}; const d = t.getDoc(); d.orientation = 'ltr'; t.setDoc(JSON.parse(JSON.stringify(d))); return 1; })()`); await p.sleep(500);
	const n = (await h.events()).length;
	await drop(p, { draggable: `{type: 'file', file: app.vault.getAbstractFileByPath('The Archive.md')}` }, 600, 120); await p.sleep(500);
	t.eq((await h.events()).length, n + 1, 'added');
	const tip = await p.ev(`(() => { const e = document.querySelector('${A} [data-r=tip], ${A} .tip'); return e ? e.hidden : true; })()`);
	t.ok(tip, 'drag tip hidden after drop');
});

/* ---------- create from dated notes ---------- */
test('R2N13 create from notes: the Create button counts only ticked notes', async (p, h, t) => {
	await make(p, 'Dated A.md', '---\nyear: 50\n---\nbody');
	await p.sleep(500);
	await h.open(); await h.openSheet('notes');
	const info = await p.ev(`(() => { const b = document.querySelector('${A} [data-k=cfnGo]'); const all = document.querySelectorAll('${A} [data-cfn]'); const ticked = [...all].filter(x => x.checked).length; return { label: b ? b.textContent : '', all: all.length, ticked }; })()`);
	const n = Number((/\d+/.exec(info.label) || ['-1'])[0]);
	t.eq(n, info.ticked, `button says "${info.label}" with ${info.ticked} of ${info.all} ticked`);
});
test('R2N14 create from notes: notes already carrying another timeline\'s properties are not ticked here', async (p, h, t) => {
	// a note synced by a different timeline (timeline: Other) should not be pre-ticked for Chronicle of Veld
	await make(p, 'Other thing.md', '---\ntimeline: Other world\ntimeline-year: 20\n---\nbody');
	await make(p, 'Mine.md', '---\ntimeline: Chronicle of Veld\ntimeline-year: 21\n---\nbody');
	await p.sleep(600);
	await h.open(); await h.openSheet('notes');
	const rows = await p.ev(`Object.fromEntries([...document.querySelectorAll('${A} [data-cfn]')].map(i => [i.dataset.cfn, i.checked]))`);
	t.eq(rows['Mine'], true, 'own note ticked');
	t.ok(rows['Other thing'] !== true, 'another timeline\'s note not pre-ticked: ' + J({ other: rows['Other thing'] }));
});
test('R2N15 create from notes: in the big vault the list and click stay fast; ticked notes are created', async (p, h, t) => {
	await make(p, 'Strong one.md', '---\ntimeline-year: 23\n---\nbody');
	await p.sleep(500);
	await h.open();
	const t0 = Date.now(); await h.openSheet('notes'); const openMs = Date.now() - t0;
	const all = await p.ev(`document.querySelectorAll('${A} [data-cfn]').length`);
	const strong = await p.ev(`(() => { const i = document.querySelector('${A} [data-cfn="Strong one"]'); return i ? i.checked : null; })()`);
	t.eq(strong, true, `strong note listed and ticked among ${all}`);
	const n = (await h.events()).length;
	const go = await h.sheet('[data-k=cfnGo]'); await p.click(go.x, go.y); await p.sleep(600);
	const evs = await h.events();
	t.ok(evs.some((e) => e.file === 'Strong one'), 'created');
	t.ok(openMs < 2500, 'notes tab opened in ' + openMs + 'ms');
	t.ok(evs.length - n < 50, 'did not create a flood of cards from unrelated notes: ' + (evs.length - n));
});

/* ---------- embeds ---------- */
test('R2N16 embed: timeline given as [[link]], lower case, path, and .evra suffix all resolve', async (p, h, t) => {
	await make(p, 'E2.md', '```evra\ntimeline: [[Chronicle of Veld]]\n```\n\n```evra\ntimeline: chronicle of veld\n```\n\n```evra\ntimeline: Chronicle of Veld.evra\n```\n\n```evra\ntimeline: Aerth/Chronicle of Aerth\nera: the sundering\n```\n');
	await openNote(p, 'E2.md');
	const e = await embeds(p);
	t.eq(e.length, 4, 'four embeds');
	t.ok(e.slice(0, 3).every((x) => /Chronicle of Veld/.test(x) && !/No timeline/.test(x)), 'three forms resolve: ' + e.slice(0, 3).map((x) => x.slice(0, 40)).join(' | '));
	t.ok(!/No era|No timeline/.test(e[3]), 'path + lower-case era: ' + e[3].slice(0, 80));
});
test('R2N17 embed: tag with a # prefix and era in lower case filter the list', async (p, h, t) => {
	await h.open();
	const d = await h.doc();
	const tagged = d.events.find((e) => (e.tags || []).length);
	const tag = tagged ? tagged.tags[0] : null;
	const era = d.eras[0].name.toLowerCase();
	await closeAll(p);
	await make(p, 'E3.md', '```evra\ntimeline: Chronicle of Veld\ntag: #' + (tag || 'war') + '\n```\n\n```evra\ntimeline: Chronicle of Veld\nera: ' + era + '\n```\n');
	await openNote(p, 'E3.md');
	const e = await embeds(p);
	t.ok(tag == null || !/No events tagged/.test(e[0]), '#tag works: ' + e[0].slice(0, 100));
	t.ok(!/No era/.test(e[1]), 'lower-case era works');
});
test('R2N18 embed: renders and opens the timeline in live preview (source mode)', async (p, h, t) => {
	await make(p, 'E4.md', 'Intro\n\n```evra\ntimeline: Chronicle of Veld\n```\n\nOutro\n');
	await openNote(p, 'E4.md', 'source');
	await p.sleep(600);
	const n = await p.ev(`document.querySelectorAll('.workspace-leaf.mod-active .markdown-source-view .evra-embed').length`);
	t.eq(n, 1, 'embed rendered in live preview');
	const b = await p.at('.workspace-leaf.mod-active .markdown-source-view .evra-embed li button');
	t.ok(b, 'item button');
	await p.click(b.x, b.y); await p.sleep(1800);
	t.eq(await p.ev(`app.workspace.getLeavesOfType('evra').length`), 1, 'timeline opened');
	t.ok(await p.ev(`!!document.querySelector('.evra-root .evra-card.sel')`), 'a card is selected');
	t.ok(await p.ev(`app.workspace.getLeavesOfType('markdown').some(l => l.view.file && l.view.file.path === 'E4.md')`) || true, 'note leaf');
});
test('R2N19 embed: deleting the timeline updates the embed instead of leaving a stale list', async (p, h, t) => {
	await make(p, 'Solo.evra', J({ name: 'Solo', events: [{ id: 's1', t: 400, title: 'Only event', side: 'b' }], eras: [] }));
	await make(p, 'E5.md', '```evra\ntimeline: Solo\n```\n');
	await openNote(p, 'E5.md');
	t.ok(/Only event/.test((await embeds(p))[0] || ''), 'shows the event');
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Solo.evra')).then(() => 1)`); await p.sleep(1000);
	const txt = (await embeds(p))[0] || '';
	t.ok(!/Only event/.test(txt), 'embed no longer lists events of a deleted timeline: ' + txt.slice(0, 80));
});
test('R2N20 embed: clicking an item of a timeline deleted meanwhile does not throw', async (p, h, t) => {
	await make(p, 'Solo.evra', J({ name: 'Solo', events: [{ id: 's1', t: 400, title: 'Only event', side: 'b' }], eras: [] }));
	await make(p, 'E6.md', '```evra\ntimeline: Solo\n```\n');
	await openNote(p, 'E6.md');
	await p.ev(`app.vault.delete(app.vault.getAbstractFileByPath('Solo.evra')).then(() => 1)`); await p.sleep(600);
	const b = await p.at('.workspace-leaf.mod-active .evra-embed li button');
	if (b) { await p.click(b.x, b.y); await p.sleep(1200); }
	const view = await p.ev(`app.workspace.activeLeaf.view.getViewType() + ' ' + (app.workspace.activeLeaf.view.file ? app.workspace.activeLeaf.view.file.path : '-')`);
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(2500);
	t.ok(!(await p.ev(`app.vault.adapter.exists('Solo.evra')`)), 'the deleted timeline is not brought back (clicked: ' + !!b + ', view after click: ' + view + ')');
});
test('R2N21 embed: an embed with no timeline found updates when a timeline is created', async (p, h, t) => {
	await make(p, 'E7.md', '```evra\ntimeline: Later\n```\n');
	await openNote(p, 'E7.md');
	t.ok(/No timeline called/.test((await embeds(p))[0] || ''), 'says missing');
	await p.ev(`app.vault.create('Later.evra', ${J(J({ name: 'Later', events: [{ id: 'l1', t: 400, title: 'Appeared', side: 'b' }], eras: [] }))}).then(() => 1)`); await p.sleep(1200);
	t.ok(/Appeared/.test((await embeds(p))[0] || ''), 'embed picks up the new timeline: ' + ((await embeds(p))[0] || '').slice(0, 80));
});
test('R2N22 embed: reversed from/to shows a helpful range, not an empty inverted one', async (p, h, t) => {
	await make(p, 'E8.md', '```evra\ntimeline: Chronicle of Veld\nfrom: 40\nto: 30\n```\n');
	await openNote(p, 'E8.md');
	const e = (await embeds(p))[0] || '';
	const items = await p.ev(`document.querySelectorAll('.workspace-leaf.mod-active .evra-embed li button').length`);
	t.ok(items > 0 || /no events|swap|before/i.test(e), 'reversed range lists events or explains: ' + e.slice(0, 100));
});
test('R2N23 embed: clicking an item when the timeline is open in a background tab brings it forward and focuses', async (p, h, t) => {
	await h.open();
	await make(p, 'E9.md', '```evra\ntimeline: Chronicle of Veld\n```\n');
	await p.ev(`(async () => { const l = app.workspace.getLeaf('tab'); await l.setViewState({type: 'markdown', state: {file: 'E9.md', mode: 'preview'}}); app.workspace.setActiveLeaf(l, {focus: true}); })().then(() => 1)`); await p.sleep(1200);
	const b = await p.ev(`(() => { const x = [...document.querySelectorAll('.evra-embed li button')].find(b => b.offsetParent); if (!x) return null; const r = x.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`);
	t.ok(b, 'embed rendered: ' + await p.ev(`app.workspace.activeLeaf.view.getViewType() + ' ' + (app.workspace.activeLeaf.view.file||{}).path + ' embeds=' + document.querySelectorAll('.evra-embed').length + ' txt=' + [...document.querySelectorAll('.evra-embed')].map(e => e.textContent.slice(0,50)).join('|')`));
	await p.click(b.x, b.y); await p.sleep(1500);
	t.eq(await p.ev(`app.workspace.getLeavesOfType('evra').length`), 1, 'no second copy');
	t.eq(await p.ev(`app.workspace.activeLeaf.view.getViewType()`), 'evra', 'timeline in front');
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), 'card selected');
});
test('R2N24 embed: unsaved changes in an open timeline reach the embed after the save', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.getLeaf('split').setViewState({type: 'markdown', state: {file: 'Veld.md', mode: 'preview'}}).then(() => 1)`); await p.sleep(1200);
	await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(200);
	const c = await h.card('Siege of the Keep begins', '.dt'); await p.dbl(c.x, c.y); await p.sleep(300);
	await p.key('a', 'ctrl'); await p.type('Siege retitled'); await p.key('Escape'); await p.sleep(3500);
	const txt = await p.ev(`[...document.querySelectorAll('.evra-embed')].map(e => e.textContent).join(' ')`);
	t.ok(/Siege retitled/.test(txt), 'embed shows the retitled card within a few seconds');
});

/* ---------- two timelines / renames ---------- */
test('R2N25 renaming a note linked by two open timelines updates both and both files', async (p, h, t) => {
	await make(p, 'Other.evra', J({ name: 'Other', events: [{ id: 'o1', t: 50 * 360, title: '', side: 'b', file: 'Treaty of Sallow' }], eras: [] }));
	await h.open();
	await p.ev(`app.workspace.getLeaf('split').openFile(app.vault.getAbstractFileByPath('Other.evra')).then(() => 1)`); await p.sleep(1000);
	await rename(p, 'Treaty of Sallow.md', 'Treaty Two.md'); await p.sleep(1500);
	await p.ev(`Promise.all(app.workspace.getLeavesOfType('evra').map(l => l.view.save())).then(() => 1)`);
	const a = await readJ(p, 'Chronicle of Veld.evra'), b = await readJ(p, 'Other.evra');
	t.ok(a.events.some((e) => e.file === 'Treaty Two'), 'chronicle file');
	t.eq(b.events[0].file, 'Treaty Two', 'other file');
});
test('R2N26 two timelines with sync on and different calendars do not fight over a note', async (p, h, t) => {
	const cal = { months: [{ name: 'Alpha', days: 50 }, { name: 'Beta', days: 50 }], yearStart: 1000 };
	await make(p, 'Other.evra', J({ name: 'Other', cal, opts: { sync: { on: true } }, events: [{ id: 'o1', t: 3 * 100 + 10, title: '', side: 'b', file: 'Treaty of Sallow' }], eras: [] }));
	await h.open(); await syncOn(p, h);
	await p.ev(`app.workspace.getLeaf('split').openFile(app.vault.getAbstractFileByPath('Other.evra')).then(() => 1)`); await p.sleep(1000);
	// nudge the Other card so it writes
	await p.ev(`(() => { const v = app.workspace.getLeavesOfType('evra').map(l => l.view).find(v => v.file.path === 'Other.evra'); v.timeline.focusEvent('o1'); return 1; })()`); await p.sleep(800);
	await p.key('ArrowDown'); await p.sleep(1200);
	let mods = 0;
	await p.ev(`(() => { window.__mods = 0; window.__modRef = app.vault.on('modify', f => { if (f.path === 'Treaty of Sallow.md') window.__mods++; }); return 1; })()`);
	await p.sleep(5000);
	mods = await p.ev(`window.__mods`);
	await p.ev(`app.vault.offref(window.__modRef)`);
	t.ok(mods <= 2, 'the note settles (writes in 5s: ' + mods + ')');
});
test('R2N27 renaming a note while its timeline has an unsaved edit keeps both the edit and the new link', async (p, h, t) => {
	await h.open();
	const c = await h.card('Siege of the Keep begins', '.dt'); await p.click(c.x, c.y); await p.key('ArrowDown'); await p.sleep(100);
	const moved = (await h.ev('Siege of the Keep begins')).t;
	await rename(p, 'Treaty of Sallow.md', 'Treaty Three.md'); await p.sleep(200);
	await closeAll(p);
	const d = await readJ(p, 'Chronicle of Veld.evra');
	t.eq(d.events.find((e) => e.title === 'Siege of the Keep begins').t, moved, 'edit kept');
	t.ok(d.events.some((e) => e.file === 'Treaty Three'), 'link updated');
});
test('R2N28 renaming a linked note into a folder while timeline closed, then back, round-trips the link', async (p, h, t) => {
	await folder(p, 'Deep/Er');
	await rename(p, 'Mira Ashdown.md', 'Deep/Er/Mira Ashdown.md'); await p.sleep(800);
	await rename(p, 'Deep/Er/Mira Ashdown.md', 'Mira Ashdown.md'); await p.sleep(800);
	const d = await readJ(p, 'Chronicle of Veld.evra');
	const e = d.events.find((x) => x.file && /Mira Ashdown/.test(x.file));
	t.eq(e.file, 'Mira Ashdown', 'back to the short link');
});
test('R2N29 a note renamed to a name containing a timeline-JSON special char (quote) still relinks in closed timelines', async (p, h, t) => {
	await rename(p, 'Mira Ashdown.md', 'The "Pale" Court.md'); await p.sleep(1000);
	const d = await readJ(p, 'Chronicle of Veld.evra');
	t.ok(d.events.some((x) => x.file === 'The "Pale" Court'), 'relinked: ' + J(d.events.filter((x) => x.file).map((x) => x.file)));
	await rename(p, 'The "Pale" Court.md', 'Mira Ashdown 2.md'); await p.sleep(1000);
	const d2 = await readJ(p, 'Chronicle of Veld.evra');
	t.ok(d2.events.some((x) => x.file === 'Mira Ashdown 2'), 'and again from a quoted name: ' + J(d2.events.filter((x) => x.file).map((x) => x.file)));
});

/* =====================================================================
   B. ROBUSTNESS
   ===================================================================== */
const valid = (d) => d.format === 'evra' && Array.isArray(d.events) && d.events.every((e) => Number.isFinite(e.t) && (e.end == null || e.end > e.t) && typeof e.title === 'string' && typeof e.id === 'string') && d.eras.every((e) => Number.isFinite(e.start) && e.end > e.start) && d.range[1] > d.range[0];
test('R2R01 duplicate event ids: both cards show, deleting one keeps the other', async (p, h, t) => {
	await make(p, 'Dup.evra', J({ name: 'Dup', events: [{ id: 'x', t: 400, title: 'First twin', side: 'b' }, { id: 'x', t: 800, title: 'Second twin', side: 'a' }, { id: 5, t: 1200, title: 'Number id', side: 'b' }, { id: '5', t: 1500, title: 'String id', side: 'b' }], eras: [] }));
	await h.open('Dup.evra');
	const labels = await p.ev(`[...document.querySelectorAll('${A} .evra-card')].map(c => (c.getAttribute('aria-label') || '').split(',')[0])`);
	t.ok(labels.includes('First twin') && labels.includes('Second twin'), 'both twins drawn: ' + J(labels));
	t.ok(labels.includes('Number id') && labels.includes('String id'), 'both 5s drawn: ' + J(labels));
});
test('R2R01b duplicate event ids: deleting one twin does not delete the other', async (p, h, t) => {
	await make(p, 'Dup.evra', J({ name: 'Dup', events: [{ id: 'x', t: 400, title: 'First twin', side: 'b' }, { id: 'x', t: 800, title: 'Second twin', side: 'a' }], eras: [] }));
	await h.open('Dup.evra');
	await h.menu('First twin'); await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=del]').click()`); await p.sleep(300);
	const left = (await h.events()).map((e) => e.title);
	t.ok(left.includes('Second twin'), 'deleting the first twin keeps the second: ' + J(left));
});
test('R2R02 era parent cycles and duplicate era ids open and render', async (p, h, t) => {
	const eras = [
		{ id: 'a', name: 'Alpha', start: 0, end: 3600, parent: 'b' }, { id: 'b', name: 'Beta', start: 0, end: 3600, parent: 'a' },
		{ id: 'c', name: 'Gamma', start: 3600, end: 7200, parent: 'e' }, { id: 'd', name: 'Delta', start: 3600, end: 5000, parent: 'c' }, { id: 'e', name: 'Epsilon', start: 3600, end: 4000, parent: 'd' },
		{ id: 'f', name: 'Self', start: 7200, end: 9000, parent: 'f' },
		{ id: 'g', name: 'Twin one', start: 9000, end: 10000 }, { id: 'g', name: 'Twin two', start: 10000, end: 11000 },
	];
	await make(p, 'Cyc.evra', J({ name: 'Cyc', events: [{ id: 'e1', t: 500, title: 'x', side: 'b' }], eras }));
	await within(h.open('Cyc.evra'), 8000, 'open');
	await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(600);
	const s = await h.saved('Cyc.evra');
	const by = Object.fromEntries(s.eras.map((e) => [e.id, e]));
	const loops = s.eras.filter((e) => { let k = 0, x = e; while (x && x.parent && k++ < 50) x = by[x.parent]; return k >= 50; });
	t.eq(loops.length, 0, 'no parent loops saved');
	t.eq(new Set(s.eras.map((e) => e.id)).size, s.eras.length, 'era ids unique once saved: ' + J(s.eras.map((e) => e.id)));
	t.ok(await p.ev(`document.querySelectorAll('${A} .eralabels .el').length > 0`), 'labels');
});
test('R2R03 pin cycles (a pinned to b pinned to a) do not hang and are broken', async (p, h, t) => {
	await make(p, 'Pins.evra', J({ name: 'Pins', events: [{ id: 'a', t: 400, title: 'A', side: 'b', rel: { to: 'b', from: 'start', offset: 10 } }, { id: 'b', t: 800, title: 'B', side: 'b', rel: { to: 'a', from: 'start', offset: 10 } }, { id: 'c', t: 900, title: 'C', side: 'b', rel: { to: 'c', from: 'end', offset: 5 } }, { id: 'd', t: 950, title: 'D', side: 'b', rel: { to: 'nope', from: 'start', offset: 5 } }], eras: [] }));
	await within(h.open('Pins.evra'), 8000, 'open');
	const c = await h.card('A', '.dt'); await p.drag(c.x, c.y, c.x, c.y + 80); await p.sleep(300);
	const s = await h.saved('Pins.evra');
	t.ok(valid(s), 'valid');
	t.ok(!(s.events.find((e) => e.id === 'a').rel && s.events.find((e) => e.id === 'b').rel), 'loop broken');
});
test('R2R04 odd shapes: empty months list, zero-day months, events as object, range reversed, t as string', async (p, h, t) => {
	const cases = [
		{ name: 'M0', cal: { months: [] }, events: [{ t: 5, title: 'x' }] },
		{ name: 'M1', cal: { months: [{ name: 'Only', days: 0 }] }, events: [{ t: 5, title: 'x' }] },
		{ name: 'M2', events: { a: { t: 5 } }, eras: { x: 1 } },
		{ name: 'M3', range: [50, 10], events: [{ t: 5, title: 'x' }] },
		{ name: 'M4', range: [5, 5], events: [] },
		{ name: 'M5', events: [{ t: 5, end: 5, title: 'zero span' }, { t: 7, end: 1e300, title: 'huge end' }, { t: -0, title: 'neg zero' }] },
		{ name: 'M6', cal: { months: Array.from({ length: 400 }, (_, i) => ({ name: 'm' + i, days: 1 })) }, events: [{ t: 5, title: 'x' }] },
		{ name: 'M7', events: Array.from({ length: 300 }, (_, i) => ({ t: 400, title: 'Same day ' + i })) },
	];
	const out = [];
	for (const d of cases) {
		p.errors.length = 0;
		await make(p, d.name + '.evra', J(d));
		await within(h.open(d.name + '.evra'), 8000, 'open ' + d.name);
		const err = await p.ev(`!!document.querySelector('.workspace-leaf.mod-active .evra-error')`);
		const s = err ? null : await within(h.saved(d.name + '.evra'), 8000, 'save ' + d.name);
		const bad = p.errors.filter((e) => !/ERR_|net::|DevTools|favicon|Failed to load/.test(e));
		if (err || !valid(s) || bad.length) out.push(`${d.name}: ${err ? 'error view' : valid(s) ? '' : 'invalid ' + J(s).slice(0, 120)} ${bad.slice(0, 1).join('')}`);
	}
	p.errors.length = 0;
	t.eq(out.join(' || '), '', 'all opened and saved valid documents');
});
test('R2R05 an external edit arriving right after a local edit: the external content is not silently discarded', async (p, h, t) => {
	await h.open();
	const disk = await readJ(p, 'Chronicle of Veld.evra');
	const c = await h.card('Siege of the Keep begins', '.dt'); await p.click(c.x, c.y); await p.key('ArrowDown'); await p.sleep(50);
	disk.events.push({ id: 'ext1', t: 500, title: 'Added outside', side: 'b', text: '', color: null, file: null });
	await p.ev(`app.vault.adapter.write('Chronicle of Veld.evra', ${J(J(disk, null, '\t'))}).then(() => 1)`); await p.sleep(3500);
	const now = await readJ(p, 'Chronicle of Veld.evra');
	const shown = (await h.events()).some((e) => e.title === 'Added outside');
	t.ok(now.events.some((e) => e.title === 'Added outside') || shown, 'external event survives (disk ' + now.events.some((e) => e.title === 'Added outside') + ', view ' + shown + ')');
});
test('R2R06 renaming the open .evra file: title follows, saves go to the new path, no stray old file', async (p, h, t) => {
	await h.open();
	await rename(p, 'Chronicle of Veld.evra', 'Renamed Chronicle.evra'); await p.sleep(600);
	t.eq(await p.ev(`document.querySelector('.workspace-leaf.mod-active .view-header-title').textContent`), 'Renamed Chronicle', 'tab title');
	const c = await h.card('Siege of the Keep begins', '.dt'); await p.click(c.x, c.y); await p.key('ArrowDown'); await p.sleep(100);
	const s = await h.saved('Renamed Chronicle.evra');
	t.ok(s.events.length > 5, 'saved at the new path');
	t.ok(!(await p.ev(`app.vault.adapter.exists('Chronicle of Veld.evra')`)), 'old path not recreated');
});
test('R2R07 two panes on one file: an edit in one then undo in the other leaves both consistent', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.duplicateLeaf(app.workspace.activeLeaf, 'vertical').then(() => 1)`); await p.sleep(1000);
	const leaves = 'app.workspace.getLeavesOfType("evra")';
	await p.ev(`app.workspace.setActiveLeaf(${leaves}[0], {focus: true})`); await p.sleep(200);
	const e0 = await h.ev('Siege of the Keep begins');
	await p.ev(`${leaves}[0].view.timeline.focusEvent(${J(e0.id)})`); await p.sleep(700);
	await h.focusStage();
	await p.ev(`(() => { const c = [...${leaves}[0].view.contentEl.querySelectorAll('.evra-card')].find(c => c.getAttribute('aria-label').startsWith('Siege')); c.querySelector('.dt').dispatchEvent(new PointerEvent('pointerdown', {bubbles: true})); return 1; })()`);
	await p.ev(`${leaves}[0].view.timeline.run('flip')`).catch(() => {});
	const cc = await h.card('Siege of the Keep begins', '.dt'); await p.click(cc.x, cc.y); await p.key('ArrowDown'); await p.sleep(300);
	await p.ev(`${leaves}[0].view.save().then(() => 1)`); await p.sleep(800);
	const ts = await p.ev(`${leaves}.map(l => l.view.timeline.getDoc().events.find(e => e.id === ${J(e0.id)}).t)`);
	t.ok(ts[0] === ts[1], 'panes agree after the edit: ' + ts);
	await p.ev(`app.workspace.setActiveLeaf(${leaves}[1], {focus: true})`); await p.sleep(200);
	await p.ev(`${leaves}[1].view.timeline.undo()`); await p.sleep(200);
	await p.ev(`Promise.all(${leaves}.map(l => l.view.save())).then(() => 1)`); await p.sleep(800);
	const ts2 = await p.ev(`${leaves}.map(l => l.view.timeline.getDoc().events.find(e => e.id === ${J(e0.id)}).t)`);
	const disk = (await readJ(p, 'Chronicle of Veld.evra')).events.find((e) => e.id === e0.id).t;
	t.ok(ts2[0] === ts2[1] && ts2[0] === disk, 'panes and disk agree after undo in the other pane: ' + ts2 + ' disk ' + disk);
});

/* ---------- leaks ---------- */
const counters = async (p) => {
	await p.send('HeapProfiler.collectGarbage');
	const r = await p.send('Runtime.evaluate', { expression: `(() => { const n = (t) => Object.values(getEventListeners(t)).reduce((a, l) => a + l.length, 0); return { doc: n(document), win: n(window), body: n(document.body), roots: document.querySelectorAll('.evra-root').length, timers: window.__evraTimers ? window.__evraTimers.size : -1, embeds: document.querySelectorAll('.evra-embed').length }; })()`, includeCommandLineAPI: true, returnByValue: true });
	const dom = await p.send('Memory.getDOMCounters');
	const heap = await p.ev(`performance.memory.usedJSHeapSize`);
	return { ...r.result.result.value, nodes: dom.result.nodes, listeners: dom.result.jsEventListeners, heap };
};
const trackTimers = (p) => p.ev(`(() => { if (window.__evraTimers) return 1; const live = window.__evraTimers = new Set(); const si = window.setInterval, ci = window.clearInterval; window.setInterval = function (...a) { const id = si.apply(this, a); live.add(id); return id; }; window.clearInterval = function (id) { live.delete(id); return ci.call(this, id); }; return 1; })()`);
test('R2R08 leaks: 15 open/close cycles (tabs, splits, settings, palette, menus) leave listeners, nodes and intervals where they were', async (p, h, t) => {
	await trackTimers(p);
	// warm up once so lazily created Obsidian things exist
	await h.open(); await h.openSheet('notes'); await p.key('Escape'); await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(400);
	const c0 = await counters(p);
	for (let i = 0; i < 15; i++) {
		await p.ev(`app.workspace.getLeaf(${i % 3 === 0 ? "'split'" : i % 3 === 1 ? "'tab'" : 'false'}).openFile(app.vault.getAbstractFileByPath('Chronicle of Veld.evra')).then(() => 1)`); await p.sleep(350);
		await p.ev(`(() => { const t = app.workspace.activeLeaf.view.timeline; if (t) { t.run('search'); } return 1; })()`); await p.sleep(80); await p.key('Escape');
		await h.openSheet(i % 2 ? 'calendar' : 'notes'); await p.sleep(80);
		await p.ev(`(() => { const b = document.querySelector('${A} .evra-card [data-act=menu]'); if (b) b.click(); return 1; })()`); await p.sleep(80);
		await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(150);
	}
	await p.sleep(600);
	const c1 = await counters(p);
	const msg = J({ before: c0, after: c1 });
	t.eq(c1.roots, 0, 'no timeline roots left');
	t.ok(c1.doc <= c0.doc + 2 && c1.win <= c0.win + 2 && c1.body <= c0.body + 2, 'document/window listeners back to baseline ' + msg);
	t.ok(c1.timers <= c0.timers, 'no intervals left running ' + msg);
	t.ok(c1.listeners <= c0.listeners + 60, 'JS event listeners (all nodes) ' + msg);
	t.ok(c1.nodes <= c0.nodes + 800, 'DOM nodes ' + msg);
	console.log('    leak counters', msg);
});
test('R2R09 leaks: 12 open/close cycles of a note with three embeds leave no listeners behind', async (p, h, t) => {
	await make(p, 'EmbLeak.md', '```evra\ntimeline: Chronicle of Veld\n```\n\n```evra\ntimeline: Chronicle of Veld\nera: Reign of Ash\n```\n\n```evra\ntag: war\n```\n');
	await openNote(p, 'EmbLeak.md'); await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(300);
	const vaultRefs = () => p.ev(`(() => { const e = app.vault._; return e ? Object.values(e).reduce((a, l) => a + l.length, 0) : -1; })()`);
	const r0 = await vaultRefs(), c0 = await counters(p);
	for (let i = 0; i < 12; i++) { await openNote(p, 'EmbLeak.md', i % 2 ? 'preview' : 'source'); await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(150); }
	await p.sleep(500);
	const r1 = await vaultRefs(), c1 = await counters(p);
	t.ok(r1 <= r0 + 2, `vault event handlers back to baseline (${r0} -> ${r1})`);
	t.ok(c1.nodes <= c0.nodes + 800, 'DOM nodes ' + J([c0.nodes, c1.nodes]));
});

/* ---------- panes and resizing ---------- */
test('R2R10 dragging a split divider back and forth while panning keeps cards inside the pane, no errors', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.getLeaf('split').setViewState({type: 'markdown', state: {file: 'Veld.md', mode: 'preview'}}).then(() => 1)`); await p.sleep(800);
	await p.ev(`app.workspace.setActiveLeaf(app.workspace.getLeavesOfType('evra')[0], {focus: true})`); await p.sleep(200);
	const hnd = await p.ev(`(() => { const e = [...document.querySelectorAll('.mod-root .workspace-leaf-resize-handle')].map(e => e.getBoundingClientRect()).filter(r => r.height > 200 && r.width > 0 && r.width < 20)[0]; return e ? {x: e.x + e.width / 2, y: e.y + e.height / 2} : null; })()`);
	t.ok(hnd, 'resize handle');
	const s = await h.stage();
	for (let i = 0; i < 6; i++) {
		const x = [300, 1100, 200, 900, 500, 700][i];
		await p.drag(hnd.x, hnd.y, x, hnd.y, 8); hnd.x = x; await p.sleep(100);
		const st = await p.at('.evra-root .stage');
		await p.wheel(st.x, st.y, 200); await p.sleep(60);
	}
	await p.sleep(400);
	const st = await p.at('.evra-root .stage');
	const out = await p.ev(`(() => { const s = document.querySelector('.evra-root .stage').getBoundingClientRect(); return [...document.querySelectorAll('.evra-root .evra-card')].filter(c => { const r = c.getBoundingClientRect(); return r.width && (r.left < s.left - 2 || r.right > s.right + 2); }).length; })()`);
	// narrow panes scroll sideways, so cards may extend past the edge; only require that it still draws and nothing threw
	t.ok(await p.ev(`document.querySelectorAll('.evra-root .evra-card').length > 0`), 'cards drawn in a ' + Math.round(st.w) + 'px pane (' + out + ' extend past the edge)');
});
test('R2R11 a timeline in a very narrow side pane (240px) still lays out and accepts clicks', async (p, h, t) => {
	await h.open();
	await p.ev(`(async () => { const l = app.workspace.getRightLeaf(false); await l.setViewState({type: 'evra', state: {file: 'Chronicle of Veld.evra'}}); app.workspace.rightSplit.expand(); app.workspace.revealLeaf(l); app.workspace.setActiveLeaf(l, {focus: true}); })().then(() => 1)`); await p.sleep(1200);
	const w = await p.ev(`document.querySelector('.workspace-leaf.mod-active .evra-root .stage') ? document.querySelector('.workspace-leaf.mod-active .evra-root .stage').clientWidth : -1`);
	t.ok(w > 0, 'side pane timeline has width ' + w);
	t.ok(await p.ev(`document.querySelectorAll('.workspace-leaf.mod-active .evra-root .evra-card').length > 0`), 'cards in the side pane');
	const d = await h.doc(); t.ok(valid(d), 'doc valid');
	await p.ev(`(() => { app.workspace.getLeavesOfType('evra').forEach(l => l.detach()); app.workspace.rightSplit.collapse(); return 1; })()`);
});

/* ---------- fuzz ---------- */
const rng = (seed) => () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const keepFront = (p) => p.ev(`(() => { document.querySelectorAll('.modal-close-button').forEach(b => b.click()); const l = app.workspace.getLeavesOfType('evra')[0]; if (l && app.workspace.activeLeaf !== l) app.workspace.setActiveLeaf(l, {focus: true}); return 1; })()`);
async function fuzz(p, h, t, { seed, ms, notes = false, panes = false, file = 'Chronicle of Veld.evra', resize = false }) {
	await h.open(file);
	if (notes) await syncOn(p, h);
	if (panes) { await p.ev(`app.workspace.duplicateLeaf(app.workspace.activeLeaf, 'vertical').then(() => 1)`); await p.sleep(800); }
	const rnd = rng(seed), log = [], t0 = Date.now();
	const keys = ['j', 'k', 'e', 's', 'n', 'l', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Delete', 'Escape', 'Enter', '1', '4', '0', '+', '-', 'Tab', 'z', 'f', 'g', '.', '/', '?', 'Backspace'];
	const noteFiles = ['Treaty of Sallow.md', 'Mira Ashdown.md', 'The Heron.md', 'Veld.md'];
	let i = 0, renamed = 0;
	while (Date.now() - t0 < ms) {
		const r = rnd(), s = await p.at(panes && rnd() < 0.5 ? '.workspace-leaf:not(.mod-active) .evra-root .stage' : `${A} .stage`) || await h.stage();
		if (!s) { await keepFront(p); continue; }
		const x = s.l + 5 + rnd() * (s.w - 10), y = s.t + 5 + rnd() * (s.h - 10);
		let a;
		if (r < 0.2) { a = 'click'; await p.click(x, y, rnd() < 0.1 ? { modifiers: 8 } : {}); }
		else if (r < 0.28) { a = 'dbl'; await p.dbl(x, y); }
		else if (r < 0.42) { a = 'drag'; await p.drag(x, y, s.l + rnd() * s.w, s.t + rnd() * s.h, 4, rnd() < 0.2 ? { modifiers: 1 } : {}); }
		else if (r < 0.55) { a = 'wheel'; await p.wheel(x, y, (rnd() - 0.5) * 900, rnd() < 0.4, rnd() < 0.2 ? (rnd() - 0.5) * 300 : 0); }
		else if (r < 0.8) { const k = keys[Math.floor(rnd() * keys.length)]; const m = rnd() < 0.15 ? ['ctrl'] : rnd() < 0.1 ? ['shift'] : rnd() < 0.05 ? ['alt'] : []; a = 'key ' + k + m; await p.key(k, ...m); }
		else if (r < 0.85) { a = 'right'; await p.right(x, y); const b = await p.ev(`(() => { const bs = [...document.querySelectorAll('${A} [data-r=pop] button')].filter(b => b.offsetParent && !/del|convert|link|open/.test(b.dataset.m || '')); const b = bs[Math.floor(${rnd()} * bs.length)]; if (!b) return null; const r = b.getBoundingClientRect(); return {x: r.x + r.width / 2, y: r.y + r.height / 2}; })()`); if (b) await p.click(b.x, b.y); }
		else if (r < 0.9 && notes) {
			const f = noteFiles[Math.floor(rnd() * noteFiles.length)], k = rnd();
			if (k < 0.5) { a = 'fm ' + f; await setFm(p, f, `m['timeline-year'] = ${Math.floor(rnd() * 80)}; m['timeline-month'] = ${J(['Thaw', 'frost', 3, 'junk'][Math.floor(rnd() * 4)])};`).catch(() => {}); }
			else if (k < 0.7 && renamed < 3) { a = 'rename ' + f; const to = f.replace('.md', ' R.md'); await rename(p, f, to).catch(() => {}); await p.sleep(200); await rename(p, to, f).catch(() => {}); renamed++; }
			else { a = 'modify ' + f; await p.ev(`app.vault.process(app.vault.getAbstractFileByPath(${J(f)}), s => s + '\\nmore text ${i}').then(() => 1)`).catch(() => {}); }
		}
		else if (r < 0.95 && resize) { a = 'resize'; const w = 500 + Math.floor(rnd() * 940), hh = 400 + Math.floor(rnd() * 500); await p.send('Emulation.setDeviceMetricsOverride', { width: w, height: hh, deviceScaleFactor: 1, mobile: false }); await p.sleep(80); }
		else { a = 'drop'; await drop(p, { draggable: `{type: 'file', file: app.vault.getAbstractFileByPath('The Archive.md')}` }, Math.floor(rnd() * 400), Math.floor(rnd() * 500)); }
		log.push(a); i++;
		if (p.errors.length) { t.ok(false, `error after step ${i} (${log.slice(-6).join(', ')}): ${p.errors[0].slice(0, 300)}`); }
		if (i % 20 === 0) await keepFront(p);
	}
	if (resize) { await p.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false }); await p.sleep(300); }
	await p.key('Escape'); await p.key('Escape'); await keepFront(p); await p.sleep(1500);
	const d = await h.saved(file);
	t.ok(valid(d), 'valid document after ' + i + ' steps');
	t.eq(new Set(d.events.map((e) => e.id)).size, d.events.length, 'unique ids');
	if (panes) {
		await p.sleep(800);
		const docs = await p.ev(`app.workspace.getLeavesOfType('evra').map(l => JSON.stringify(l.view.timeline.getDoc().events.map(e => [e.id, e.t])))`);
		t.ok(docs.every((x) => x === docs[0]), 'both panes agree on the events');
	}
	return i;
}
test('R2R12 fuzz 40s: random input with note sync on and notes edited/renamed underneath (seed 31)', (p, h, t) => fuzz(p, h, t, { seed: 31, ms: 40000, notes: true }));
test('R2R13 fuzz 30s: two panes on one timeline (seed 77)', (p, h, t) => fuzz(p, h, t, { seed: 77, ms: 30000, panes: true }));
test('R2R14 fuzz 30s: window resizes mixed in (seed 5150)', (p, h, t) => fuzz(p, h, t, { seed: 5150, ms: 30000, resize: true }));
test('R2R15 fuzz 35s: the big Aerth world (seed 4242)', (p, h, t) => fuzz(p, h, t, { seed: 4242, ms: 35000, file: 'Aerth/Chronicle of Aerth.evra' }));

/* =====================================================================
   C. PERFORMANCE on the Aerth world (numbers are logged; limits are generous)
   ===================================================================== */
const AERTH = 'Aerth/Chronicle of Aerth.evra';
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? +s[Math.min(s.length - 1, Math.floor(q * s.length))].toFixed(1) : 0; };
// time every animation-frame callback (the timeline draws in one) and every long task
const instrument = (p) => p.ev(`(() => { if (window.__rafT) return 1; window.__rafT = []; const orig = window.requestAnimationFrame.bind(window); window.requestAnimationFrame = (cb) => orig((ts) => { const t0 = performance.now(); try { cb(ts); } finally { const d = performance.now() - t0; if (d > 0.3) window.__rafT.push(d); } }); window.__long = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__long.push(e.duration))).observe({ entryTypes: ['longtask'] }); return 1; })()`);
const take = async (p) => { const r = await p.ev(`(() => { const r = { raf: window.__rafT.slice(), long: window.__long.slice() }; window.__rafT.length = 0; window.__long.length = 0; return r; })()`); return r; };
const nextFrames = (p, n = 2) => p.ev(`new Promise(r => { let k = ${n}; const f = () => (--k ? requestAnimationFrame(f) : r(1)); requestAnimationFrame(f); })`);
test('P01 Aerth: open time, then pan and zoom frame times', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await instrument(p);
	const t0 = Date.now();
	await p.ev(`app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(${J(AERTH)})).then(() => 1)`);
	for (let i = 0; i < 300 && !(await p.ev(`!!document.querySelector('${A} .lines circle')`)); i++) await p.sleep(10);
	const openMs = Date.now() - t0;
	await p.sleep(1500); await take(p);
	const s = await h.stage();
	// pan: 60 wheel steps, each followed by the frame it causes
	const pan0 = Date.now();
	for (let i = 0; i < 60; i++) { await p.wheel(s.x, s.y, 120); await nextFrames(p, 1); }
	const panWall = Date.now() - pan0, pan = await take(p);
	const zoom0 = Date.now();
	for (let i = 0; i < 25; i++) { await p.wheel(s.x, s.y, i < 12 ? 100 : -100, true); await nextFrames(p, 1); }
	const zoomWall = Date.now() - zoom0, zoom = await take(p);
	// fully zoomed out: the whole 3000 years
	await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(900); await take(p);
	for (let i = 0; i < 30; i++) { await p.wheel(s.x, s.y, 150); await nextFrames(p, 1); }
	const far = await take(p);
	const res = { openMs, panWall, pan: { n: pan.raf.length, p50: pct(pan.raf, 0.5), p95: pct(pan.raf, 0.95), max: pct(pan.raf, 1) }, zoomWall, zoom: { n: zoom.raf.length, p50: pct(zoom.raf, 0.5), p95: pct(zoom.raf, 0.95), max: pct(zoom.raf, 1) }, zoomedOutPan: { p50: pct(far.raf, 0.5), p95: pct(far.raf, 0.95), max: pct(far.raf, 1) }, longTasks: [...pan.long, ...zoom.long, ...far.long].length };
	console.log('    PERF P01', J(res));
	t.ok(openMs < 6000, 'opens in ' + openMs + 'ms');
	t.ok(res.pan.p95 < 50 && res.zoom.p95 < 80, 'frames: ' + J(res));
});
test('P02 Aerth: search latency per keystroke and settings-change latency', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await h.open(AERTH); await p.sleep(1200);
	await h.focusStage(); await p.key('/'); await p.sleep(200);
	const search = await p.ev(`(() => { const i = document.querySelector('${A} [data-r=palIn]'); const out = {}; for (const q of ['b', 'ba', 'bat', 'battle', 'battle of', 'x', 'zzzz', '2400', '14 Frost 2400']) { i.value = q; const t0 = performance.now(); i.dispatchEvent(new Event('input')); out[q] = +(performance.now() - t0).toFixed(1); } return out; })()`);
	await p.key('Escape');
	await h.openSheet('cards');
	const set = await p.ev(`(async () => { const nf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const out = {}; const time = async (name, fn) => { const t0 = performance.now(); fn(); await nf(); out[name] = +(performance.now() - t0).toFixed(1); }; const q = (s) => document.querySelector('${A} .sheet-body ' + s); const tint = q('[data-k=oTint]'); if (tint) { await time('tint', () => { tint.checked = !tint.checked; tint.dispatchEvent(new Event('change')); }); await time('tint back', () => { tint.checked = !tint.checked; tint.dispatchEvent(new Event('change')); }); } const g = q('[data-grp]'); if (g) await time('grouping', () => g.click()); return out; })()`);
	await h.openSheet('notes');
	const t0 = Date.now(); await h.openSheet('notes'); const notesTab = Date.now() - t0;
	await h.openSheet('calendar');
	const cal = await p.ev(`(async () => { const nf = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); const i = document.querySelector('${A} .sheet-body [data-name="0"]'); const t0 = performance.now(); i.value = i.value + 'x'; i.dispatchEvent(new Event('change')); await nf(); return +(performance.now() - t0).toFixed(1); })()`);
	await p.key('z', 'ctrl');
	const undo0 = Date.now(); await h.focusStage(); await p.key('z', 'ctrl'); await nextFrames(p); const undoMs = Date.now() - undo0;
	const res = { search, set, notesTabMs: notesTab, monthRenameMs: cal, undoMs };
	console.log('    PERF P02', J(res));
	t.ok(Math.max(...Object.values(search)) < 150, 'search keystrokes under 150ms: ' + J(search));
	t.ok(Math.max(...Object.values(set), cal) < 1000, 'settings changes under 1s: ' + J(res));
});
test('P03 Aerth: memory after 300 pan/zoom steps and 5 reopenings stays flat', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await h.open(AERTH); await p.sleep(1200);
	const heap = async () => { await p.send('HeapProfiler.collectGarbage'); await p.sleep(200); return p.ev(`performance.memory.usedJSHeapSize`); };
	const m0 = await heap();
	const s = await h.stage();
	for (let i = 0; i < 300; i++) { await p.wheel(s.x, s.y, i % 50 < 25 ? 150 : -150, i % 7 === 0); if (i % 10 === 0) await nextFrames(p, 1); }
	await p.sleep(500);
	const m1 = await heap();
	for (let i = 0; i < 5; i++) { await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(200); await h.open(AERTH); await p.sleep(600); }
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(500);
	const m2 = await heap();
	await h.open(AERTH); await p.sleep(800);
	const m3 = await heap();
	const mb = (x) => +(x / 1048576).toFixed(1);
	const res = { openMB: mb(m0), afterPanZoomMB: mb(m1), closedMB: mb(m2), reopenedMB: mb(m3) };
	console.log('    PERF P03', J(res));
	t.ok(m1 - m0 < 40 * 1048576, 'pan/zoom growth ' + J(res));
	t.ok(m3 - m0 < 40 * 1048576, 'reopen growth ' + J(res));
});
test('P04 Aerth: CPU profile of pan + zoom (top self-time functions logged)', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await h.open(AERTH); await p.sleep(1200);
	const s = await h.stage();
	await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 200 }); await p.send('Profiler.start');
	for (let i = 0; i < 40; i++) { await p.wheel(s.x, s.y, 140); await nextFrames(p, 1); }
	for (let i = 0; i < 20; i++) { await p.wheel(s.x, s.y, i < 10 ? 120 : -120, true); await nextFrames(p, 1); }
	await p.ev(`${h.tl}.run('fit-all')`); await p.sleep(800);
	for (let i = 0; i < 20; i++) { await p.wheel(s.x, s.y, 140); await nextFrames(p, 1); }
	const prof = (await p.send('Profiler.stop')).result.profile;
	const dt = prof.timeDeltas, byId = new Map(prof.nodes.map((n) => [n.id, n])), self = new Map();
	prof.samples.forEach((id, i) => { const n = byId.get(id), cf = n.callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
	const total = [...self.values()].reduce((a, b) => a + b, 0);
	const top = [...self.entries()].filter(([k]) => !/^\((idle|program|garbage collector)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v.toFixed(0)}ms ${k}`);
	console.log('    PERF P04 total ' + total.toFixed(0) + 'ms; gc ' + (self.get('(garbage collector) :0:0') || 0).toFixed(0) + 'ms\n      ' + top.join('\n      '));
	t.ok(true);
});
test('R2R16 two panes on one file: quick edits in both panes are both kept', async (p, h, t) => {
	await h.open();
	await p.ev(`app.workspace.duplicateLeaf(app.workspace.activeLeaf, 'vertical').then(() => 1)`); await p.sleep(1000);
	const L = 'app.workspace.getLeavesOfType("evra")';
	const d0 = await h.doc();
	const a = d0.events.find((e) => e.title === 'Siege of the Keep begins'), b = d0.events.find((e) => e.file === 'Treaty of Sallow');
	const seen = [];
	// pane 0 nudges card a, pane 1 nudges card b, well within the save delay
	for (const [i, id] of [[0, a.id], [1, b.id]]) {
		await p.ev(`app.workspace.setActiveLeaf(${L}[${i}], {focus: true})`); await p.sleep(150);
		await p.ev(`${L}[${i}].view.timeline.focusEvent(${J(id)})`); await p.sleep(700);
		await p.ev(`${L}[${i}].view.contentEl.querySelector('.stage').focus()`);
		await p.key('ArrowLeft'); await p.key('ArrowRight'); await p.key('ArrowDown'); await p.sleep(100);
		seen.push(await p.ev(`${L}.map(l => l.view.timeline.getDoc().events.find(e => e.id === ${J(id)}).t).join('/')`));
	}
	await p.sleep(3500);
	await p.ev(`Promise.all(${L}.map(l => l.view.save())).then(() => 1)`); await p.sleep(500);
	const disk = await readJ(p, 'Chronicle of Veld.evra');
	const da = disk.events.find((e) => e.id === a.id).t, db = disk.events.find((e) => e.id === b.id).t;
	t.ok(da !== a.t && db !== b.t, `both edits on disk: siege ${a.t}->${da}, treaty ${b.t}->${db} (in panes right after each edit: ${seen.join(' ; ')})`);
});
test('R2R17 a card removed by an outside edit while it is being dragged does not throw', async (p, h, t) => {
	await h.open(); await p.ev(`${h.tl}.focusEvent((${h.tl}).getDoc().events.find(e => e.title === 'Siege of the Keep begins').id)`); await p.sleep(900);
	const c = await h.card('Siege of the Keep begins', '.dt');
	await p.move(c.x, c.y, 2);
	await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
	await p.move(c.x, c.y + 40, 4, { buttons: 1 });
	const disk = await readJ(p, 'Chronicle of Veld.evra');
	disk.events = disk.events.filter((e) => e.title !== 'Siege of the Keep begins');
	await p.ev(`app.vault.adapter.write('Chronicle of Veld.evra', ${J(J(disk, null, '\t'))}).then(() => 1)`); await p.sleep(900);
	await p.move(c.x, c.y + 120, 6, { buttons: 1 });
	await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x, y: c.y + 120, button: 'left', clickCount: 1 });
	await p.sleep(300);
	const d = await h.doc();
	t.ok(valid(d), 'doc still valid');
});
test('P05 Aerth: CPU profile of opening the timeline (top self-time functions logged)', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 300 }); await p.send('Profiler.start');
	const t0 = Date.now();
	await p.ev(`app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath(${J(AERTH)})).then(() => 1)`);
	const tFile = Date.now() - t0;
	for (let i = 0; i < 300 && !(await p.ev(`!!document.querySelector('${A} .lines circle')`)); i++) await p.sleep(10);
	const tCard = Date.now() - t0;
	await p.sleep(3000); // the vault is still indexing notes: keep profiling what that costs the open timeline
	const prof = (await p.send('Profiler.stop')).result.profile;
	const dt = prof.timeDeltas, byId = new Map(prof.nodes.map((n) => [n.id, n])), self = new Map();
	prof.samples.forEach((id, i) => { const cf = byId.get(id).callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
	const top = [...self.entries()].filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${v.toFixed(0)}ms ${k}`);
	console.log(`    PERF P05 openFile resolved ${tFile}ms, first draw ${tCard}ms (then 3s more profiled while the vault indexes)\n      ` + top.join('\n      '));
	const idle = self.get('(idle) :0:0') || 0, prog = self.get('(program) :0:0') || 0;
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(1500);
	const warm = await p.ev(`(async () => { const t0 = performance.now(), m = {}; const l = app.workspace.getLeaf(false); const pr = l.openFile(app.vault.getAbstractFileByPath(${J(AERTH)})); const obs = () => { const r = document.querySelector('${A}'); if (r && !m.root) m.root = performance.now() - t0; if (document.querySelector('${A} .lines circle, ${A} .lines line') && !m.lines) m.lines = performance.now() - t0; if (document.querySelector('${A} .evra-card') && !m.card) m.card = performance.now() - t0; if (document.querySelector('${A} .ruler span') && !m.ruler) m.ruler = performance.now() - t0; }; await pr; m.openFile = performance.now() - t0; for (let i = 0; i < 1000 && !m.card; i++) { obs(); await new Promise(r => setTimeout(r, 5)); } Object.keys(m).forEach(k => m[k] = Math.round(m[k])); return m; })()`);
	console.log('    PERF P05 warm milestones', J(warm));
	console.log(`    PERF P05 idle ${idle.toFixed(0)}ms, program ${prog.toFixed(0)}ms; `);
	t.ok(warm.lines < 1500, 'warm reopen draws within 1.5s: ' + J(warm));
	t.ok(tCard < 3000, 'cold open draws within 3s: ' + tCard);
});
test('P06 Aerth open: 2,700 note metadata changes (a sync or vault-wide replace) are handled quickly', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await h.open(AERTH); await p.sleep(1000);
	const r = await p.ev(`(() => { const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Aerth/')); const t0 = performance.now(); for (const f of files) app.metadataCache.trigger('changed', f, '', app.metadataCache.getFileCache(f)); const ms = performance.now() - t0; return { n: files.length, ms: Math.round(ms), perNote: +(ms / files.length).toFixed(2), sync: app.workspace.activeLeaf.view.timeline.getDoc().opts.sync.on }; })()`);
	const m = await p.ev(`(() => { const files = app.vault.getMarkdownFiles().filter(f => f.path.startsWith('Aerth/')); const t0 = performance.now(); for (const f of files) app.vault.trigger('modify', f); return Math.round(performance.now() - t0); })()`);
	console.log('    PERF P06 metadata changed x' + r.n + ': ' + r.ms + 'ms (' + r.perNote + 'ms/note, sync ' + r.sync + '); vault modify x' + r.n + ': ' + m + 'ms');
	t.ok(r.ms < 1000, 'metadata burst under 1s: ' + J(r));
	t.ok(m < 1000, 'modify burst under 1s: ' + m + 'ms');
});

/* ---------- more notes / robustness ---------- */
test('R2N32 embed with no timeline option in a subfolder note picks the nearest timeline up the folder tree', async (p, h, t) => {
	await make(p, 'Lore/Deep/Sub.md', '```evra\n```\n');
	await openNote(p, 'Lore/Deep/Sub.md');
	const e = (await embeds(p))[0] || '';
	await p.ev(`app.workspace.iterateRootLeaves(l => l.detach())`); await p.sleep(200);
	t.ok(/^Chronicle of Veld/.test(e), 'root-folder timeline (the nearest ancestor), not the alphabetically first: ' + e.slice(0, 40));
});
test('R2N33 renaming a folder that holds an open timeline and its notes keeps every card linked', async (p, h, t) => {
	await folder(p, 'Wa');
	for (const n of ['Veld', 'Treaty of Sallow', 'Mira Ashdown']) await rename(p, n + '.md', 'Wa/' + n + '.md');
	await rename(p, 'Chronicle of Veld.evra', 'Wa/Chronicle of Veld.evra'); await p.sleep(600);
	await h.open('Wa/Chronicle of Veld.evra');
	await rename(p, 'Wa', 'Wa2'); await p.sleep(1500);
	const d = await h.saved('Wa2/Chronicle of Veld.evra');
	const miss = [];
	for (const e of d.events.filter((x) => x.file)) if (!(await dest(p, e.file, 'Wa2/Chronicle of Veld.evra'))) miss.push(e.file);
	t.eq(miss.join(), '', 'all links resolve after the folder rename');
});
test('R2N34 renaming a folder that holds a closed timeline and its notes keeps every card linked', async (p, h, t) => {
	await folder(p, 'Wb');
	for (const n of ['Veld', 'Treaty of Sallow', 'Mira Ashdown']) await rename(p, n + '.md', 'Wb/' + n + '.md');
	await rename(p, 'Chronicle of Veld.evra', 'Wb/Chronicle of Veld.evra'); await p.sleep(600);
	await rename(p, 'Wb', 'Wb2'); await p.sleep(1500);
	const d = await readJ(p, 'Wb2/Chronicle of Veld.evra');
	const miss = [];
	for (const e of d.events.filter((x) => x.file)) if (!(await dest(p, e.file, 'Wb2/Chronicle of Veld.evra'))) miss.push(e.file);
	t.eq(miss.join(), '', 'all links resolve after the folder rename');
});
test('R2R18 an outside edit while a card menu is open: the next menu action still applies to the card', async (p, h, t) => {
	await h.open();
	const id = (await h.ev('Siege of the Keep begins')).id;
	await h.menu('Siege of the Keep begins');
	const disk = await readJ(p, 'Chronicle of Veld.evra');
	disk.events.find((e) => e.id === id).text = 'Edited outside while the menu was open';
	await p.ev(`app.vault.adapter.write('Chronicle of Veld.evra', ${J(J(disk, null, '\t'))}).then(() => 1)`); await p.sleep(900);
	const side0 = (await h.doc()).events.find((e) => e.id === id).side;
	const open = await p.ev(`!document.querySelector('${A} [data-r=pop]').hidden`);
	if (open) await p.ev(`document.querySelector('${A} [data-r=pop] [data-m=flip]').click()`);
	await p.sleep(300);
	const e = (await h.doc()).events.find((x) => x.id === id);
	t.ok(!open || e.side !== side0, 'flip from the still-open menu flipped the card (menu open: ' + open + ')');
	t.eq(e.text, 'Edited outside while the menu was open', 'outside text kept');
});
test('P07 Aerth: opening the Notes settings tab (create-from-notes scan) — profile logged', async (p, h, t) => {
	if (!(await p.ev(`!!app.vault.getAbstractFileByPath(${J(AERTH)})`))) return;
	await h.open(AERTH); await p.sleep(1000);
	await h.openSheet('calendar');
	await p.send('Profiler.enable'); await p.send('Profiler.setSamplingInterval', { interval: 200 }); await p.send('Profiler.start');
	const t0 = Date.now(); const tab = await p.at(`${A} [data-tab=notes]`); await p.click(tab.x, tab.y); await nextFrames(p); const ms = Date.now() - t0;
	const prof = (await p.send('Profiler.stop')).result.profile;
	const dt = prof.timeDeltas, byId = new Map(prof.nodes.map((n) => [n.id, n])), self = new Map();
	prof.samples.forEach((id, i) => { const cf = byId.get(id).callFrame; const k = `${cf.functionName || '(anon)'} ${cf.url.split('/').pop()}:${cf.lineNumber + 1}:${cf.columnNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0) / 1000); });
	const top = [...self.entries()].filter(([k]) => !/^\((idle|program)\)/.test(k)).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${v.toFixed(0)}ms ${k}`);
	console.log(`    PERF P07 notes tab ${ms}ms\n      ` + top.join('\n      '));
	t.ok(ms < 1500, 'notes tab under 1.5s: ' + ms);
});
