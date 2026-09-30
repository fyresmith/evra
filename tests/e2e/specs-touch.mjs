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
	const v0 = (await view(p, h)).v0, s = await h.stage();
	await T.drag(p, s.l + s.w - 15, s.t + 500, s.l + s.w - 15, s.t + 250);
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
	await touch(p, 'touchStart', [[x, s.t + 300]]); await p.sleep(60);
	for (let i = 0; i <= 12; i++) { const d = 100 + i * 20; await touch(p, 'touchMove', [[x, s.t + 300 - (i ? d / 2 - 50 : 0)], [x + 3, s.t + 300 + d / 2]]); await p.sleep(16); }
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
