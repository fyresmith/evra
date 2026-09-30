import { esc } from './engine';

/* Small text helpers for card descriptions and note excerpts. */

export const DESC_MAX = 256;

/** The note without its frontmatter. */
export function noteBody(src: string): string {
	const m = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/.exec(src || '');
	return m ? src.slice(m[0].length) : src || '';
}

/** A linked note's preview: its body text, trailing off after DESC_MAX visible characters on a whole word. */
export function noteExcerpt(src: string): string {
	let inFence = false;
	const raw = noteBody(src).split(/\r?\n/).filter((l) => {
		if (/^\s*(```|~~~)/.test(l)) { inFence = !inFence; return false; }
		return !inFence && l.trim() && !l.startsWith('#') && !/^\s*!\[\[/.test(l) && !/^\s*%%/.test(l);
	}).map((l) => l.replace(/^\s*[-*+] (\[.\] )?/, '').replace(/^>\s?/, '')).join(' ');
	let out = '', n = 0;
	for (const part of raw.split(/(\[\[[^\]]+\]\]|\*\*[^*]+\*\*)/)) {
		if (!part) continue;
		const vis = visible(part);
		if (n + vis.length <= DESC_MAX) { out += part; n += vis.length; continue; }
		const room = DESC_MAX - n;
		if (room > 0 && !/^\[\[|^\*\*/.test(part)) out += part.slice(0, room).replace(/\s+\S*$/, ''); // end on a whole word
		return out.trimEnd() + '…';
	}
	return out;
}
// what a link or bold run shows: [[Note|Alias]] shows Alias, [[Note#Heading]] shows Note > Heading
const linkText = (inner: string) => { const [target, alias] = inner.split('|'); return alias || target.replace(/#/g, ' > '); };
const visible = (part: string) => /^\[\[/.test(part) ? linkText(part.slice(2, -2)) : part.replace(/^\*\*|\*\*$/g, '');

export const plainOf = (m: string): string => m.replace(/\[\[([^\]]+)\]\]/g, (_, n: string) => linkText(n)).replace(/\*\*/g, '');

/** Bold, italics and [[links]] as HTML, everything else escaped. */
export function inline(s: string): string {
	return esc(s)
		.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
		.replace(/\*(.+?)\*/g, '<em>$1</em>')
		.replace(/\[\[([^\]]+)\]\]/g, (_, n: string) => `<span class="wl">${linkText(n)}</span>`);
}
