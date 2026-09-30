import { PluginSettingTab, Setting, type App } from 'obsidian';
import type EvraPlugin from './main';
import type { TimelineDefaults } from './types';

export interface EvraSettings {
	/** Where new timelines go. Empty: Obsidian's setting for new notes. */
	newFileFolder: string;
	/** Where "Convert to note" puts new notes. Empty: next to the timeline. */
	noteFolder: string;
	openNotesIn: 'split' | 'tab' | 'same';
	/** The starting calendar, formats, colors and card options for new timelines. */
	defaults: TimelineDefaults | null;
}

export const DEFAULT_SETTINGS: EvraSettings = { newFileFolder: '', noteFolder: '', openNotesIn: 'split', defaults: null };

/* Settings for the plugin as a whole. Each timeline's own calendar, formats and colors are in its settings panel. */
export class EvraSettingTab extends PluginSettingTab {
	constructor(app: App, private plugin: EvraPlugin) { super(app, plugin); }

	display(): void { this.render(); }

	private render(): void {
		const { containerEl } = this, s = this.plugin.settings;
		containerEl.empty();
		new Setting(containerEl).setName('Files').setHeading();
		new Setting(containerEl)
			.setName('Folder for new timelines')
			.setDesc('Leave empty to use the same place as new notes.')
			.addText((t) => t.setPlaceholder('Timelines').setValue(s.newFileFolder).onChange(async (v) => { s.newFileFolder = v.trim(); await this.plugin.saveSettings(); }));
		new Setting(containerEl)
			.setName('Folder for notes made from cards')
			.setDesc('Where a card’s new note goes when you convert it. Leave empty to put it next to the timeline.')
			.addText((t) => t.setPlaceholder('Next to the timeline').setValue(s.noteFolder).onChange(async (v) => { s.noteFolder = v.trim(); await this.plugin.saveSettings(); }));
		new Setting(containerEl)
			.setName('Open linked notes')
			.setDesc('Where a card’s note opens. Hold the modifier key while clicking to open it in a new tab instead.')
			.addDropdown((d) => d
				.addOptions({ split: 'Beside the timeline', tab: 'In a new tab', same: 'In place of the timeline' })
				.setValue(s.openNotesIn)
				.onChange(async (v) => { s.openNotesIn = v as EvraSettings['openNotesIn']; await this.plugin.saveSettings(); }));

		new Setting(containerEl).setName('New timelines').setHeading();
		new Setting(containerEl)
			.setName('Starting settings')
			.setDesc(s.defaults
				? `New timelines start with a saved calendar of ${s.defaults.cal.months.length} months, ${s.defaults.palette.length} colors and your card options. To change them, open a timeline, then Timeline settings → Timeline → Defaults.`
				: 'New timelines start with a 12-month calendar. To use another, set it up in a timeline, then choose Timeline settings → Timeline → “Use these settings for new timelines”.')
			.addButton((b) => b.setButtonText('Forget saved settings').setDisabled(!s.defaults).onClick(async () => { s.defaults = null; await this.plugin.saveSettings(); this.render(); }));
		new Setting(containerEl)
			.setName('Sample timeline')
			.setDesc('A small world with eras, spans and linked notes to explore. It goes in its own folder.')
			.addButton((b) => b.setButtonText('Open the sample').onClick(() => { void this.plugin.createSample(); }));
	}
}
