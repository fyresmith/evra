import { mountTimeline } from '../../src/timeline';
import { SAMPLE_NOTES, sampleDoc } from '../../src/model';
import type { TimelineHost } from '../../src/host';

const notes: Record<string, string> = { ...SAMPLE_NOTES };
const fm = (src: string): Record<string, unknown> => {
	const m = /^---\n([\s\S]*?)\n---/.exec(src); const o: Record<string, unknown> = {};
	if (m) m[1].split('\n').forEach((l) => { const k = /^([^:]+):\s*(.*)$/.exec(l); if (k) o[k[1].trim()] = k[2]; });
	return o;
};
// ?slow: every note lookup costs about what Obsidian's link resolution does (a few microseconds), and calls are counted
const slow = new URLSearchParams(location.search).has('slow');
const calls = { n: 0 };
(window as unknown as { calls: typeof calls }).calls = calls;
const cost = () => { calls.n++; if (slow) { const t = performance.now(); while (performance.now() - t < 0.003) { /* spin */ } } };
const c = <T>(v: () => T): T => { cost(); return v(); };
const host: TimelineHost = {
	requestSave: () => {}, saveViewState: () => {}, fileName: () => 'Chronicle of Veld',
	noteExists: (l) => c(() => l in notes), noteTitle: (l) => c(() => l.split('/').pop()), noteText: (l) => c(() => notes[l] ?? null), noteStamp: () => c(() => 1),
	noteProps: (l) => c(() => fm(notes[l] || '')), noteLinks: (l) => c(() => [...(notes[l] || '').matchAll(/\[\[([^\]|#]+)/g)].map((m) => m[1].toLowerCase())),
	coverOf: (l) => c(() => (l === 'The Heron' ? 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 70"><rect width="240" height="70" fill="#254f63"/><path d="M84 48 H146 L138 56 H92z" fill="#c9a36b"/></svg>') : null)),
	openNote: (l) => console.log('open', l), hoverNote: () => {}, createNote: async (t) => t, pickNote: () => {},
	searchNotes: (q) => Object.keys(notes).filter((n) => n.toLowerCase().includes(q)).map((n) => ({ link: n, title: n })),
	candidateNotes: (ex) => Object.keys(notes).filter((n) => !ex.has(n)).map((n) => ({ link: n, title: n, props: fm(notes[n]) })),
	linksFromDrop: () => [], sameNote: (a, b) => a === b, syncNotes: () => {}, stripSyncedProps: async () => 0,
	saveDefaults: async () => {}, newTimeline: () => {}, sampleTimeline: () => {}, saveAsNote: async () => {},
};
const root = document.querySelector('.view-content') as HTMLElement;
const W = (window as unknown as { AERTH?: { doc: ReturnType<typeof sampleDoc>; notes: Record<string, string> } }).AERTH;
if (W) Object.assign(notes, W.notes);
const doc = W ? W.doc : sampleDoc();
const n = Number(new URLSearchParams(location.search).get('n') || 0);
for (let i = 0; i < n; i++) doc.events.push({ id: 'x' + i, t: Math.floor(Math.random() * 80 * 360), side: Math.random() < 0.5 ? 'a' : 'b', title: 'Event ' + i, text: i % 3 ? 'Something happened here, briefly.' : '', color: String(1 + (i % 6)), file: null, ...(i % 17 === 0 ? { end: Math.floor(Math.random() * 80 * 360) + 400 } : {}) });
doc.events.forEach((e) => { if (e.end != null && e.end <= e.t) e.end = e.t + 400; });
const tl = mountTimeline(root, host, doc, () => {});
(window as unknown as { tl: typeof tl }).tl = tl;
