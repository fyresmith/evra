import type { EvraDoc, TimelineDefaults } from './types';

/** What a timeline needs from Obsidian: saving, notes, and a few actions outside the view. */
export interface TimelineHost {
	/** The document changed: save it soon. */
	requestSave(): void;
	/** The zoom or scroll changed: remember it with the workspace. */
	saveViewState(): void;
	/** A short name for the timeline file, for embeds. */
	fileName(): string;

	// Linked notes. A link is a path without ".md", or any link text Obsidian can resolve.
	noteExists(link: string): boolean;
	noteTitle(link: string): string;
	/** The note's text if it has been read yet; otherwise null, and it is read in the background. */
	noteText(link: string): string | null;
	/** Changes whenever the note changes, so cards know when to redraw. */
	noteStamp(link: string): number;
	noteProps(link: string): Record<string, unknown> | null;
	/** Lower-case names of the notes this note links to. */
	noteLinks(link: string): string[];
	coverOf(link: string): string | null;
	openNote(link: string, evt?: MouseEvent | KeyboardEvent): void;
	hoverNote(evt: MouseEvent, target: HTMLElement, link: string): void;
	/** Create a note for a card; resolves to its link, or null. */
	createNote(title: string, text: string): Promise<string | null>;
	pickNote(onPick: (link: string) => void): void;
	searchNotes(q: string, limit: number): { link: string; title: string }[];
	/** Notes with properties that aren't on this timeline yet. */
	/** Dated-note candidates; near: in the timeline's folder or below; elsewhere: another timeline file links or syncs it. */
	candidateNotes(exclude: Set<string>): { link: string; title: string; props: Record<string, unknown>; near?: boolean; elsewhere?: boolean }[];
	linksFromDrop(e: DragEvent): string[];
	/** Same note? Links may be written differently. */
	sameNote(a: string, b: string): boolean;

	syncNotes(doc: EvraDoc): void;
	stripSyncedProps(doc: EvraDoc): Promise<number>;

	saveDefaults(d: TimelineDefaults): Promise<void>;
	newTimeline(): void;
	sampleTimeline(): void;
	saveAsNote(name: string, content: string): Promise<void>;
}
