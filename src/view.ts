import { Keymap, Notice, Scope, TextFileView, TFile, type WorkspaceLeaf, type ViewStateResult } from 'obsidian';
import { makeEngine } from './engine';
import type { TimelineHost } from './host';
import { emptyDoc, mergeDocs, normDoc } from './model';
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
	private ownWrites = new Map<string, ReturnType<typeof desiredProps>>();
	private base: string | null = null;
	private stranded: { base: string; ours: string } | null = null; // unsaved changes while the file on disk can't be read // the file as last loaded or saved, to tell unsaved changes from outside ones

	constructor(leaf: WorkspaceLeaf, private plugin: EvraPlugin) {
		super(leaf);
		// Not plain text: Obsidian then leaves the file out of its word count and never tries to merge outside edits line by line (like Canvas)
		(this as unknown as { isPlaintext: boolean }).isPlaintext = false;
		// Keys Obsidian would otherwise take for its own commands while a timeline has focus
		this.scope = new Scope(this.app.scope);
		const typing = () => { const a = activeDocument.activeElement as HTMLElement; return !!a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
		this.scope.register(['Mod'], 'k', () => { if (typing()) return true; this.timeline?.run('search'); return false; });
		this.scope.register(['Mod'], 'd', () => { if (typing()) return true; this.timeline?.run('duplicate'); return false; }); // Obsidian's editor uses it to delete a paragraph
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
		// links resolve relative to the timeline file, so a different file starts with an empty cache
		if (clear || this.resolvedFor !== (this.file ? this.file.path : null)) this.forget();
		this.resolvedFor = this.file ? this.file.path : null;
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
				// Unsaved changes here are kept aside (never written over the broken file) and merged into the next valid version
				if (clear) this.stranded = null;
				else if (this.timeline && this.base != null) {
					this.timeline.flush();
					const ours = JSON.stringify({ format: 'evra', version: 1, ...this.timeline.getDoc() }); // as saved, so key order matches
					let same = false;
					try { same = JSON.stringify({ format: 'evra', version: 1, ...normDoc(JSON.parse(this.base), name) }) === ours; } catch { /* base unreadable */ }
					if (!same) this.stranded = { base: this.base, ours };
				}
				this.broken = data;
				this.showError();
				return;
			}
		}
		if (clear) this.stranded = null;
		const stranded = this.stranded;
		this.stranded = null;
		const base = stranded ? stranded.base : this.base;
		this.base = data;
		if (stranded) {
			try {
				doc = normDoc(mergeDocs(normDoc(JSON.parse(base), name), JSON.parse(stranded.ours), doc), name);
				this.requestSave();
				new Notice(`“${name}” can be read again. The changes you hadn’t saved were kept.`);
			} catch { /* base unreadable: take the new version */ }
		}
		if (!this.timeline || clear) { this.mount(doc); this.seedWanted(doc); return; }
		// Changed outside (another editor, a sync service) while this copy had unsaved changes: Obsidian would drop them, so
		// merge the two, card by card
		this.timeline.flush();
		const ours = this.timeline.getDoc();
		let baseDoc: EvraDoc = null;
		try { baseDoc = base != null ? normDoc(JSON.parse(base), name) : null; } catch { /* base unreadable: take the outside version */ }
		const canon = (d: EvraDoc) => JSON.stringify({ format: 'evra', version: 1, ...d }); // as saved, so key order matches
		if (baseDoc && canon(baseDoc) !== canon(ours) && canon(ours) !== canon(doc)) {
			doc = normDoc(mergeDocs(baseDoc, JSON.parse(JSON.stringify(ours)), doc), name);
			this.requestSave();
			new Notice(`“${name}” changed on disk while it had unsaved changes here. Both sets of changes were kept.`);
		}
		this.timeline.setDoc(doc);
		this.seedWanted(this.timeline.getDoc());
	}

	async save(clear?: boolean): Promise<void> {
		const p = super.save(clear);
		if (typeof this.data === 'string' && this.broken == null) this.base = this.data; // set as the save starts
		await p;
	}

	clear(): void { /* setViewData(…, true) replaces the timeline */ }

	/** The timeline file itself moved: its links resolve from the new folder now. */
	async onRename(file: TFile): Promise<void> {
		await super.onRename(file);
		this.resolvedFor = file.path;
		this.linksChanged();
	}

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
		if (this.stranded) this.contentEl.createEl('p', { text: 'Changes you hadn’t saved are kept, and come back when the file can be read again.' });
	}

	/** Other panes showing the same file get each change at once, so neither drops the other's unsaved edits when the
	    file is saved. Their own undo history is cleared, as it would be by an outside change. */
	private shareDoc() {
		const others = this.file && this.timeline ? this.app.workspace.getLeavesOfType(VIEW_TYPE).map((l) => l.view)
			.filter((v): v is EvraView => v instanceof EvraView && v !== this && v.file === this.file && !!v.timeline) : [];
		if (!others.length) return;
		const json = JSON.stringify(this.timeline.getDoc());
		for (const v of others) { v.timeline.setDoc(JSON.parse(json) as EvraDoc); v.updateUndo(); }
	}

	private updateUndo() {
		this.undoBtn?.toggleClass('is-disabled', !this.timeline?.canUndo());
		this.redoBtn?.toggleClass('is-disabled', !this.timeline?.canRedo());
	}

	/** Finish any card being edited and write everything to disk, before the view lets go of its file. */
	private async flush() {
		if (!this.timeline || this.broken != null) return;
		this.timeline.flush();
		await this.save();
	}

	async onClose(): Promise<void> {
		window.clearTimeout(this.syncT);
		await this.flush();
		for (const [k, w] of this.plugin.propWrites) if (w.view === this) this.plugin.propWrites.delete(k);
		this.timeline?.destroy();
		this.timeline = null;
		await super.onClose();
	}

	async onUnloadFile(file: TFile): Promise<void> {
		await this.flush();
		await super.onUnloadFile(file);
		this.timeline?.destroy();
		this.timeline = null;
		this.forget();
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
	private resolvedFor: string | null = null; // the timeline path the cache was filled for
	private resolve(link: string): TFile | null {
		let f = this.resolved.get(link);
		if (f === undefined) {
			f = this.app.metadataCache.getFirstLinkpathDest(link.split('|')[0].split('#')[0], this.file ? this.file.path : ''); // [[Note#Heading|alias]] is still Note
			this.resolved.set(link, f);
		}
		return f;
	}
	private forget() { this.resolved.clear(); this.firstCard = null; }
	// The first card linked to each note, so a burst of note changes (thousands, as a vault syncs) doesn't search every card
	// for each. Rebuilt after any edit (links may have changed) or when links resolve anew.
	private firstCard: Map<TFile, EvraEvent> | null = null;
	private firstCardFor: EvraEvent[] | null = null;
	private cardFor(file: TFile): EvraEvent | undefined {
		if (!this.timeline) return undefined;
		const evs = this.timeline.getDoc().events;
		if (!this.firstCard || this.firstCardFor !== evs) {
			this.firstCard = new Map(); this.firstCardFor = evs;
			for (const e of evs) { const f = e.file && this.resolve(e.file); if (f && !this.firstCard.has(f)) this.firstCard.set(f, e); }
		}
		return this.firstCard.get(file);
	}
	/** Does this timeline show the note? */
	linksTo(file: TFile): boolean { return !!this.cardFor(file); }
	/** Files were created, renamed or deleted: links may point somewhere else now. */
	linksChanged() {
		this.forget();
		this.timeline?.notesChanged();
	}
	private linkFor(f: TFile): string {
		return this.app.metadataCache.fileToLinktext(f, this.file ? this.file.path : '', true);
	}
	// notes that other timeline files link or sync, so "create cards from notes" leaves them to those timelines; read at most every 5 s
	private others = new Set<string>();
	private othersAt = 0;
	private refreshOthers() {
		if (Date.now() - this.othersAt < 5000) return;
		this.othersAt = Date.now();
		const app = this.app, mine = this.file ? this.file.path : '';
		void Promise.all(app.vault.getFiles().filter((f) => f.extension === 'evra' && f.path !== mine).map(async (f) => {
			try {
				const d = JSON.parse(await app.vault.cachedRead(f)) as Partial<EvraDoc>, out: string[] = [];
				for (const e of Array.isArray(d.events) ? d.events : []) {
					const n = e && typeof e.file === 'string' ? app.metadataCache.getFirstLinkpathDest(e.file.split(/[#|]/)[0], f.path) : null;
					if (n) out.push(n.path);
				}
				const synced = d.opts?.sync?.notes;
				if (Array.isArray(synced)) out.push(...synced.filter((p): p is string => typeof p === 'string'));
				return out;
			} catch { return []; } // an unreadable timeline claims nothing
		})).then((r) => { this.others = new Set(r.flat()); });
	}
	private folder(): string {
		return this.file && this.file.parent ? this.file.parent.path : '';
	}

	private makeHost(): TimelineHost {
		const app = this.app, plugin = this.plugin;
		const fmOf = (f: TFile) => app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined;
		return {
			requestSave: () => { this.firstCard = null; this.requestSave(); this.updateUndo(); this.shareDoc(); },
			saveViewState: () => app.workspace.requestSaveLayout(),
			fileName: () => (this.file ? this.file.basename : 'Timeline'),
			noteExists: (link) => !!this.resolve(link),
			noteTitle: (link) => { const f = this.resolve(link); return f ? f.basename : link.split('|')[0].split('#')[0].split('/').pop(); },
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
				const taken = new Set([...exclude].map((l) => this.resolve(l)?.path).filter(Boolean)), dir = this.folder();
				this.refreshOthers();
				const out: { link: string; title: string; props: Record<string, unknown>; near: boolean; elsewhere: boolean }[] = [];
				for (const f of app.vault.getMarkdownFiles()) {
					if (taken.has(f.path)) continue;
					const fm = fmOf(f);
					if (fm) out.push({ link: this.linkFor(f), title: f.basename, props: fm, near: !dir || f.path.startsWith(dir + '/'), elsewhere: this.others.has(f.path) });
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
	private wanted = new Map<string, string>(); // the properties this timeline last wanted each note to have

	/** What each note's properties should be now, for the notes this timeline links to or has written to. */
	private desiredWrites(doc: EvraDoc): { writes: [TFile, ReturnType<typeof desiredProps>][]; linked: string[] } {
		const E = makeEngine(() => doc);
		const byNote = new Map<string, { file: TFile; ev: EvraEvent }>();
		[...doc.events].sort((a, b) => a.t - b.t).forEach((e) => {
			if (!e.file) return;
			const f = this.resolve(e.file);
			if (f && !byNote.has(f.path)) byNote.set(f.path, { file: f, ev: e });
		});
		const writes: [TFile, ReturnType<typeof desiredProps>][] = [];
		for (const { file, ev } of byNote.values()) writes.push([file, desiredProps(doc, E, ev)]);
		for (const path of doc.opts.sync.notes || []) {
			if (byNote.has(path)) continue;
			const f = this.app.vault.getFileByPath(path);
			if (f) writes.push([f, desiredProps(doc, E, null)]); // unlinked notes lose their timeline properties
		}
		return { writes, linked: [...byNote.keys()] };
	}

	/** Remember what the timeline wants as it opens, so only later changes to it count as changes. */
	private seedWanted(doc: EvraDoc) {
		this.wanted.clear();
		if (!doc.opts.sync.on) return;
		for (const [f, props] of this.desiredWrites(doc).writes) this.wanted.set(f.path, JSON.stringify(props));
	}

	private async syncNotes(doc: EvraDoc) {
		const sy = doc.opts.sync;
		if (!sy || !sy.on || this.timeline?.getDoc() !== doc) return;
		const { writes, linked } = this.desiredWrites(doc), shared = this.plugin.propWrites;
		for (const [file, props] of writes) {
			const key = JSON.stringify(props), same = this.wanted.get(file.path) === key;
			this.wanted.set(file.path, key);
			const fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
			if (!needsWrite(fm, props)) continue;
			// Another open timeline wrote this note since, and this timeline's card for it hasn't changed: leave the note as it
			// is. Otherwise every edit in either timeline would rewrite the notes they share, and move the other's cards.
			const last = shared.get(file.path);
			if (same && last && last.view !== this && !needsWrite(fm, last.props)) continue;
			try {
				await this.app.fileManager.processFrontMatter(file, (m: Record<string, unknown>) => { applyProps(m, props); });
				this.ownWrites.set(file.path, props); shared.set(file.path, { view: this, props });
			} catch (err) { console.error('Evra: couldn’t update the properties of', file.path, err); }
		}
		const written = liveFields(doc).map((x) => x[1]);
		if (JSON.stringify([written, linked]) !== JSON.stringify([sy.written, sy.notes])) {
			sy.written = written; sy.notes = linked;
			this.requestSave();
		}
	}

	private async stripSyncedProps(doc: EvraDoc): Promise<number> {
		const sy = doc.opts.sync;
		const keys = new Set([...(sy.written || []), ...liveFields(doc).map((x) => x[1])].filter(Boolean)); // only properties Evra writes, never ones it merely could
		const paths = new Set(sy.notes || []);
		doc.events.forEach((e) => { const f = e.file && this.resolve(e.file); if (f) paths.add(f.path); });
		let n = 0;
		for (const p of paths) {
			const f = this.app.vault.getFileByPath(p), fm = f && (this.app.metadataCache.getFileCache(f)?.frontmatter as Record<string, unknown> | undefined);
			if (!f || !fm || ![...keys].some((k) => k in fm)) continue;
			try { await this.app.fileManager.processFrontMatter(f, (m: Record<string, unknown>) => { keys.forEach((k) => delete m[k]); }); n++; }
			catch (err) { console.error('Evra: couldn’t update the properties of', f.path, err); }
		}
		sy.written = []; sy.notes = [];
		this.requestSave();
		return n;
	}

	/** A linked note changed: its text may show on a card, and its properties may move one. */
	noteChanged(file: TFile) {
		const ev = this.cardFor(file);
		if (!ev) return;
		// Evra's own property writes come back as metadata changes a moment later, by which time the card may have
		// moved again: those must not move it back
		const own = this.ownWrites.get(file.path), fm = this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined;
		if (own && !needsWrite(fm, own)) { this.timeline.notesChanged(); return; }
		this.ownWrites.delete(file.path);
		this.timeline.noteChanged(ev.file);
	}

	// A burst of renames (moving a folder renames each note in it) is taken as one: where links pointed before the first,
	// and the undo history fixed once at the end
	private renameBefore: Map<string, TFile | null> | null = null;
	private relinks = new Map<string, string>(); // old link → new

	/** A note was renamed or moved: point cards that linked to it at its new name. Returns true when something changed. */
	noteRenamed(file: TFile, oldPath: string): boolean {
		const before = this.renameBefore ??= new Map(this.resolved); // the TFile object is the same one, renamed
		this.forget();
		if (!this.timeline) return false;
		const doc = this.timeline.getDoc();
		let changed = false;
		const link = this.linkFor(file);
		doc.events.forEach((e) => {
			if (!e.file || !linkMatchesPath(e.file, oldPath)) return;
			// the link named the old path; keep it pointing at this note unless it now names a different one
			const now = this.resolve(e.file), was = before.get(e.file);
			// it pointed at this note before (even if a same-named note now answers to the old link); a bare name never looked up is
			// taken to mean the moved note; or it no longer points anywhere else
			if ((was === file || (was === undefined && !e.file.includes('/')) || !now || now === file) && e.file !== link) {
				for (const [k, v] of this.relinks) if (v === e.file) this.relinks.set(k, link); // renamed twice in one burst
				this.relinks.set(e.file, link);
				e.file = link; changed = true;
			}
		});
		if (doc.opts.sync.notes) doc.opts.sync.notes = doc.opts.sync.notes.map((p) => (p === oldPath ? file.path : p));
		const w = this.wanted.get(oldPath);
		if (w != null) { this.wanted.delete(oldPath); this.wanted.set(file.path, w); }
		if (changed) { this.requestSave(); this.timeline.notesChanged(); }
		return changed;
	}

	/** The burst of renames is over. */
	renamesDone() {
		this.renameBefore = null;
		const moves = new Map(this.relinks);
		this.relinks.clear();
		if (this.timeline && moves.size) this.timeline.relinkHistory(moves);
	}
}

/** Did a link (a path or a name, without ".md") point at the note that used to live at oldPath? */
export function linkMatchesPath(link: string, oldPath: string): boolean {
	const l = link.split('|')[0].split('#')[0].replace(/\.md$/, ''), p = oldPath.replace(/\.md$/, '');
	return p === l || p.endsWith('/' + l);
}
