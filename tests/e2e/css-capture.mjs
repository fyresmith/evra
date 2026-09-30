// Computed styles of every element in the timeline across many states, to prove a CSS refactor changes nothing.
//   node tests/e2e/css-capture.mjs out.json [light|dark]
import { writeFileSync } from 'fs';
import { launch } from './driver.mjs';

const out = process.argv[2], theme = process.argv[3] || 'light';
const PROPS = ['display', 'position', 'box-sizing', 'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height', 'top', 'left', 'right', 'bottom',
	'padding-top', 'padding-right', 'padding-bottom', 'padding-left', 'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
	'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width', 'border-top-style', 'border-bottom-style', 'border-left-style', 'border-right-style',
	'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-left-radius', 'border-bottom-right-radius',
	'background-color', 'background-image', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'line-height', 'letter-spacing', 'text-transform', 'text-align', 'text-decoration-line',
	'text-indent', 'text-overflow', 'white-space', 'vertical-align', 'box-shadow', 'outline-style', 'outline-width', 'outline-color', 'outline-offset', 'appearance', 'cursor', 'opacity',
	'transition-property', 'transition-duration', 'animation-name', 'animation-duration', 'transform', 'rotate', 'z-index', 'visibility', 'overflow-x', 'overflow-y', 'gap', 'align-items', 'justify-content',
	'flex-grow', 'flex-shrink', 'flex-basis', 'flex-direction', 'accent-color', 'filter', 'backdrop-filter', 'pointer-events', 'user-select', 'caret-color', 'scrollbar-width', 'list-style-type', 'content', 'inset-inline-start', 'order', 'writing-mode'];
const PSEUDO = ['::before', '::after', '::placeholder', '::-webkit-slider-thumb', '::-webkit-slider-runnable-track', '::-webkit-color-swatch', '::-webkit-scrollbar'];
const p = await launch({ theme });
const A = '.workspace-leaf.mod-active .evra-root';
const grab = (label) => p.ev(`(() => {
	const props = ${JSON.stringify(PROPS)}, pseudo = ${JSON.stringify(PSEUDO)};
	const roots = [...document.querySelectorAll('.evra-root, .evra-embed')];
	const out = {};
	const pathOf = (el) => { const parts = []; while (el && !el.classList?.contains('evra-root') && !el.classList?.contains('evra-embed')) { parts.unshift(el.tagName + (el.dataset?.k ? '[k=' + el.dataset.k + ']' : el.dataset?.m ? '[m=' + el.dataset.m + ']' : '') + ':' + [...el.parentNode.children].indexOf(el)); el = el.parentElement; } return parts.join('>'); };
	roots.forEach((r, ri) => [r, ...r.querySelectorAll('*')].forEach((el) => {
		const cs = getComputedStyle(el); const key = ${JSON.stringify(label)} + '#' + ri + ':' + pathOf(el) + '.' + [...el.classList].sort().join('.');
		out[key] = props.map((k) => cs.getPropertyValue(k)).join('|');
		for (const ps of pseudo) { if (ps.startsWith('::-webkit-s') && !(el.tagName === 'INPUT')) continue; if (ps === '::-webkit-color-swatch' && el.type !== 'color') continue; if (ps === '::placeholder' && !/INPUT|TEXTAREA/.test(el.tagName)) continue;
			const c = getComputedStyle(el, ps); out[key + ps] = props.map((k) => c.getPropertyValue(k)).join('|'); }
	}));
	return out;
})()`);
const all = {};
const add = async (label) => { await p.sleep(450); Object.assign(all, await grab(label)); };
const click = async (sel) => { const b = await p.at(sel); if (b) { await p.click(b.x, b.y); await p.sleep(250); } return !!b; };
await p.ev(`app.workspace.getLeaf(false).openFile(app.vault.getAbstractFileByPath('Chronicle of Veld.evra')).then(() => 1)`); await p.sleep(1500);
await add('base');
for (const tab of ['calendar', 'formats', 'timeline', 'cards', 'colors', 'notes']) {
	if (!(await p.ev(`!document.querySelector('${A} .sheet')?.hidden`))) await click(`${A} [data-c=settings]`);
	await click(`${A} [data-tab=${tab}]`);
	await p.ev(`(() => { const b = document.querySelector('${A} .sheet-body'); if (b) b.scrollTop = 0; return 1; })()`);
	await add('sheet-' + tab);
	await p.ev(`(() => { const b = document.querySelector('${A} .sheet-body'); if (b) b.scrollTop = 99999; return 1; })()`);
	await add('sheet-' + tab + '-end');
}
await p.key('Escape'); await p.sleep(200);
await click(`${A} [data-c=settings]`); await p.sleep(100);
if (await p.ev(`!document.querySelector('${A} .sheet')?.hidden`)) { await p.key('Escape'); await p.sleep(200); }
// card menu
await p.ev(`document.querySelector('${A} .evra-card:not(.group) [data-act=menu]')?.click(), 1`); await add('cardmenu');
await p.key('Escape'); await p.sleep(200);
// era editor
await p.ev(`(() => { const e = document.querySelector('${A} [data-era]'); if (e) e.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: e.getBoundingClientRect().x + 5, clientY: e.getBoundingClientRect().y + 5})); return 1; })()`); await add('eramenu');
await p.key('Escape'); await p.sleep(200);
// context menu on empty space
const s = await p.at(`${A} .stage`);
await p.ev(`(() => { const s = document.querySelector('${A} .stage'); const r = s.getBoundingClientRect(); s.dispatchEvent(new MouseEvent('contextmenu', {bubbles: true, clientX: r.x + r.width - 80, clientY: r.y + 200})); return 1; })()`); await add('ctxmenu');
await p.key('Escape'); await p.sleep(200);
// palette and help
await p.click(s.x + s.w - 60, s.y + 40); await p.key('k', 'ctrl'); await p.sleep(200); await p.type?.('Ye'); await add('palette');
await p.key('Escape'); await p.sleep(200);
await p.click(s.x + s.w - 60, s.y + 40); await p.key('?'); await add('help');
await p.key('Escape'); await p.sleep(200);
// editing a card
await p.ev(`(() => { const c = document.querySelector('${A} .evra-card:not(.group) .dt'); const r = c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('dblclick', {bubbles: true, clientX: r.x + 5, clientY: r.y + 5})); return 1; })()`); await add('editing');
await p.key('Escape'); await p.sleep(200);
// mid-drag
const c = await p.at(`${A} .evra-card:not(.group) .dt`);
await p.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: c.x, y: c.y, button: 'left', clickCount: 1 });
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x + 5, y: c.y + 40, button: 'left' });
await p.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c.x + 8, y: c.y + 80, button: 'left' });
await add('dragging');
await p.key('Escape'); await p.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: c.x + 8, y: c.y + 80, button: 'left', clickCount: 1 }); await p.sleep(200);
// reduced motion
await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
await add('reduced');
await p.send('Emulation.setEmulatedMedia', { features: [] });
// narrow + horizontal
await p.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: false }); await p.sleep(600); await add('phone');
await p.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }); await p.sleep(400);
await p.ev(`app.commands.executeCommandById('evra:direction-ltr')`); await add('ltr');
await p.ev(`app.commands.executeCommandById('evra:direction-ttb')`);
// embed in reading view
await p.ev(`app.vault.create('EmbedCss.md', '\\u0060\\u0060\\u0060evra\\ntimeline: Chronicle of Veld\\n\\u0060\\u0060\\u0060\\n').then(() => 1)`);
await p.ev(`app.workspace.getLeaf(false).setViewState({type: 'markdown', state: {file: 'EmbedCss.md', mode: 'preview'}}).then(() => 1)`); await add('embed');
writeFileSync(out, JSON.stringify(all));
console.log(out, Object.keys(all).length, 'entries');
await p.close();
