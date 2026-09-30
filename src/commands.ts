/* Commands that act on the timeline in focus. They appear in Obsidian's command palette (with no default
   hotkeys) and in the timeline's own search box after typing ">". Keys are the timeline's built-in shortcuts. */

export interface CommandInfo {
	id: string;
	name: string;
	key: string;
}

export const TIMELINE_COMMANDS: CommandInfo[] = [
	{ id: 'new-event', name: 'New event in the middle of the view', key: 'N' },
	{ id: 'search', name: 'Search cards, eras and notes…', key: 'Ctrl K' },
	{ id: 'go-to-date', name: 'Go to a date…', key: 'G' },
	{ id: 'fit-all', name: 'Fit everything', key: 'F' },
	{ id: 'zoom-selection', name: 'Zoom to the selection', key: 'Z' },
	{ id: 'zoom-in', name: 'Zoom in', key: '+' },
	{ id: 'zoom-out', name: 'Zoom out', key: '−' },
	{ id: 'direction-ttb', name: 'Direction: top to bottom', key: '' },
	{ id: 'direction-btt', name: 'Direction: bottom to top', key: '' },
	{ id: 'direction-ltr', name: 'Direction: left to right', key: '' },
	{ id: 'direction-rtl', name: 'Direction: right to left', key: '' },
	{ id: 'spans-threads', name: 'Spans as threads', key: '' },
	{ id: 'spans-blocks', name: 'Spans as blocks', key: '' },
	{ id: 'select-all', name: 'Select all cards', key: 'Ctrl A' },
	{ id: 'undo', name: 'Undo', key: 'Ctrl Z' },
	{ id: 'redo', name: 'Redo', key: 'Ctrl ⇧ Z' },
	{ id: 'settings-calendar', name: 'Settings: calendar', key: '' },
	{ id: 'settings-formats', name: 'Settings: formats', key: '' },
	{ id: 'settings-timeline', name: 'Settings: timeline', key: '' },
	{ id: 'settings-cards', name: 'Settings: cards', key: '' },
	{ id: 'settings-colors', name: 'Settings: colors', key: '' },
	{ id: 'settings-notes', name: 'Settings: notes', key: '' },
	{ id: 'save-view', name: 'Save this view…', key: 'B' },
	{ id: 'filter', name: 'Filter…', key: '' },
	{ id: 'copy-table', name: 'Copy as a Markdown table', key: '' },
	{ id: 'copy-outline', name: 'Copy as an outline by era', key: '' },
	{ id: 'copy-embed', name: 'Copy an embed for this view', key: '' },
	{ id: 'create-from-notes', name: 'Create cards from dated notes…', key: '' },
	{ id: 'go-to-now', name: 'Go to now', key: '.' },
	{ id: 'set-now', name: 'Set “now” to the middle of the view', key: '' },
	{ id: 'shortcuts', name: 'Keyboard shortcuts', key: '?' },
];
