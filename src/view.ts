import { Keymap, Notice, Scope, TextFileView, TFile, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { makeEngine } from './engine';
import type { TimelineHost } from './host';
import { emptyDoc, normDoc } from './model';
import { applyProps, desiredProps, liveFields, needsWrite } from './sync';
import { mountTimeline, type Timeline, type ViewState } from './timeline';
import type EvraPlugin from './main';
import { NotePicker } from './picker';
import type { EvraDoc, EvraEvent, TimelineDefaults } from './types';

export const VIEW_TYPE = 'evra';

interface EvraViewState extends Record<string, unknown> { evraView?: ViewState }

/** A .evra file, shown as a timeline. The file holds the document as JSON; the zoom and scroll live in the workspace. */
export class EvraView extends TextFileView {
	timeline: Timeline = null;
	private broken: string | null = null; // the file's text when it couldn't be read, so it is never overwritten
	private pendingView: ViewState | null = null;
	private undoBtn: HTMLElement;
	private redoBtn: HTMLElement;
	private syncT = 0;

	constructor(leaf: WorkspaceLeaf, private plugin: EvraPlugin) {
		super(leaf);
		// Not plain text: Obsidian then leaves the file out of its word count and never tries to merge outside edits line by line (like Canvas)
		(this as unknown as { isPlaintext: boolean }).isPlaintext = false;
		// Keys Obsidian would otherwise take for its own commands while a timeline has focus
		this.scope = new Scope(this.app.scope);
		this.scope.register(['Mod'], 'k', () => { this.timeline?.run('search'); return false; });
		this.scope.register(['Mod'], 'd', () => { this.timeline?.run('duplicate'); return false; }); // Obsidian's editor uses it to delete a paragraph
		this.redoBtn = this.addAction('redo-2', 'Redo', () => this.timeline?.redo());
		this.undoBtn = this.addAction('undo-2', 'Undo', () => this.timeline?.undo());
		this.updateUndo();
	}

	getViewType(): string { return VIEW_TYPE; }
	getIcon(): string { return 'evra'; }
	getDisplayText(): string { return this.file ? this.file.basename : 'Timeline'; }

	getViewData(): string {
		if (this.broken != null || !this.timeline) return this.broken ?? this.data;
		return JSON.stringify({ format: 'evra', version: 1, ...this.timeline.getDoc() }, null, '\t');
	}

	setViewData(data: string, clear: boolean): void {
		let doc: EvraDoc;
		const name = this.file ? this.file.basename : 'Untitled';
		if (!data.trim()) {
			doc = emptyDoc(name, this.plugin.settings.defaults);
			this.broken = null;
			this.requestSave();
		} else {
			try {
				doc = normDoc(JSON.parse(data), name);
				this.broken = null;
			} catch {
				this.broken = data;
				this.showError();
				return;
			}
		}
		if (!this.timeline || clear) this.mount(doc);
		else this.timeline.setDoc(doc);
	}

	clear(): void { /* setViewData(…, true) replaces the timeline */ }

	private mount(doc: EvraDoc) {
		this.timeline?.destroy();
		this.contentEl.empty();
		this.contentEl.removeClass('evra-error');
		this.timeline = mountTimeline(this.contentEl, this.makeHost(), doc, () => this.updateUndo());
		if (this.pendingView) { this.timeline.setViewState(this.pendingView); this.pendingView = null; }
		this.updateUndo();
	}

	private showError() {
		this.timeline?.destroy();
		this.timeline = null;
		this.contentEl.empty();
		this.contentEl.addClass('evra-error');
		this.contentEl.createEl('p', { text: 'This timeline file couldn’t be read. It isn’t valid JSON, so it has been left untouched.' });
		this.contentEl.createEl('p', { text: 'Open it in another editor to fix it, or restore it from a backup or the file recovery core plugin.' });
	}

	private updateUndo() {
		this.undoBtn?.toggleClass('is-disabled', !this.timeline?.canUndo());
		this.redoBtn?.toggleClass('is-disabled', !this.timeline?.canRedo());
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.syncT);
		this.timeline?.destroy();
		this.timeline = null;
		await super.onClose();
	}

	async onUnloadFile(file: TFile): Promise<void> {
		await super.onUnloadFile(file);
		this.timeline?.destroy();
		this.timeline = null;
		this.contentEl.empty();
	}

	getState(): Record<string, unknown> {
		const st = super.getState();
		const v = this.timeline?.getViewState();
		if (v) st.evraView = v;
		return st;
	}

	async setState(state: unknown, result: ViewStateResult): Promise<void> {
		const v = (state as EvraViewState)?.evraView;
		if (v) { if (this.timeline) this.timeline.setViewState(v); else this.pendingView = v; }
		await super.setState(state, result);
	}

	setEphemeralState(state: unknown): void {
		const s = state as { evraFocus?: string };
		if (s && s.evraFocus) this.timeline?.focusEvent(s.evraFocus);
		super.setEphemeralState(state);
	}

	onResize(): void { this.timeline?.notesChanged(); }

	/* ---------- notes ---------- */
	// Link resolution is cached: a large timeline asks for the same notes many times a frame
	private resolved = new Map<string, TFile | null>();
	private resolve(link: string): TFile | null {
		let f = this.resolved.get(link);
		if (f === undefined) {
			f = this.app.metadataCache.getFirstLinkpathDest(link, this.file ? this.file.path : '');
			this.resolved.set(link, f);
		}
		return f;
	}
	/** Does this timeline show the note? */
	linksTo(file: TFile): boolean {
		return !!this.timeline && this.timeline.getDoc().events.some((e) => e.file && this.resolve(e.file) === file);
	}
	/** Files were created, renamed or deleted: links may point somewhere else now. */
	linksChanged() {
		this.resolved.clear();
		this.timeline?.notesChanged();
	}
	private linkFor(f: TFile): string {
		return this.app.metadataCache.fileToLinktext(f, this.file ? this.file.path : '', true);
	}
	private folder(): string {
		return this.file && this.file.parent ? this.file.parent.path : '';
	}

	private makeHost(): TimelineHost {
		const app = this.app, plugin = this.plugin;
		const fmOf = (f: TFile) => app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined;
		return {
			requestSave: () => { this.requestSave(); this.updateUndo(); },
			saveViewState: () => app.workspace.requestSaveLayout(),
			fileName: () => (this.file ? this.file.basename : 'Timeline'),
			noteExists: (link) => !!this.resolve(link),
			noteTitle: (link) => { const f = this.resolve(link); return f ? f.basename : link.split('/').pop().split('|')[0]; },
			noteText: (link) => { const f = this.resolve(link); return f ? plugin.notes.text(f) : null; },
			noteStamp: (link) => { const f = this.resolve(link); return f ? plugin.notes.stamp(f) : -1; },
			noteProps: (link) => { const f = this.resolve(link); return f ? fmOf(f) || {} : null; },
			noteLinks: (link) => {
				const f = this.resolve(link), c = f && app.metadataCache.getFileCache(f);
				if (!c) return [];
				return [...(c.links || []), ...(c.frontmatterLinks || [])].map((l) => {
					const d = app.metadataCache.getFirstLinkpathDest(l.link.split('#')[0], f.path);
					return (d ? d.basename : l.link.split('#')[0].split('/').pop()).toLowerCase();
				});
			},
			coverOf: (link) => { const f = this.resolve(link); return f ? plugin.notes.cover(f) : null; },
			openNote: (link, evt) => { void this.openNote(link, evt); },
			hoverNote: (evt, target, link) => {
				app.workspace.trigger('hover-link', { event: evt, source: VIEW_TYPE, hoverParent: this, targetEl: target, linktext: link, sourcePath: this.file ? this.file.path : '' });
			},
			createNote: async (title, text) => {
				const f = await plugin.createNoteFile(plugin.settings.noteFolder.trim() || this.folder(), title, text);
				return f ? this.linkFor(f) : null;
			},
			pickNote: (onPick) => new NotePicker(app, (f) => onPick(this.linkFor(f))).open(),
			searchNotes: (q, limit) => {
				const out: { link: string; title: string }[] = [];
				for (const f of app.vault.getMarkdownFiles()) {
					if (f.basename.toLowerCase().includes(q)) out.push({ link: this.linkFor(f), title: f.basename });
					if (out.length >= limit) break;
				}
				return out;
			},
			candidateNotes: (exclude) => {
				const taken = new Set([...exclude].map((l) => this.resolve(l)?.path).filter(Boolean));
				const out: { link: string; title: string; props: Record<string, unknown> }[] = [];
				for (const f of app.vault.getMarkdownFiles()) {
					if (taken.has(f.path)) continue;
					const fm = fmOf(f);
					if (fm) out.push({ link: this.linkFor(f), title: f.basename, props: fm });
				}
				return out;
			},
			linksFromDrop: (e) => plugin.filesFromDrop(e).map((f) => this.linkFor(f)),
			sameNote: (a, b) => { if (a === b) return true; const fa = this.resolve(a), fb = this.resolve(b); return !!fa && fa === fb; },
			syncNotes: (doc) => {
				window.clearTimeout(this.syncT);
				this.syncT = window.setTimeout(() => { void this.syncNotes(doc); }, 600);
			},
			stripSyncedProps: (doc) => this.stripSyncedProps(doc),
			saveDefaults: async (d: TimelineDefaults) => { plugin.settings.defaults = d; await plugin.saveSettings(); },
			newTimeline: () => { void plugin.createTimeline(this.folder()); },
			sampleTimeline: () => { void plugin.createSample(); },
			saveAsNote: async (name, content) => {
				const f = await plugin.createNoteFile(this.folder(), name, content, true);
				if (f) await app.workspace.getLeaf('tab').openFile(f);
			},
		};
	}

	private async openNote(link: string, evt?: MouseEvent | KeyboardEvent) {
		const f = this.resolve(link);
		if (!f) { new Notice(`“${link}” doesn’t exist yet.`); return; }
		await this.plugin.openInSideLeaf(f, this.leaf, evt ? Keymap.isModEvent(evt) : false);
	}

	/* Timeline properties in linked notes. Only notes this timeline links to, or has written to before, are touched. */
	private async syncNotes(doc: EvraDoc) {
		const sy = doc.opts.sync;
		if (!sy || !sy.on || this.timeline?.getDoc() !== doc) return;
		const E = makeEngine(() => doc);
		const byNote = new Map<string, { file: TFile; ev: EvraEvent }>();
		[...doc.events].sort((a, b) => a.t - b.t).forEach((e) => {
			if (!e.file) return;
			const f = this.resolve(e.file);
			if (f && !byNote.has(f.path)) byNote.set(f.path, { file: f, ev: e });
		});
		const writes: [TFile, ReturnType<typeof desiredProps>][] = [];
		for (const { file, ev } of byNote.values()) writes.push([file, desiredProps(doc, E, ev)]);
		for (const path of sy.notes || []) {
			if (byNote.has(path)) continue;
			const f = this.app.vault.getFileByPath(path);
			if (f) writes.push([f, desiredProps(doc, E, null)]); // unlinked notes lose their timeline properties
		}
		for (const [file, props] of writes) {
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			if (!needsWrite(fm, props)) continue;
			try { await this.app.fileManager.processFrontMatter(file, (m: Record<string, unknown>) => { applyProps(m, props); }); }
			catch (err) { console.error('Evra: couldn’t update the properties of', file.path, err); }
		}
		const written = liveFields(doc).map((x) => x[1]), notes = [...byNote.keys()];
		if (JSON.stringify([written, notes]) !== JSON.stringify([sy.written, sy.notes])) {
			sy.written = written; sy.notes = notes;
			this.requestSave();
		}
	}

	private async stripSyncedProps(doc: EvraDoc): Promise<number> {
		const sy = doc.opts.sync;
		const keys = new Set([...(sy.written || []), ...Object.values(sy.fields).map((f) => f.key.trim())].filter(Boolean));
		const paths = new Set(sy.notes || []);
		doc.events.forEach((e) => { const f = e.file && this.resolve(e.file); if (f) paths.add(f.path); });
		let n = 0;
		for (const p of paths) {
			const f = this.app.vault.getFileByPath(p), fm = f && (this.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined);
			if (!f || !fm || ![...keys].some((k) => k in fm)) continue;
			await this.app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => { keys.forEach((k) => delete m[k]); });
			n++;
		}
		sy.written = []; sy.notes = [];
		this.requestSave();
		return n;
	}

	/** A linked note changed: its text may show on a card, and its properties may move one. */
	noteChanged(file: TFile) {
		if (!this.timeline) return;
		const doc = this.timeline.getDoc();
		const ev = doc.events.find((e) => e.file && this.resolve(e.file) === file);
		if (ev) this.timeline.noteChanged(ev.file);
	}

	/** A note was renamed or moved: point cards that linked to it at its new name. Returns true when something changed. */
	noteRenamed(file: TFile, oldPath: string): boolean {
		this.resolved.clear();
		if (!this.timeline) return false;
		const doc = this.timeline.getDoc();
		let changed = false;
		doc.events.forEach((e) => {
			if (!e.file || !linkMatchesPath(e.file, oldPath)) return;
			// the link named the old path; keep it pointing at this note unless it now names a different one
			const now = this.resolve(e.file), link = this.linkFor(file);
			if ((!now || now === file) && e.file !== link) { e.file = link; changed = true; }
		});
		if (doc.opts.sync.notes) doc.opts.sync.notes = doc.opts.sync.notes.map((p) => (p === oldPath ? file.path : p));
		if (changed) { this.requestSave(); this.timeline.notesChanged(); }
		return changed;
	}
}

/** Did a link (a path or a name, without ".md") point at the note that used to live at oldPath? */
export function linkMatchesPath(link: string, oldPath: string): boolean {
	const l = link.split('|')[0].split('#')[0].replace(/\.md$/, ''), p = oldPath.replace(/\.md$/, '');
	return p === l || p.endsWith('/' + l);
}
