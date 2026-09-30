// QA: touch on a phone-sized viewport, keyboard-only use, popout windows, themes and zoom.
export const specs = [];
const test = (name, fn) => specs.push({ name, fn });
const A = '.workspace-leaf.mod-active .evra-root';
const SHOTS = 'test-dist/e2e-touch';
const SIEGE = 'zrzotia';
const byId = async (h, id) => (await h.events()).find((e) => e.id === id);

const touch = (p, type, pts) => p.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i, radiusX: 4, radiusY: 4, force: 1 })) });
const T = {
	async tap(p, x, y) { await touch(p, 'touchStart', [[x, y]]); await p.sleep(40); await touch(p, 'touchEnd', []); await p.sleep(60); },
	async dtap(p, x, y) { await T.tap(p, x, y); await p.sleep(80); await T.tap(p, x, y); await p.sleep(200); },
	async hold(p, x, y, ms = 800) { await touch(p, 'touchStart', [[x, y]]); await p.sleep(ms); await touch(p, 'touchEnd', []); await p.sleep(150); },
	async drag(p, x0, y0, x1, y1, { wait = 0, steps = 12 } = {}) {
		await touch(p, 'touchStart', [[x0, y0]]); if (wait) await p.sleep(wait);
		for (let i = 1; i <= steps; i++) { await touch(p, 'touchMove', [[x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps]]); await p.sleep(16); }
		await touch(p, 'touchEnd', []); await p.sleep(200);
	},
	async pinch(p, cx, cy, d0, d1, { steps = 12, vertical = true, oneFirst = 0 } = {}) {
		const at = (d) => vertical ? [[cx, cy - d / 2], [cx, cy + d / 2]] : [[cx - d / 2, cy], [cx + d / 2, cy]];
		if (oneFirst) { await touch(p, 'touchStart', [at(d0)[0]]); await p.sleep(oneFirst); }
		await touch(p, 'touchStart', at(d0)); await p.sleep(30);
		for (let i = 1; i <= steps; i++) { await touch(p, 'touchMove', at(d0 + (d1 - d0) * i / steps)); await p.sleep(16); }
		await touch(p, 'touchEnd', []); await p.sleep(250);
	},
};
const phone = async (p) => { await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }); await p.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 }); await p.sleep(400); };
const desktop = async (p) => { await p.send('Emulation.setDeviceMetricsOverride', { width: p.width, height: p.height, deviceScaleFactor: 1, mobile: false }); await p.send('Emulation.setTouchEmulationEnabled', { enabled: false }); await p.sleep(300); };
const phoneTest = (name, fn) => test(name, async (p, h, t) => { await phone(p); try { await fn(p, h, t); } finally { await desktop(p); } });
const view = (p, h) => p.ev(`${h.tl}.getViewState()`);
/** screen y of a date on the (vertical) timeline */
const yOf = (p, h, tt) => p.ev(`(() => { const v = ${h.tl}.getViewState(); const s = document.querySelector('${A} .stage').getBoundingClientRect(); return s.y + (${tt} - v.v0) * v.scale; })()`);
/** a point on empty stage (not a card, ui, era label or near the axis) */
const emptyAt = (p, h, avoidAxis = 30) => p.ev(`(() => { const s = document.querySelector('${A} .stage').getBoundingClientRect(); const ax = document.querySelector('${A} .lines line[style*="dasharray: 2"], ${A} .lines line[style*="dasharray:2"]'); const lx = s.left + Number(ax.getAttribute('x1'));
	for (let y = s.top + 250; y < s.bottom - 150; y += 23) for (let x = s.left + 60; x < s.right - 60; x += 17) { if (Math.abs(x - lx) < ${avoidAxis}) continue; const e = document.elementFromPoint(x, y); if (!e || e.closest('.evra-card,.ui,.ribbon,[data-era],[data-thread],.minimap,.el,.ruler')) continue; let ok = true; for (const [dx, dy] of [[-20,0],[20,0],[0,-20],[0,20]]) { const f = document.elementFromPoint(x+dx, y+dy); if (!f || f.closest('.evra-card,.ui,.ribbon,.minimap')) ok = false; } if (ok) return {x, y, lx}; } return null; })()`);
const pointerLog = (p) => p.ev(`(() => { window.__pl = []; const s = document.querySelector('${A} .stage'); ['pointerdown','pointerup','pointercancel'].forEach(t => s.addEventListener(t, e => __pl.push(t + ':' + e.pointerType), true)); return 1; })()`);

/* ---------- touch ---------- */
phoneTest('touch: the phone layout fits and touch reaches the stage as pointerType touch', async (p, h, t) => {
	await h.open();
	await p.shot(SHOTS + '-phone.png');
	await pointerLog(p);
	const s = await h.stage();
	t.ok(s && s.w <= 390, 'stage fits the phone width: ' + JSON.stringify(s));
	await T.tap(p, s.l + s.w - 20, s.t + 200);
	const log = await p.ev('__pl');
	t.ok(log.includes('pointerdown:touch'), 'touch pointer: ' + log.join(','));
	const ov = await p.ev(`(() => { const r = document.querySelector('${A}').getBoundingClientRect(); return [...document.querySelectorAll('${A} .ui:not([hidden]) .ibtn, ${A} .ui:not([hidden]) button')].filter(b => { const q = b.getBoundingClientRect(); return q.width && (q.right > r.right + 1 || q.left < r.left - 1); }).map(b => b.getAttribute('aria-label') || b.textContent); })()`);
	t.eq(ov.length, 0, 'no toolbar button off screen: ' + ov.join(','));
});
phoneTest('touch: double-tap on empty space adds an event', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length, s = await h.stage(), x = await h.lineX();
	const tx = x < s.l + s.w / 2 ? Math.min(x + 90, s.l + s.w - 10) : x - 90;
	await T.dtap(p, tx, s.t + 330); await p.sleep(300);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`), 'editing a new card');
	await p.key('Escape'); await p.sleep(200);
	t.eq((await h.events()).length, n + 1, 'one event added');
});
phoneTest('touch: tap a card selects it; a single tap on empty space does not add', async (p, h, t) => {
	await h.open();
	const n = (await h.events()).length;
	const c = await p.at(`${A} .evra-card:not(.group)`);
	t.ok(c, 'a card is visible');
	await T.tap(p, c.x, c.y); await p.sleep(200);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), 'selected');
	const s = await h.stage();
	await T.tap(p, s.l + s.w - 12, s.t + s.h - 80); await p.sleep(600);
	t.eq((await h.events()).length, n, 'no event added');
});
phoneTest('touch: press-and-hold on empty space opens the context menu', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), x = await h.lineX();
	const tx = x < s.l + s.w / 2 ? Math.min(x + 90, s.l + s.w - 10) : x - 90;
	await T.hold(p, tx, s.t + 330, 800);
	t.ok(await h.popOpen(), 'context menu open');
	t.ok(await p.ev(`!!document.querySelector('${A} [data-r=pop] [data-m=add]')`), 'has Add an event here');
	await p.shot(SHOTS + '-hold-menu.png');
	// a tap on "Add an event here" works
	const b = await h.pop('[data-m=add]');
	const n = (await h.events()).length;
	await T.tap(p, b.x, b.y); await p.sleep(300);
	t.eq((await h.events()).length, n + 1, 'tap on the menu item adds');
});
phoneTest('touch: press-and-hold on a card opens its menu', async (p, h, t) => {
	await h.open();
	const c = await p.at(`${A} .evra-card:not(.group) .dt`);
	await T.hold(p, c.x, c.y, 900);
	t.ok(await h.popOpen(), 'a menu opens on long-press of a card');
});
phoneTest('touch: one-finger pan moves the view and does not move cards', async (p, h, t) => {
	await h.open();
	const before = JSON.stringify((await h.events()).map((e) => e.t));
	const v0 = (await view(p, h)).v0, e = await emptyAt(p, h);
	t.ok(e, 'found empty space');
	await T.drag(p, e.x, e.y + 100, e.x, e.y - 150);
	const v1 = (await view(p, h)).v0;
	t.ok(v1 > v0, `panned forward ${v0} -> ${v1}`);
	t.eq(JSON.stringify((await h.events()).map((e) => e.t)), before, 'no event moved');
	t.ok(!(await h.popOpen()), 'no context menu after a pan');
});
phoneTest('touch: a quick swipe that starts on a card pans instead of dragging it', async (p, h, t) => {
	await h.open();
	const c = await p.at(`${A} .evra-card[data-id="${SIEGE}"] .dt`) || await p.at(`${A} .evra-card:not(.group) .dt`);
	const id = await p.ev(`document.elementFromPoint(${c.x}, ${c.y}).closest('.evra-card').dataset.id`);
	const t0 = (await byId(h, id)).t, v0 = (await view(p, h)).v0;
	await T.drag(p, c.x, c.y, c.x, c.y - 200);
	t.eq((await byId(h, id)).t, t0, 'card not moved');
	t.ok((await view(p, h)).v0 !== v0, 'view panned');
});
phoneTest('touch: hold a card then drag moves it (long-press arming)', async (p, h, t) => {
	await h.open();
	const c = await p.at(`${A} .evra-card:not(.group) .dt`);
	const id = await p.ev(`document.elementFromPoint(${c.x}, ${c.y}).closest('.evra-card').dataset.id`);
	const t0 = (await byId(h, id)).t, v0 = (await view(p, h)).v0;
	await T.drag(p, c.x, c.y, c.x, c.y + 120, { wait: 400 });
	t.ok((await byId(h, id)).t > t0, 'card moved later in time');
	t.eq((await view(p, h)).v0, v0, 'view not panned');
	await p.key('z', 'ctrl'); await p.sleep(100);
	t.eq((await byId(h, id)).t, t0, 'undo');
});
phoneTest('touch: two-finger pinch on empty space zooms in and out', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), x = await h.lineX();
	const cx = x < s.l + s.w / 2 ? Math.min(x + 110, s.l + s.w - 10) : x - 110;
	const sc0 = (await view(p, h)).scale;
	await T.pinch(p, cx, s.t + 350, 100, 300);
	const sc1 = (await view(p, h)).scale;
	t.ok(sc1 > sc0 * 2, `zoomed in ${sc0} -> ${sc1}`);
	await T.pinch(p, cx, s.t + 350, 300, 100);
	const sc2 = (await view(p, h)).scale;
	t.ok(sc2 < sc1 / 2, `zoomed out ${sc1} -> ${sc2}`);
	t.ok(!(await h.popOpen()), 'no menu');
});
phoneTest('touch: pinch with the first finger on the time line still zooms', async (p, h, t) => {
	await h.open();
	const s = await h.stage(), x = await h.lineX();
	const n = (await h.events()).length, sc0 = (await view(p, h)).scale;
	// first finger lands on the axis itself, second arrives a moment later
	const e = await emptyAt(p, h);
	await touch(p, 'touchStart', [[x, e.y]]); await p.sleep(60);
	for (let i = 0; i <= 12; i++) { await touch(p, 'touchMove', [[x, e.y], [e.x, e.y + 60 + i * 20]]); await p.sleep(16); }
	await touch(p, 'touchEnd', []); await p.sleep(300);
	const sc1 = (await view(p, h)).scale;
	t.ok(!(await h.popOpen()), 'no create popover opened');
	t.eq((await h.events()).length, n, 'nothing added');
	t.ok(sc1 > sc0 * 1.5, `zoomed ${sc0} -> ${sc1}`);
});
phoneTest('touch: pinch with the first finger on a card zooms, card stays put', async (p, h, t) => {
	await h.open();
	const c = await p.at(`${A} .evra-card:not(.group) .dt`);
	const id = await p.ev(`document.elementFromPoint(${c.x}, ${c.y}).closest('.evra-card').dataset.id`);
	const t0 = (await byId(h, id)).t, sc0 = (await view(p, h)).scale;
	await T.pinch(p, c.x, c.y + 60, 120, 320, { oneFirst: 50 });
	t.eq((await byId(h, id)).t, t0, 'card not moved');
	t.ok((await view(p, h)).scale > sc0 * 1.5, 'zoomed');
});
phoneTest('touch: settings sheet opens and closes by tap and fits the phone', async (p, h, t) => {
	await h.open();
	const b = await h.ctrl('settings');
	await T.tap(p, b.x, b.y); await p.sleep(300);
	const sh = await p.at(`${A} [data-r=sheet]`);
	t.ok(sh, 'sheet open');
	t.ok(sh.l >= -1 && sh.l + sh.w <= 391, 'sheet within screen: ' + JSON.stringify(sh));
	await p.shot(SHOTS + '-sheet.png');
	const x = await p.at(`${A} [data-r=sheetClose]`);
	await T.tap(p, x.x, x.y); await p.sleep(300);
	t.ok(await p.ev(`document.querySelector('${A} [data-r=sheet]').hidden`), 'closed');
});
phoneTest('touch: card menu button opens by tap and the menu fits', async (p, h, t) => {
	await h.open();
	const c = await p.at(`${A} .evra-card:not(.group)`);
	await T.tap(p, c.x, c.y); await p.sleep(200);
	const m = await p.at(`${A} .evra-card.sel [data-act=menu]`);
	t.ok(m, 'menu button visible on the selected card (no hover on touch)');
	if (m) { await T.tap(p, m.x, m.y); await p.sleep(250); }
	t.ok(await h.popOpen(), 'menu open');
	const r = await p.at(`${A} [data-r=pop]`);
	t.ok(r.l >= 0 && r.l + r.w <= 390 && r.t >= 0 && r.t + r.h <= 844, 'menu on screen ' + JSON.stringify(r));
	await p.shot(SHOTS + '-cardmenu.png');
});

/* ---------- keyboard only ---------- */
const active = (p) => p.ev(`(() => { const a = document.activeElement; if (!a) return null; const cs = getComputedStyle(a); return { tag: a.tagName, cls: a.className && a.className.baseVal === undefined ? String(a.className) : '', name: a.getAttribute('aria-label') || a.getAttribute('title') || (a.textContent || '').trim().slice(0, 30), c: a.dataset.c || a.dataset.tab || a.dataset.id || '', inRoot: !!a.closest('${A}'), inPop: !!a.closest('${A} [data-r=pop]'), inSheet: !!a.closest('${A} [data-r=sheet]'), outline: cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0, shadow: cs.boxShadow !== 'none', visible: a.getBoundingClientRect().width > 0 }; })()`);
const enter = async (p) => { await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' }); await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 }); await p.sleep(60); };
const focusStageKb = async (p, h) => { await p.ev(`document.querySelector('${A} .stage').focus()`); await p.sleep(80); };

test('kbd: Tab walks the toolbar; every stop has a name and a visible focus ring', async (p, h, t) => {
	await h.open(); await focusStageKb(p, h);
	const stops = [];
	for (let i = 0; i < 40; i++) { await p.key('Tab'); const a = await active(p); stops.push(a); if (a && !a.inRoot) break; }
	const inRoot = stops.filter((a) => a && a.inRoot);
	console.log('    tab stops:', inRoot.map((a) => `${a.tag}${a.c ? '[' + a.c + ']' : ''}:${a.name.slice(0, 18)}${a.outline || a.shadow ? '' : '(NO RING)'}`).join(' | '));
	const noName = inRoot.filter((a) => !a.name);
	t.eq(noName.length, 0, 'unnamed stops: ' + JSON.stringify(noName));
	const noRing = inRoot.filter((a) => !a.outline && !a.shadow);
	t.eq(noRing.length, 0, 'stops without focus ring: ' + noRing.map((a) => a.tag + ':' + a.name).join(', '));
	t.ok(inRoot.some((a) => a.c === 'settings'), 'settings button reachable within 40 Tabs (toolbar comes after every card)');
});
test('kbd: L opens the card menu; arrow keys move within the menu, not the card', async (p, h, t) => {
	await h.open(); await focusStageKb(p, h);
	await p.key('j'); await p.sleep(150);
	const id = await p.ev(`${h.tl} && document.querySelector('${A} .evra-card.sel').dataset.id`);
	const e0 = await byId(h, id);
	await p.key('l'); await p.sleep(250);
	t.ok(await h.popOpen(), 'menu open');
	const a1 = await active(p);
	await p.key('ArrowDown'); await p.sleep(120); await p.key('ArrowDown'); await p.sleep(120);
	const e1 = await byId(h, id), a2 = await active(p);
	t.eq(e1.t, e0.t, 'card date unchanged by arrows while its menu is open');
	t.ok(a2.inPop, 'focus in the menu after arrows: ' + JSON.stringify([a1, a2]));
});
test('kbd: Tab from an open card menu reaches its controls, Escape returns focus to the timeline', async (p, h, t) => {
	await h.open(); await focusStageKb(p, h);
	await p.key('j'); await p.sleep(150);
	await p.key('l'); await p.sleep(250);
	let reached = false;
	for (let i = 0; i < 6; i++) { await p.key('Tab'); const a = await active(p); if (a.inPop) { reached = true; break; } }
	t.ok(reached, 'Tab reaches the menu within 6 presses');
	await p.key('Escape'); await p.sleep(150);
	t.ok(!(await h.popOpen()), 'closed');
	const a = await active(p);
	t.ok(a.inRoot, 'focus stays in the timeline: ' + JSON.stringify(a));
	await p.key('j'); await p.sleep(100);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), 'shortcuts work after');
});
test('kbd: settings open with Enter, Tab moves inside, Escape closes and focus returns', async (p, h, t) => {
	await h.open();
	await p.ev(`document.querySelector('${A} [data-c=settings]').focus()`);
	await enter(p); await p.sleep(300);
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=sheet]').hidden`), 'sheet open by Enter');
	await p.key('Tab'); await p.sleep(60);
	let a = await active(p);
	const seq = [a];
	for (let i = 0; i < 8; i++) { await p.key('Tab'); seq.push(await active(p)); }
	t.ok(seq.some((x) => x.inSheet), 'Tab reaches the sheet: ' + seq.map((x) => x.name.slice(0, 12)).join('|'));
	const before = await active(p);
	await p.key('Escape'); await p.sleep(200);
	t.ok(await p.ev(`document.querySelector('${A} [data-r=sheet]').hidden`), 'Escape closes; focus was ' + JSON.stringify(before) + ' seq ' + seq.map((x) => x.tag + ':' + x.name.slice(0, 12) + (x.inSheet ? '*' : '')).join('|'));
	a = await active(p);
	t.ok(a.inRoot, 'focus back in the timeline: ' + JSON.stringify(a));
});
test('kbd: Space on a toolbar button activates it', async (p, h, t) => {
	await h.open();
	const sc0 = (await view(p, h)).scale;
	await p.ev(`document.querySelector('${A} [data-c=in]').focus()`);
	await p.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32, text: ' ' });
	await p.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
	await p.sleep(400);
	t.ok((await view(p, h)).scale > sc0, 'zoomed in by Space');
});
test('kbd: Tab to a card selects it; Enter edits; Escape ends', async (p, h, t) => {
	await h.open();
	await p.ev(`document.querySelector('${A} .evra-card[data-id="${SIEGE}"]').focus()`); await p.sleep(150);
	t.ok(await p.ev(`document.activeElement.classList.contains('sel')`), 'focused card selected');
	await enter(p); await p.sleep(250);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`), 'editing');
	await p.key('Escape'); await p.sleep(200);
	t.ok(!(await p.ev(`!!document.querySelector('${A} .evra-card.editing')`)), 'done');
	const a = await active(p);
	t.ok(a.inRoot, 'focus stays in timeline after edit: ' + JSON.stringify(a));
});
test('kbd: a grouped card can be opened with Enter', async (p, h, t) => {
	await h.open();
	await h.setView(-200, 2000); await p.sleep(300);
	const g = await p.ev(`!!document.querySelector('${A} .evra-card.group')`);
	if (!g) { console.log('    (no groups at this zoom)'); return; }
	await p.ev(`document.querySelector('${A} .evra-card.group').focus()`); await p.sleep(150);
	await enter(p); await p.sleep(400);
	t.ok(await h.popOpen(), 'group panel opens with Enter');
});
test('kbd: palette traps nothing: / opens, Tab/Escape leave, focus returns', async (p, h, t) => {
	await h.open(); await focusStageKb(p, h);
	await p.key('/'); await p.sleep(200);
	t.ok(await p.ev(`!document.querySelector('${A} [data-r=palette]').hidden`), 'open');
	await p.key('Escape'); await p.sleep(200);
	t.ok(await p.ev(`document.querySelector('${A} [data-r=palette]').hidden`), 'closed');
	t.ok((await active(p)).inRoot, 'focus back in the timeline');
});
test('kbd: help popover (?) closes with Escape and focus stays usable', async (p, h, t) => {
	await h.open(); await focusStageKb(p, h);
	await p.key('?', 'shift'); await p.sleep(250);
	t.ok(await h.popOpen(), 'help open');
	await p.key('Escape'); await p.sleep(150);
	t.ok(!(await h.popOpen()), 'closed');
	await p.key('j'); await p.sleep(100);
	t.ok(await p.ev(`!!document.querySelector('${A} .evra-card.sel')`), 'J works after');
});

/* ---------- layout on a phone ---------- */
phoneTest('phone: cards stay inside the stage and clear of the ruler labels', async (p, h, t) => {
	await h.open(); await p.sleep(300);
	const r = await p.ev(`(() => { const s = document.querySelector('${A} .stage').getBoundingClientRect(); const cards = [...document.querySelectorAll('${A} .cards > .evra-card')].map(c => [c.getAttribute('aria-label').slice(0, 20), c.getBoundingClientRect()]).filter(([, b]) => b.bottom > s.top && b.top < s.bottom);
		const out = cards.filter(([, b]) => b.left < s.left - 1 || b.right > s.right + 1).map(([n, b]) => n + '@' + Math.round(b.left) + '..' + Math.round(b.right));
		const labs = [...document.querySelectorAll('${A} .ruler span:not([hidden])')].map(l => l.getBoundingClientRect()).filter(b => b.width);
		const over = []; for (const [n, b] of cards) for (const l of labs) if (l.left < b.right && l.right > b.left && l.top < b.bottom && l.bottom > b.top) over.push(n);
		return { stage: [Math.round(s.left), Math.round(s.right)], out, over: [...new Set(over)] }; })()`);
	t.eq(r.out.length, 0, 'cards cut off by the stage edge: ' + JSON.stringify(r));
	t.eq(r.over.length, 0, 'ruler labels drawn over cards: ' + JSON.stringify(r.over));
});

/* ---------- popout window ---------- */
test('popout: a timeline opens in a popout window and responds', async (p, h, t) => { try { await popout(p, h, t); } finally { await p.ev(`(() => { app.workspace.getLeavesOfType('evra').filter(l => l.view.containerEl.win !== window).forEach(l => l.detach()); return 1; })()`); await p.sleep(400); } });
async function popout(p, h, t) {
	const ok = await p.ev(`(async () => { try { const leaf = app.workspace.openPopoutLeaf(); await leaf.openFile(app.vault.getAbstractFileByPath('Chronicle of Veld.evra')); const w = leaf.view.containerEl.win; try { w.resizeTo(1200, 800); } catch {} await new Promise(r => setTimeout(r, 1500)); const st = leaf.view.containerEl.querySelector('.stage'); return { ok: true, sameWin: w === window, cards: leaf.view.containerEl.querySelectorAll('.evra-card').length, hasTl: !!leaf.view.timeline, inner: [w.innerWidth, w.innerHeight], stage: st ? [st.clientWidth, st.clientHeight] : null, err: leaf.view.containerEl.querySelector('.evra-error')?.textContent }; } catch (e) { return { ok: false, err: String(e) }; } })()`);
	console.log('    popout:', JSON.stringify(ok));
	t.ok(ok.ok, 'popout opened: ' + JSON.stringify(ok));
	t.ok(!ok.sameWin, 'in its own window');
	if (ok.inner && ok.inner[0] <= 1) { console.log('    popout window is 1x1 under headless ozone: cannot render, skipping the rest'); return; }
	t.ok(ok.cards > 3, 'cards render in the popout');
	const targets = await (await fetch(`http://127.0.0.1:${await p.ev('0') || 0}/json`).catch(() => null));
	// act on the popout's DOM from the main renderer (same process, window object reachable)
	const res = await p.ev(`(async () => { const leaf = app.workspace.getLeavesOfType('evra').find(l => l.view.containerEl.win !== window); const W = leaf.view.containerEl.win, D = W.document, root = leaf.view.containerEl.querySelector('.evra-root'); const out = {};
		const s = root.querySelector('.stage'); const sr = s.getBoundingClientRect(); out.stage = [sr.width, sr.height];
		// settings button click
		root.querySelector('[data-c=settings]').click(); await new Promise(r => setTimeout(r, 300)); out.sheet = !root.querySelector('[data-r=sheet]').hidden;
		root.querySelector('[data-r=sheetClose]').click(); await new Promise(r => setTimeout(r, 200));
		// card menu
		root.querySelector('.evra-card:not(.group) [data-act=menu]').click(); await new Promise(r => setTimeout(r, 300));
		const pop = root.querySelector('[data-r=pop]'); out.menu = !pop.hidden;
		// clicking in the popout document outside the menu should close it
		s.dispatchEvent(new W.PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5, pointerId: 9, button: 0, pointerType: 'mouse' }));
		s.dispatchEvent(new W.PointerEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5, pointerId: 9, button: 0, pointerType: 'mouse' }));
		await new Promise(r => setTimeout(r, 200)); out.menuClosedByOutside = pop.hidden;
		// keyboard: J selects
		s.focus(); s.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'j', bubbles: true })); await new Promise(r => setTimeout(r, 200)); out.jSel = !!root.querySelector('.evra-card.sel');
		// Delete + toast
		s.dispatchEvent(new W.KeyboardEvent('keydown', { key: 'Delete', bubbles: true })); await new Promise(r => setTimeout(r, 200)); const toast = root.querySelector('[data-r=toast]'); out.toast = toast && !toast.hidden ? toast.textContent : '';
		out.focusDocOk = D.activeElement && root.contains(D.activeElement);
		return out; })()`);
	console.log('    popout actions:', JSON.stringify(res));
	t.ok(res.sheet, 'settings open in popout');
	t.ok(res.menu, 'card menu opens in popout');
	t.ok(res.menuClosedByOutside, 'menu closes on outside pointerdown in popout');
	t.ok(res.jSel, 'J works');
	t.ok(res.toast, 'toast shows after delete');
}

/* ---------- themes and zoom ---------- */
test('theme: the Obsidian font-size setting reaches card text', async (p, h, t) => {
	await h.open();
	const fsz = () => p.ev(`[getComputedStyle(document.querySelector('${A} .evra-card:not(.group) .tt')).fontSize, getComputedStyle(document.querySelector('${A} .evra-card:not(.group) .bd') || document.body).fontSize, getComputedStyle(document.querySelector('.markdown-preview-view, .cm-content') || document.body).fontSize, getComputedStyle(document.body).getPropertyValue('--font-text-size')]`);
	const a = await fsz();
	await p.ev(`(() => { app.vault.setConfig('baseFontSize', 24); app.updateFontSize(); return 1; })()`); await p.sleep(500);
	const b = await fsz();
	await p.ev(`(() => { app.vault.setConfig('baseFontSize', 16); app.updateFontSize(); return 1; })()`); await p.sleep(300);
	console.log('    font sizes at 16 / 24:', JSON.stringify(a), JSON.stringify(b));
	t.ok(a[3] !== b[3], 'Obsidian text size variable changed');
	t.ok(a[0] !== b[0] || a[1] !== b[1], 'card title or description follows the font-size setting');
});
test('theme: big font size and dark theme keep toolbar and cards readable', async (p, h, t) => {
	await p.ev(`(() => { app.vault.setConfig('baseFontSize', 22); app.updateFontSize && app.updateFontSize(); app.changeTheme('obsidian'); return 1; })()`);
	await p.sleep(500);
	try {
		await h.open(); await p.sleep(500);
		await p.shot(SHOTS + '-font22-dark.png');
		const r = await p.ev(`(() => { const root = document.querySelector('${A}'); const rr = root.getBoundingClientRect();
			const tt = [...root.querySelectorAll('.cards > .evra-card:not(.group) .tt')].filter(e => e.getBoundingClientRect().width).map(e => ({ n: e.textContent.slice(0, 16), over: e.scrollHeight > e.clientHeight + 2 }));
			const cardOver = [...root.querySelectorAll('.cards > .evra-card:not(.group):not(.compact)')].filter(c => c.getBoundingClientRect().width && c.scrollHeight > c.clientHeight + 4).map(c => c.getAttribute('aria-label').slice(0, 20) + ':' + c.scrollHeight + '>' + c.clientHeight);
			const ctrls = root.querySelector('[data-r=ctrls]').getBoundingClientRect();
			return { cardOver, clipped: tt.filter(x => x.over).map(x => x.n), ctrlsIn: ctrls.bottom <= rr.bottom + 1 && ctrls.top >= rr.top - 1, fs: getComputedStyle(document.body).fontSize }; })()`);
		console.log('    font22:', JSON.stringify(r));
		t.ok(r.ctrlsIn, 'toolbar inside the view');
		t.eq(r.cardOver.length, 0, 'card content overflows its box: ' + r.cardOver.join(', '));
	} finally { await p.ev(`(() => { app.vault.setConfig('baseFontSize', 16); app.updateFontSize && app.updateFontSize(); app.changeTheme('moonstone'); return 1; })()`); await p.sleep(300); }
});
for (const Z of [1, 1.5]) test(`theme: ${Z * 100}% window zoom: double-click adds where clicked`, async (p, h, t) => {
	await p.ev(`(() => { require('electron').webFrame.setZoomFactor(${Z}); return 1; })()`); await p.sleep(600);
	try {
		await h.open(); await p.sleep(400);
		await p.shot(SHOTS + '-zoom' + Z + '.png');
		const e = await emptyAt(p, h, 40);
		t.ok(e, 'empty spot');
		const n = (await h.events()).length;
		const hit = await p.ev(`(() => { window.__d = []; const s = document.querySelector('${A} .stage'); s.addEventListener('pointerdown', ev => __d.push([ev.clientX, ev.clientY]), true); return 1; })()`);
		await p.dbl(e.x, e.y); await p.sleep(400);
		const dn = await p.ev('__d');
		await p.key('Escape'); await p.sleep(200);
		const evs = await h.events();
		t.eq(evs.length, n + 1, 'added; pointer at ' + JSON.stringify(dn) + ' wanted ' + JSON.stringify(e));
		t.ok(Math.abs(dn[0][1] - e.y) < 2, 'pointer landed where clicked');
	} finally { await p.ev(`(() => { require('electron').webFrame.setZoomFactor(1); return 1; })()`); await p.sleep(300); }
});
