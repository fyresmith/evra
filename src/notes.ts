import { TFile, type App } from 'obsidian';

const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i;

/** Note text for card previews, read in the background and kept current as notes change. */
export class NoteCache {
	private texts = new Map<string, string>();
	private stamps = new Map<string, number>();
	private loading = new Set<string>();
	private gens = new Map<string, number>(); // bumped when a note changes, so a read that started before is thrown away
	private counter = 0;

	constructor(private app: App, private onLoaded: () => void) {}

	text(f: TFile): string | null {
		const hit = this.texts.get(f.path);
		if (hit != null) return hit;
		if (!this.loading.has(f.path)) {
			const path = f.path, gen = this.gens.get(path) ?? 0;
			this.loading.add(path);
			this.app.vault.cachedRead(f).then((t) => {
				if ((this.gens.get(path) ?? 0) !== gen) return; // the note changed while this read was in flight
				this.loading.delete(path);
				this.texts.set(path, t);
				this.stamps.set(path, ++this.counter);
				this.onLoaded();
			}, () => { if ((this.gens.get(path) ?? 0) === gen) this.loading.delete(path); });
		}
		return null;
	}

	stamp(f: TFile): number { return this.stamps.get(f.path) ?? 0; }

	/** Forget a note so it is read again next time. */
	changed(path: string): void {
		this.gens.set(path, (this.gens.get(path) ?? 0) + 1);
		this.loading.delete(path);
		this.texts.delete(path);
		this.stamps.set(path, ++this.counter);
	}

	renamed(oldPath: string): void { this.texts.delete(oldPath); this.stamps.delete(oldPath); }

	/** A cover image: the note's "cover" property (a link, a vault path or a web address), or the first image it embeds. */
	cover(f: TFile): string | null {
		const c = this.app.metadataCache.getFileCache(f);
		const raw = c?.frontmatter?.cover as unknown;
		if (typeof raw === 'string' && raw.trim()) {
			const v = raw.trim();
			if (/^(https?:|data:image\/)/.test(v)) return v;
			const target = v.replace(/^!?\[\[/, '').replace(/\]\]$/, '').split('|')[0];
			const img = this.app.metadataCache.getFirstLinkpathDest(target, f.path);
			if (img instanceof TFile && IMAGE.test(img.path)) return this.app.vault.getResourcePath(img);
		}
		for (const e of c?.embeds || []) {
			const img = this.app.metadataCache.getFirstLinkpathDest(e.link.split('#')[0], f.path);
			if (img && IMAGE.test(img.path)) return this.app.vault.getResourcePath(img);
		}
		return null;
	}
}
