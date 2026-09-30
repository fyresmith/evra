import { FuzzySuggestModal, type App, type TFile } from 'obsidian';

/** Choose a note to link to a card. */
export class NotePicker extends FuzzySuggestModal<TFile> {
	constructor(app: App, private onPick: (f: TFile) => void) {
		super(app);
		this.setPlaceholder('Link to a note…');
	}
	getItems(): TFile[] { return this.app.vault.getMarkdownFiles(); }
	getItemText(f: TFile): string { return f.path.replace(/\.md$/, ''); }
	onChooseItem(f: TFile): void { this.onPick(f); }
}
