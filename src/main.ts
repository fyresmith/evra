import { addIcon, normalizePath, Notice, Platform, Plugin, TFile, TFolder, type PaneType, type WorkspaceLeaf } from 'obsidian';
import { TIMELINE_COMMANDS } from './commands';
import { renderEmbed } from './embed';
import { checkFormat, emptyDoc, SAMPLE_COVER, SAMPLE_NOTES, sampleDoc } from './model';
import { NoteCache } from './notes';
import { DEFAULT_SETTINGS, EvraSettingTab, type EvraSettings } from './settings';
import type { PropValue } from './sync';
import { EvraView, linkMatchesPath, VIEW_TYPE } from './view';

// the timeline icon: a line of time with marks on either side
const ICON_SVG = '<path d="M50 9v82M25 28h19M56 50h19M25 72h19" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';

export default class EvraPlugin extends Plugin {
	settings: EvraSettings;
	notes: NoteCache;
	private noteLeaf: WorkspaceLeaf | null = null;
	/** The last timeline properties Evra wrote to each note, and which open timeline wrote them. */
	propWrites = new Map<string, { view: EvraView; props: Record<string, PropValue> }>();
	private redrawT = 0;
	private renames: [TFile, string][] = []; // note renames waiting to be applied to closed timelines
	private renamed = new Set<EvraView>(); // open views already told about them
	private renameT = 0;

	async onload() {
		await this.loadSettings();
		this.notes = new NoteCache(this.app, () => this.redrawSoon());
		addIcon('evra', ICON_SVG);

		this.registerView(VIEW_TYPE, (leaf) => new EvraView(leaf, this));
		this.registerExtensions(['evra'], VIEW_TYPE);
		this.registerHoverLinkSource(VIEW_TYPE, { display: 'Evra', defaultMod: false });
		for (const lang of ['evra', 'throughline']) this.registerMarkdownCodeBlockProcessor(lang, (src, el, ctx) => renderEmbed(this, src, el, ctx));
		this.addSettingTab(new EvraSettingTab(this.app, this));

		this.addRibbonIcon('evra', 'New timeline', () => { void this.createTimeline(); });
		this.addCommand({ id: 'new-timeline', name: 'New timeline', callback: () => { void this.createTimeline(); } });
		this.addCommand({ id: 'open-sample', name: 'Open the sample timeline', callback: () => { void this.createSample(); } });
		for (const c of TIMELINE_COMMANDS) {
			this.addCommand({
				id: c.id,
				name: c.name,
				checkCallback: (checking) => {
					const view = this.app.workspace.getActiveViewOfType(EvraView);
					if (!view || !view.timeline) return false;
					if (!checking) view.timeline.run(c.id);
					return true;
				},
			});
		}
		this.registerEvent(this.app.workspace.on('file-menu', (menu, file) => {
			if (!(file instanceof TFolder)) return;
			menu.addItem((item) => item.setTitle('New timeline').setIcon('evra').onClick(() => { void this.createTimeline(file.path); }));
		}));

		// keep cards in step with their notes
		this.registerEvent(this.app.vault.on('modify', (f) => { if (f instanceof TFile && f.extension === 'md') { this.notes.changed(f.path); this.forEachView((v) => { if (v.linksTo(f)) v.timeline?.notesChanged(); }); } }));
		this.registerEvent(this.app.metadataCache.on('changed', (f) => this.forEachView((v) => v.noteChanged(f))));
		this.registerEvent(this.app.vault.on('delete', (f) => { if (f instanceof TFile) { this.notes.changed(f.path); this.forEachView((v) => v.linksChanged()); } }));
		// created files can change where links point; the vault reports every file as created while it loads, so wait for that
		this.app.workspace.onLayoutReady(() => this.registerEvent(this.app.vault.on('create', (f) => { if (f instanceof TFile && f.extension === 'md') this.forEachView((v) => v.linksChanged()); })));
		this.registerEvent(this.app.vault.on('rename', (f, oldPath) => { if (f instanceof TFile && f.extension === 'md') this.noteRenamed(f, oldPath); }));
		this.registerEvent(this.app.workspace.on('css-change', () => this.forEachView((v) => v.timeline?.cssChanged())));
		this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => { if (leaf && leaf.view instanceof EvraView) leaf.view.timeline?.focus(); }));
	}

	onunload() {
		window.clearTimeout(this.redrawT);
		if (this.renames.length) { window.clearTimeout(this.renameT); void this.renamesDone(); } // closed timelines still follow
		this.noteLeaf = null;
	}

	async loadSettings() {
		const data = (await this.loadData()) as Partial<EvraSettings> | null;
		this.settings = { ...DEFAULT_SETTINGS, ...(data || {}) };
	}
	async saveSettings() { await this.saveData(this.settings); }

	private forEachView(fn: (v: EvraView) => void) {
		this.app.workspace.getLeavesOfType(VIEW_TYPE).forEach((l) => { if (l.view instanceof EvraView) fn(l.view); });
	}
	private redrawSoon() {
		window.clearTimeout(this.redrawT);
		this.redrawT = window.setTimeout(() => this.forEachView((v) => v.timeline?.notesChanged()), 80);
	}

	/** A note was renamed: update cards in open timelines now, and in timeline files that aren't open once the burst is over
	    (moving a folder renames every note in it, one event each: each closed timeline is then read and written once). */
	private noteRenamed(file: TFile, oldPath: string) {
		this.notes.renamed(oldPath);
		const w = this.propWrites.get(oldPath);
		if (w) { this.propWrites.delete(oldPath); this.propWrites.set(file.path, w); }
		this.forEachView((v) => { v.noteRenamed(file, oldPath); this.renamed.add(v); });
		this.renames.push([file, oldPath]);
		window.clearTimeout(this.renameT);
		this.renameT = window.setTimeout(() => { void this.renamesDone(); }, 60);
	}

	private async renamesDone() {
		const batch = this.renames, told = this.renamed;
		this.renames = []; this.renamed = new Set();
		const open = new Set<string>();
		this.forEachView((v) => {
			if (v.file) open.add(v.file.path);
			if (!told.has(v)) batch.forEach(([f, old]) => v.noteRenamed(f, old)); // opened from disk after the renames began
			v.renamesDone();
		});
		// every link to a note, and its path in the synced-notes list, contains its old name; as JSON it may be escaped
		const needles = batch.flatMap(([, old]) => { const base = old.split('/').pop().replace(/\.md$/, ''); return [base, JSON.stringify(base).slice(1, -1)]; });
		const dirOf = (p: string) => p.split('/').slice(0, -1).join('/');
		for (const f of this.app.vault.getFiles()) {
			if (f.extension !== 'evra' || open.has(f.path)) continue;
			let text: string;
			try { text = await this.app.vault.cachedRead(f); } catch { continue; }
			if (!needles.some((n) => text.includes(n))) continue; // skip the read-and-parse for timelines that can't mention them
			await this.app.vault.process(f, (data) => {
				let doc: { events?: { file?: string | null }[]; opts?: { sync?: { notes?: string[] } } };
				try { doc = JSON.parse(data) as typeof doc; checkFormat(doc); } catch { return data; } // unreadable, or from a newer Evra: leave it as it is
				if (!doc || typeof doc !== 'object') return data;
				let changed = false;
				const here = dirOf(f.path);
				for (const [file, oldPath] of batch) {
					const link = this.app.metadataCache.fileToLinktext(file, f.path, true);
					(Array.isArray(doc.events) ? doc.events : []).forEach((e) => {
						if (!e || !e.file || !linkMatchesPath(e.file, oldPath) || e.file === link) return;
						// Did this link point at the moved note before the move? A link naming the full old path did. A shorter one
						// (a bare name) may now resolve to another note with the same name; it only pointed at that other note
						// before if Obsidian would have preferred it then: it sits beside the timeline and the old note didn't.
						// When unsure, keep the card on the note it was showing: the one that moved.
						const now = this.app.metadataCache.getFirstLinkpathDest(e.file, f.path);
						const otherWon = now && now !== file && dirOf(now.path) === here && dirOf(oldPath) !== here;
						const fullPath = e.file.split('|')[0].split('#')[0].replace(/\.md$/, '') === oldPath.replace(/\.md$/, '');
						if (fullPath || !otherWon) { e.file = link; changed = true; }
					});
					// as the open view does: the list of notes carrying synced properties follows the rename
					const sn = doc.opts && doc.opts.sync && doc.opts.sync.notes;
					if (Array.isArray(sn) && sn.includes(oldPath)) { doc.opts.sync.notes = sn.map((p) => (p === oldPath ? file.path : p)); changed = true; }
				}
				return changed ? JSON.stringify(doc, null, '\t') : data;
			});
		}
	}

	/** Open a note beside the timeline, reusing the pane opened last time. */
	async openInSideLeaf(file: TFile, from: WorkspaceLeaf, mod: boolean | PaneType) {
		const ws = this.app.workspace;
		let leaf: WorkspaceLeaf = null;
		if (mod) leaf = ws.getLeaf(mod);
		else if (this.settings.openNotesIn === 'split' && !Platform.isPhone) {
			let alive = false;
			ws.iterateRootLeaves((l) => { if (l === this.noteLeaf) alive = true; });
			const prev = alive ? this.noteLeaf : null;
			leaf = prev && prev !== from && prev.view.getViewType() === 'markdown' ? prev : ws.createLeafBySplit(from, 'vertical');
			this.noteLeaf = leaf;
		} else leaf = ws.getLeaf(this.settings.openNotesIn === 'same' ? false : 'tab');
		await leaf.openFile(file);
	}

	/** Dragged from the file explorer, a search result or a link. */
	filesFromDrop(e: DragEvent): TFile[] {
		const dm = (this.app as unknown as { dragManager?: { draggable?: { type?: string; file?: unknown; files?: unknown[] } } }).dragManager;
		const d = dm && dm.draggable;
		const md = (f: unknown): f is TFile => f instanceof TFile && f.extension === 'md';
		if (d && d.type === 'file' && md(d.file)) return [d.file];
		if (d && d.type === 'files' && Array.isArray(d.files)) return d.files.filter(md);
		const txt = e.dataTransfer ? e.dataTransfer.getData('text/plain') : '';
		const out: TFile[] = [];
		for (const line of txt.split(/\r?\n/)) {
			// only the obsidian:// ?file= value is URL-encoded; a wikilink like [[100% done]] is taken as written
			let link = /\[\[([^\]|#]+)/.exec(line)?.[1];
			if (!link) {
				const enc = /[?&]file=([^&]+)/.exec(line)?.[1];
				if (enc) try { link = decodeURIComponent(enc); } catch { link = enc; }
			}
			if (!link) continue;
			const f = this.app.metadataCache.getFirstLinkpathDest(link, '');
			if (md(f)) out.push(f);
		}
		return out;
	}

	private async uniquePath(folder: string, name: string, ext: string) {
		// no leading dots (a hidden file the vault never lists), no trailing dots or spaces (invalid on Windows),
		// and short enough to leave room for the folder, a " 2" suffix and the extension
		const clean = name.replace(/[\\/:*?"<>|#^[\]]/g, '').trim().replace(/^\.+/, '').slice(0, 150).replace(/[. ]+$/, '').trim() || 'Untitled';
		const base = normalizePath(folder ? `${folder}/${clean}` : clean);
		let path = `${base}.${ext}`, k = 2;
		while (this.app.vault.getAbstractFileByPath(path)) path = `${base} ${k++}.${ext}`;
		return path;
	}
	private async ensureFolder(folder: string) {
		if (folder && !this.app.vault.getAbstractFileByPath(normalizePath(folder))) await this.app.vault.createFolder(normalizePath(folder));
	}

	async createNoteFile(folder: string, title: string, text: string, raw = false): Promise<TFile | null> {
		try {
			await this.ensureFolder(folder);
			const path = await this.uniquePath(folder, title, 'md');
			return await this.app.vault.create(path, raw ? text : text ? text + '\n' : '');
		} catch (err) {
			new Notice('Couldn’t create the note. ' + String(err));
			return null;
		}
	}

	/** A new, empty timeline in the given folder (or the one in the settings), opened in a new tab. */
	async createTimeline(folder?: string) {
		const dir = folder ?? (this.settings.newFileFolder.trim() || this.app.fileManager.getNewFileParent(this.app.workspace.getActiveFile()?.path || '').path);
		const at = dir === '/' ? '' : dir;
		await this.ensureFolder(at);
		const path = await this.uniquePath(at, 'Untitled timeline', 'evra');
		const name = path.split('/').pop().replace(/\.evra$/, '');
		const doc = emptyDoc(name, this.settings.defaults);
		const f = await this.app.vault.create(path, JSON.stringify(doc, null, '\t'));
		await this.app.workspace.getLeaf('tab').openFile(f);
	}

	/** The Chronicle of Veld: a sample timeline with its notes, in its own folder. */
	async createSample() {
		const folder = 'Evra sample';
		const existing = this.app.vault.getAbstractFileByPath(`${folder}/Chronicle of Veld.evra`);
		if (existing instanceof TFile) { await this.app.workspace.getLeaf('tab').openFile(existing); return; }
		await this.ensureFolder(folder);
		for (const [name, text] of Object.entries(SAMPLE_NOTES)) {
			const p = `${folder}/${name}.md`;
			if (!this.app.vault.getAbstractFileByPath(p)) await this.app.vault.create(p, text);
		}
		if (!this.app.vault.getAbstractFileByPath(`${folder}/The Heron.svg`)) await this.app.vault.create(`${folder}/The Heron.svg`, SAMPLE_COVER);
		// link each card to the sample's own note, even when the vault has another note with the same name
		const evraPath = `${folder}/Chronicle of Veld.evra`, mc = this.app.metadataCache;
		const link = (name: string) => {
			const note = this.app.vault.getAbstractFileByPath(`${folder}/${name}.md`);
			if (!(note instanceof TFile)) return `${folder}/${name}`;
			const text = mc.fileToLinktext(note, evraPath, true);
			return mc.getFirstLinkpathDest(text, evraPath) === note ? text : `${folder}/${name}`; // the full path if the short one is taken
		};
		const f = await this.app.vault.create(evraPath, JSON.stringify(sampleDoc(link), null, '\t'));
		await this.app.workspace.getLeaf('tab').openFile(f);
		new Notice('Opened the sample timeline. Its notes are in the sample folder next to it.');
	}
}
