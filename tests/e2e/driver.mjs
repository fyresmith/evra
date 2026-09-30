// Drives a real, headless Obsidian over the Chrome DevTools protocol.
// Obsidian runs with its own throwaway profile and a throwaway copy of test-vault, so nothing real is touched.
import { spawn } from 'child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const ELECTRON = process.env.OBSIDIAN_ELECTRON || '/usr/lib/electron43/electron';
const ASAR = process.env.OBSIDIAN_ASAR || '/usr/lib/obsidian/app.asar';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function connect(url, onEvent) {
	const ws = new WebSocket(url);
	let id = 0;
	const pending = new Map();
	ws.addEventListener('message', (m) => {
		const d = JSON.parse(m.data);
		if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
		else if (d.method) onEvent(d);
	});
	const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
	return new Promise((r, j) => { ws.addEventListener('open', () => r({ ws, send })); ws.addEventListener('error', j); });
}

export async function launch({ vault = 'test-vault', theme = 'light', width = 1440, height = 900 } = {}) {
	if (!existsSync(ELECTRON) || !existsSync(ASAR)) throw new Error(`Obsidian not found. Set OBSIDIAN_ELECTRON and OBSIDIAN_ASAR (looked for ${ELECTRON} and ${ASAR}).`);
	const work = mkdtempSync(join(tmpdir(), 'evra-e2e-'));
	const vaultDir = join(work, 'vault');
	cpSync(vault, vaultDir, { recursive: true });
	rmSync(join(vaultDir, '.obsidian/workspace.json'), { force: true });
	const port = 9700 + Math.floor(Math.random() * 1000);
	const proc = spawn(ELECTRON, ['--ozone-platform=headless', '--disable-gpu', `--user-data-dir=${join(work, 'profile')}`, `--remote-debugging-port=${port}`, ASAR], { stdio: 'ignore' });
	const errors = [];
	const targets = async () => {
		for (let i = 0; i < 80; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); if (l.length) return l; } catch { /* starting */ } await sleep(250); }
		throw new Error('Obsidian did not start');
	};
	let list = await targets(), page = list.find((t) => t.type === 'page');
	if (page.url.includes('starter')) {
		const st = await connect(page.webSocketDebuggerUrl, () => {});
		await st.send('Runtime.evaluate', { expression: `require('electron').ipcRenderer.sendSync('vault-open', ${JSON.stringify(vaultDir)}, false)` });
		for (let i = 0; i < 60; i++) { await sleep(300); list = await targets(); page = list.find((t) => t.type === 'page' && !t.url.includes('starter')); if (page) break; }
		st.ws.close();
	}
	const { ws, send } = await connect(page.webSocketDebuggerUrl, (d) => {
		if (d.method === 'Runtime.exceptionThrown') errors.push('exception: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text));
		if (d.method === 'Runtime.consoleAPICalled' && (d.params.type === 'error' || d.params.type === 'warning' || d.params.type === 'assert')) errors.push(`console.${d.params.type}: ` + d.params.args.map((a) => a.value ?? a.description).join(' '));
	});
	await send('Runtime.enable');
	await send('Page.enable');
	await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
	const ev = async (expr) => {
		const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
		if (r.error) throw new Error('evaluate: ' + r.error.message);
		if (r.result.exceptionDetails) throw new Error((r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text).split('\n').slice(0, 3).join(' | '));
		return r.result.result?.value;
	};
	for (let i = 0; i < 80 && !(await ev('!!(window.app && app.workspace && app.workspace.layoutReady)').catch(() => false)); i++) await sleep(250);
	await ev(`(async () => { app.plugins.setEnable(true); await app.plugins.loadManifests(); await app.plugins.enablePluginAndSave('evra'); app.changeTheme(${JSON.stringify(theme === 'dark' ? 'obsidian' : 'moonstone')}); })().then(() => 1)`);
	// a fresh vault with plugins asks whether to trust its author: say yes, then close anything left open
	for (let i = 0; i < 20; i++) {
		const done = await ev(`(() => { const b = [...document.querySelectorAll('.modal button')].find(b => /trust/i.test(b.textContent)); if (b) { b.click(); return true; } return false; })()`).catch(() => false);
		if (done) break;
		await sleep(250);
	}
	await sleep(400);
	await ev(`document.querySelectorAll('.modal-close-button').forEach(b => b.click())`).catch(() => {});

	const named = { Escape: ['Escape', 27], Enter: ['Enter', 13], Backspace: ['Backspace', 8], Delete: ['Delete', 46], Tab: ['Tab', 9], ArrowDown: ['ArrowDown', 40], ArrowUp: ['ArrowUp', 38], ArrowLeft: ['ArrowLeft', 37], ArrowRight: ['ArrowRight', 39], '/': ['Slash', 191], '.': ['Period', 190], '?': ['Slash', 191], '+': ['Equal', 187], '=': ['Equal', 187], '-': ['Minus', 189] };
	const mods = { alt: 1, ctrl: 2, meta: 4, shift: 8 };
	let mx = width / 2, my = height / 2;
	const mouse = (type, x, y, extra = {}) => send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1, ...extra });
	const o = {
		ev, send, sleep, errors, width, height, vaultDir,
		async move(x, y, steps = 6, extra = {}) { for (let i = 1; i <= steps; i++) await mouse('mouseMoved', mx + (x - mx) * i / steps, my + (y - my) * i / steps, { button: extra.buttons ? 'left' : 'none', ...extra }); mx = x; my = y; },
		async click(x, y, extra = {}) { await o.move(x, y, 2); await mouse('mousePressed', x, y, extra); await mouse('mouseReleased', x, y, extra); await sleep(60); },
		async dbl(x, y) { await o.move(x, y, 2); for (let i = 0; i < 2; i++) { await mouse('mousePressed', x, y); await mouse('mouseReleased', x, y); await sleep(60); } await sleep(80); },
		async right(x, y) { await o.move(x, y, 2); await mouse('mousePressed', x, y, { button: 'right' }); await mouse('mouseReleased', x, y, { button: 'right' }); await sleep(120); },
		async drag(x0, y0, x1, y1, steps = 14, extra = {}) { await o.move(x0, y0, 2); await mouse('mousePressed', x0, y0, extra); mx = x0; my = y0; await o.move(x1, y1, steps, { buttons: 1, ...extra }); await mouse('mouseReleased', x1, y1, extra); await sleep(120); },
		async wheel(x, y, dy, ctrl = false, dx = 0) { await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x, y, deltaX: dx, deltaY: dy, modifiers: ctrl ? 2 : 0 }); },
		async key(key, ...m) {
			const modifiers = m.reduce((a, k) => a | mods[k], 0);
			const code = named[key] ? named[key][0] : /^[a-z]$/i.test(key) ? 'Key' + key.toUpperCase() : /^[0-9]$/.test(key) ? 'Digit' + key : undefined;
			const vk = named[key] ? named[key][1] : key.length === 1 ? key.toUpperCase().charCodeAt(0) : undefined;
			const text = key.length === 1 && !(modifiers & 2) && !(modifiers & 4) ? key : undefined;
			await send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: vk, text, modifiers });
			await send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: vk, modifiers });
			await sleep(40);
		},
		async type(text) { for (const ch of text) await send('Input.insertText', { text: ch }); await sleep(60); },
		async shot(path) { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path, Buffer.from(r.result.data, 'base64')); },
		/** Centre of the first element matching a selector, or null. */
		async at(sel, i = 0) { return ev(`(() => { const e = document.querySelectorAll(${JSON.stringify(sel)})[${i}]; if (!e) return null; const r = e.getBoundingClientRect(); if (!r.width && !r.height) return null; return {x: r.x + r.width / 2, y: r.y + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height}; })()`); },
		async close() { try { ws.close(); } catch { /* gone */ } proc.kill(); await sleep(300); rmSync(work, { recursive: true, force: true }); },
	};
	return o;
}
