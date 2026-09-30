import { sanitizeHTMLToDom } from 'obsidian';

/* DOM helpers. HTML strings are built with every value escaped, then parsed through Obsidian's sanitizer. */

export function setHTML(el: HTMLElement, html: string): void {
	el.empty();
	el.appendChild(sanitizeHTMLToDom(html));
}

/** The first element for a selector, typed. */
export const q1 = <T extends Element = HTMLElement>(p: ParentNode, s: string): T => p.querySelector<T>(s);
export const qa = <T extends Element = HTMLElement>(p: ParentNode, s: string): T[] => Array.from(p.querySelectorAll<T>(s));

/** The nearest element from an event target, or null (for text nodes and windows). */
export function closest<T extends Element = HTMLElement>(t: EventTarget | null, sel: string): T | null {
	return t && (t as Element).closest ? (t as Element).closest<T>(sel) : null;
}
export const attr = (t: EventTarget | null, name: string): string | null =>
	t && (t as Element).getAttribute ? (t as Element).getAttribute(name) : null;

export type SvgEl = SVGElement;
/** A new SVG element with attributes and an optional inline style. */
export function svgEl(tag: keyof SVGElementTagNameMap, attrs: Record<string, string | number>, style?: string): SvgEl {
	const el = createSvg(tag);
	for (const k in attrs) el.setAttribute(k, String(attrs[k]));
	if (style) el.setAttribute('style', style);
	return el;
}
