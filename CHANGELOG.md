# Changelog

## 1.0.4

- Each release's main.js, manifest.json and styles.css come with a GitHub build attestation, and the release notes cover every change since the previous release.

## 1.0.3

- The stylesheet no longer uses !important, the all property or scrollbar styling; settings tabs wrap instead of scrolling. Verified with a new computed-style comparison (tests/e2e/css-capture.mjs) that nothing else looks different.

## 1.0.2

- The build lists Node's built-in modules itself instead of using the builtin-modules package.

## 1.0.1

- Evra's plugin settings are searchable in Obsidian's settings (1.13 and later), and the folder settings suggest folders. Older versions of Obsidian show them as before.

## 1.0.0

Evra's first stable release. Everything from the beta is here, after two long rounds of testing: 574 end-to-end scenarios run in real Obsidian, each in the light and dark themes, and 205 unit tests.

Highlights since the first beta (0.4.0):

- **Phone and narrow panes**: vertical timelines put every card on one side of the line so none are cut off; era labels, the ruler, the minimap and menus make room; settings tabs wrap. Press and hold a card for its menu on touch screens.
- **Safer files**: if a timeline changes on disk while you have unsaved edits (a sync client, another device, another pane), both sets of changes are kept. Two panes on the same timeline share every change at once. A briefly broken file never loses unsaved edits, and is never overwritten.
- **Notes**: moving or renaming folders of linked notes updates every timeline in one save; two timelines can sync the same note without fighting; synced properties keep the note's own capitalisation; "Create cards from dated notes" ranks candidates, skips notes other timelines use, and scales to thousands of notes; embeds follow timelines being created, deleted and moved.
- **Editing and the keyboard**: undo and redo finish half-done edits first and stay in order; Escape cancels drags and selection boxes; keys and commands pressed mid-drag are ignored; menus keep focus, trap Tab and skip dropdowns with the arrow keys; S, colors and nudges act on the whole selection; cards can be pasted from one timeline into another; Ctrl/⌘ Z works in checkboxes, sliders and dropdowns.
- **Eras and calendars**: calendar changes keep eras nested and in order; era labels never overlap in any direction; eras and "go to" dates past the range widen it; leap days, negative years, huge numbers and malformed calendar imports are handled.
- **Speed**: note changes in big vaults are handled in milliseconds, and text follows Obsidian's font size.

See the entries below for every change.

## 0.8.34 (beta)

- Fixes 0.8.28: a second pane that doesn't hold the same document still reloads when the other pane saves.

## 0.8.33 (beta)

- An open menu is moved back on screen when the window or pane is resized.

## 0.8.32 (beta)

- On the one-sided narrow layout, the across-the-line arrow keys and “Move to other side” are left out, since they'd change nothing visible.

## 0.8.31 (beta)

- On very narrow screens the ruler takes less room and cards shrink to fit, staying clear of the zoom controls.

## 0.8.30 (beta)

- On narrow vertical timelines, era labels stand upright in their own column instead of covering the line and cards.

## 0.8.29 (beta)

- The end-to-end runner closes every pane between tests, and the empty-clipboard test starts from a fresh plugin.

## 0.8.28 (beta)

- A second pane on the same timeline now follows outside changes after the other pane saved, instead of keeping cards that were removed on disk.

## 0.8.27 (beta)

- Turning on note sync writes notes 16 at a time, so the first properties arrive in well under a second.

## 0.8.26 (beta)

- If the timeline's file is briefly broken on disk (for example mid-sync), unsaved edits are held and merged into the next valid version.

## 0.8.25 (beta)

- Merging an outside edit keeps months or colors you reordered but hadn't saved yet.

## 0.8.24 (beta)

- 57 new end-to-end tests checking the round-2 fixes for regressions, including phone-width layouts in every direction.

## 0.8.23 (beta)

- Tabbing out of an era's date fields applies the date and keeps focus in the era editor.

## 0.8.22 (beta)

- Escape while drawing a selection box puts the selection back as it was.

## 0.8.21 (beta)

- Ctrl/⌘ D and other commands do nothing in the middle of a drag.

## 0.8.20 (beta)

- E edits the selected card again after a toolbar button was clicked (Enter on a focused button still presses it).

## 0.8.19 (beta)

- 15 new end-to-end tests for merging outside edits, sharing changes between panes and two timelines syncing one note.

## 0.8.18 (beta)

- On touch screens, pressing and holding a card opens its menu (a shorter hold still picks it up to drag).

## 0.8.17 (beta)

- Copied cards can be pasted into another timeline; colors it doesn't have are dropped.

## 0.8.16 (beta)

- Create cards from notes lists notes in the timeline's folder first and leaves notes that another timeline links or syncs unticked.

## 0.8.15 (beta)

- Create cards from notes leaves notes for other timelines unticked and adds a filter.

## 0.8.14 (beta)

- Left-to-right and right-to-left timelines centre the line in the room above the ruler, so cards below it no longer cover the ruler.

## 0.8.13 (beta)

- Settings tabs wrap on narrow screens instead of hiding off the edge.

## 0.8.12 (beta)

- At phone width in any direction, the minimap and now tag sit below the breadcrumb and era labels stay clickable.

## 0.8.11 (beta)

- Era labels stack without overlapping, in time order, in every direction.

## 0.8.10 (beta)

- An open card menu shows a color picked with the number keys.

## 0.8.9 (beta)

- Delete or Backspace in a card menu deletes the card, as its hint says.

## 0.8.8 (beta)

- Escape closes an open popover such as Help first and keeps the selection.

## 0.8.7 (beta)

- Escape in the middle of a drag puts everything back, with no undo step.

## 0.8.6 (beta)

- Right-clicking another card while editing saves the edit and leaves focus in the new menu.

## 0.8.5 (beta)

- Enter on a focused toolbar or toast button presses it instead of editing the selected card.

## 0.8.4 (beta)

- Ctrl/⌘ D places the copy one snap step later keeping the card's exact day, like Duplicate in the card menu.

## 0.8.3 (beta)

- Shift-clicking a selected card removes just that card, and right-clicking inside a selection opens the menu for all of it.

## 0.8.2 (beta)

- Arrow keys in a card menu move past dropdowns instead of silently changing them.

## 0.8.1 (beta)

- Undo and redo first save a card being edited, close an open editor and finish a settings field, so what you typed isn't lost and history stays in order.

## 0.8.0 (beta)

- On narrow screens (under 520 px), vertical timelines show cards on one side of the line so none are cut off; cards keep their side in the file.

## 0.7.41 (beta)

- Create cards from notes lists the best-dated notes first, ticks only strong candidates, shows a count with “and N more”, has Tick all / Untick all, and its button counts the ticked notes.

## 0.7.40 (beta)

- Tab cycles through an open card menu's controls, and Escape always closes it.

## 0.7.39 (beta)

- Moving a folder of linked notes updates the undo history in one pass, not once per note.

## 0.7.38 (beta)

- Note changes find their card through a lookup instead of scanning every card (about 800 ms to 4 ms for a vault-wide change on a 2,000-card world).

## 0.7.37 (beta)

- Two panes showing the same timeline share each change immediately, so neither loses unsaved edits.

## 0.7.36 (beta)

- Embeds update when a timeline is created or deleted, use the nearest timeline up the note's folders, and accept from/to in either order.

## 0.7.35 (beta)

- Syncing writes to a note's existing property whatever its capitalisation, instead of adding a lower-case copy.

## 0.7.34 (beta)

- A file with repeated card or era ids opens with every card shown; deleting one no longer deletes its twin.

## 0.7.33 (beta)

- Reordering, removing or shrinking months keeps eras inside their parents, in order and not empty.

## 0.7.32 (beta)

- A negative-year word such as “BE” is only matched as a whole word, so months like September or Ember no longer make a year negative.

## 0.7.31 (beta)

- New end-to-end tests: two timelines on one note, a note deleted while its timeline is closed, a 40-note folder move, and outside edits during unsaved changes.

## 0.7.30 (beta)

- If the timeline's file changes on disk while you have unsaved edits, both sets of changes are kept (yours win where both changed the same thing).

## 0.7.29 (beta)

- When two timelines sync the same note, an unrelated edit in one no longer rewrites the note and moves the other's card.

## 0.7.28 (beta)

- Moving or renaming a folder of linked notes updates each closed timeline in one save instead of one per note.

## 0.7.27 (beta)

- 60 new end-to-end tests for note sync, embeds, file moves, broken files, random input, leaks and speed on a large world.

## 0.7.26 (beta)

- Escape closes the settings panel even right after ticking a checkbox.

## 0.7.25 (beta)

- When the file changes outside the view (another pane saves, or an external edit), a card drag in progress stops and open menus close, instead of throwing errors or editing cards that are gone.

## 0.7.24 (beta)

- 97 new end-to-end tests for eras, spans, navigation, all four directions, calendars and settings, including phone-width windows.

## 0.7.23 (beta)

- Narrowing the range keeps it at the end of the content, like Fit range, instead of adding a year.

## 0.7.22 (beta)

- The card width slider opens at the timeline's width instead of 160, so the first nudge no longer jumps.

## 0.7.21 (beta)

- Setting description lines to None hides descriptions instead of showing them in full over the date.

## 0.7.20 (beta)

- Going to a date outside the range widens the range (one undo step) so the date is on screen.

## 0.7.19 (beta)

- “Add an era here” and dragging out a new era near the end of the range widen the range to hold the era.

## 0.7.18 (beta)

- Dragging the edge of a top-level era that reaches past the timeline's range no longer shrinks it to one day.

## 0.7.17 (beta)

- 109 new end-to-end tests for editing, the keyboard, menus, multi-select, copy and paste, and undo.

## 0.7.16 (beta)

- S turns every selected card into a span (or back), not just one.
- A moment marked approximate no longer keeps a hidden “circa” after becoming a span.

## 0.7.15 (beta)

- “Add a span here” and “New span” are undone in one step with their name, like new events.

## 0.7.14 (beta)

- Titles and descriptions cut at their length limit no longer end in half an emoji.

## 0.7.13 (beta)

- Ctrl/⌘ Z and Y undo and redo while a checkbox, slider or dropdown in a menu or the settings has focus.

## 0.7.12 (beta)

- Delete, undo and other keys pressed in the middle of dragging a card are ignored instead of throwing errors or undoing the wrong step.

## 0.7.11 (beta)

- After opening another timeline in the same tab, keys no longer reach the old one (which could add, delete or undo invisibly).

## 0.7.10 (beta)

- More end-to-end tests of the settings panel: every control's undo, malformed calendar imports, huge numbers, and random input with the panel open.

## 0.7.9 (beta)

- Ctrl/Cmd shortcuts such as undo and redo work while a card menu is open, and close it.
- Moving a note keeps its cards linked when another note has the same name.

## 0.7.8 (beta)

- Card, era-label, tag and ruler text follows Obsidian's font size setting (it was fixed in pixels), and cards size themselves to match.
- The breadcrumb and the zoom and settings buttons stay above labels and tags, so nothing covers them or swallows their clicks.

## 0.7.7 (beta)

- Calendar import shows a message instead of failing on odd but valid JSON (null months, leap days or weekdays in the wrong shape).
- Leap rules for a deleted month are removed instead of showing up on the wrong month.
- Settings fields for the first year's number, the second calendar's year length and the range reject values too large to keep.

## 0.7.6 (beta)

- Fixed: the +N marker for bundled spans sat in the wrong place in bottom-to-top and right-to-left timelines.
- Fixed: with spans as blocks, a long span's card could sit off screen while its block filled the view.
- Clicking a short era's bar next to an era edge opens its editor.
- Deleting an era without sub-eras just says "Era deleted."
- Ruler labels stay clear of the breadcrumb in bottom-to-top timelines.
- Touch: a pinch that starts with a finger on the time line zooms.
- Keyboard: menus take the focus when they open; arrow keys move within them (instead of moving the card) and Escape closes them. Cards are one tab stop (the selected card), so Tab reaches the toolbar quickly.

## 0.7.5 (beta)

- Timelines in notes: a note at the vault root picks the timeline next to it; `to:` includes that whole year; clicking an event reuses the pane that already shows the timeline; an unknown `era:` or a tag with no events says so.
- Notes made from cards: names starting with a dot, very long names, or ending in dots or spaces are made safe.
- The sample timeline links to its own notes even when your vault has notes with the same names.
- Renaming a note keeps the links right in closed timelines when another note has the same name.

## 0.7.4 (beta)

- Dates written ISO-style (2024-05-01, 2024/05/01, 2024-05) are read as year-month-day in search and in note properties, instead of as Year 1.
- Note properties like Timeline-Year are read in any capitalisation.
- Create cards from notes skips notes whose date property doesn't read as a date ("version 2", "Q3 2024") rather than guessing.

## 0.7.3 (beta)

- Create cards from notes ticks notes with timeline properties at first; notes with just a generic year or date (books, films…) are listed unticked unless there are only a few.
- Unlinking a card whose note is missing keeps the card's own text instead of emptying it.

## 0.7.2 (beta)

- Fixed: moving a linked note while another note with the same name existed re-pointed the card (in an open timeline) at the other note.
- Links written as [[Note#Heading]] or [[Note|alias]] now find their note.
- A card whose note doesn't exist (deleted, or not created yet) has a dashed border and a muted title.

## 0.7.1 (beta)

- Undo history is capped by size as well as steps (about 25 MB, always keeping the last 20 steps), so very large timelines don't eat memory.
- Moving or renaming a timeline file re-resolves its note links from the new folder.

## 0.7.0 (beta)

- Timeline files are checked thoroughly as they open. Hand-edited or damaged files with wrong-typed fields, reversed dates, missing or looping era parents, or absurd numbers now open cleanly instead of failing or freezing Obsidian (a date like 1e20 used to hang it). Unknown fields are kept.
- Fixed: 29 February (and any leap day) slipped to the 28th after a calendar edit, when a synced note changed, or when typed into a date field.
- Absurd years typed into search or read from notes are ignored.
- Calendar changes keep pinned cards on their dates.
- Faster calendar edits and era lookups on large timelines.
- New unit tests for leap days and file checking (129 in all).

## 0.6.8 (beta)

- Timelines in notes: never drawn twice when saves come quickly, redrawn only when their own timeline changes, follow a renamed timeline, and ignore `from:`/`to:` values that aren't numbers.
- A note edited while it was being read no longer leaves its card showing the old text.
- Dropping text like [[100% done]] onto a timeline no longer fails.
- Renaming a note checks closed timelines cheaply first, and keeps their synced-notes list up to date.

## 0.6.7 (beta)

- Fixed: after deleting a clicked card, Ctrl/⌘ Z did nothing until you clicked the timeline again.
- Fixed: undoing while a card's menu was open left the menu editing the old card, so its next change was lost. Undo and redo now close menus.
- Fixed: a lifespan turned back into a single moment kept its "someone's life" mark.
- Fixed: a card pinned to a span's end jumped when that span became a single moment; it now stays put.
- Adding a card and naming it is now one undo step, and titles are kept to one line.

## 0.6.6 (beta)

- Fixed: undoing after renaming a linked note brought back the old, broken link.
- Ctrl/⌘ D duplicates without touching the clipboard or what you last copied.
- Dragging the minimap or the side scrollbar can no longer leave listeners behind if the drag is interrupted (touch cancel).

## 0.6.5 (beta)

- Settings panel fixes:
  - The card-width slider and colour pickers always record an undo step and save, including when changed with the keyboard or changed several times in a row.
  - Toggling a festival month keeps events on their named day and updates the month summary.
  - An empty range field says "Enter a year." instead of a misleading error.
  - Leap rules that don't make sense (like "except every 3" with "every 4") get a warning.
  - Importing a calendar replaces its weekdays and leap rules instead of keeping the old ones.
  - Renaming a unit or a month updates every label in the panel.
  - Redrawing the panel keeps your place.

## 0.6.4 (beta)

- Fixed: moving a card together with a card pinned to it (arrow keys or dragging a selection) moved the pinned card twice.
- New spans made from a moment (S, or **Make it a span**) are a whole year long in whole days, even with leap years (they could get fractional dates).
- The filter pill and the +N thread markers are only rebuilt when they change: faster, and clicks on them during an animation are no longer lost.

## 0.6.3 (beta)

- Fixed: with note sync on, moving a card twice in quick succession could move it back, when Evra's own property write came back as a note change.
- Changed covers and links in a note now show on its card right away.
- Timers belong to the timeline's own window, so popout windows behave.

## 0.6.2 (beta)

- Fixed: closing a timeline (or switching its tab to another file) while editing a card lost what you'd typed. The edit is now saved first.
- Ctrl/⌘ K and Ctrl/⌘ D no longer act on the timeline while you're typing in a card or a field.
- **Remove timeline properties** now removes only the properties Evra writes, never a same-named property of your own that sync isn't using.

## 0.6.1 (beta)

- The getting-started hint no longer covers the year ruler, and goes away once a timeline has five events.
- Clicking a card or dot no longer copies the whole timeline for undo; that now happens only when a drag really starts (noticeable on very large timelines).
- The end-to-end runner loads every `tests/e2e/specs*.mjs` file, or just the ones passed with `--specs`.

## 0.6.0 (beta)

- An end-to-end test suite that drives Evra inside a real, headless Obsidian: opening files, adding and dragging cards, menus, eras, search, filters, saved views, every settings tab, note sync, renames, drag and drop, embeds and every command (`npm run e2e`).

## 0.5.2 (beta)

- The sample notes no longer repeat their name as a heading under Obsidian's own title.

## 0.5.1 (beta)

- Fixed: clicking a button in the settings panel right after editing a field did nothing (saving the field redrew the panel under the pointer).
- Fixed: keyboard shortcuts stopped working after a menu, popover or settings field closed, until you clicked the timeline again.
- Enter now saves a settings field, as leaving it does.
- Ctrl/⌘ D duplicates the selection again (Obsidian's editor claimed it), and **Duplicate the selection** is a command.

## 0.5.0 (beta)

- A new README: a guided tour with screenshots and short demos of every feature, all captured in Obsidian.

## 0.4.10 (beta)

- Fixed: renaming or moving a linked note updated the card's title on screen but not the saved link, so the link broke after reopening the timeline. Links now follow the note in open and closed timelines.

## 0.4.9 (beta)

- Fixed: in Settings → Colors, a built-in color that the theme defines as a blend (like light mode's yellow) showed as gray #888888. Built-in colors now always show their real hex code.

## 0.4.8 (beta)

- Fixed: a compact card's enlarged hover view stayed open (dimming everything) while zooming. Zooming now closes it, and cards sliding under the pointer while scrolling or zooming no longer open it.

## 0.4.7 (beta)

- Search ranks results: names that start with what you typed come first, then names containing it, then cards that only mention it in their description or tags.

## 0.4.6 (beta)

- Fixed: the timeline could shift up inside its pane (hiding its top edge) when a focused card moved off screen, for example after fitting an era. The timeline's frame can no longer scroll.

## 0.4.5 (beta)

- No more stray tooltips: Obsidian shows one for anything with an accessible label, so hovering the timeline showed "Timeline". Tooltips now appear only on buttons, and they include the shortcut ("Zoom in (+)").
- Ctrl/⌘ K is claimed by the timeline while it has focus, so Obsidian's own hotkeys can't take it first.

## 0.4.4 (beta)

- Obsidian's word count no longer counts a timeline file's raw data (Evra views are marked as not plain text, like Canvas). This also stops Obsidian from trying to merge outside edits to the file line by line.
- In horizontal timelines, era labels that start close together stack in rows instead of overlapping, and the hint text sits above the era rail.

## 0.4.3 (beta)

- Fixed: double-clicking inside an era's shading (or on a span's thread) did nothing. Evra now detects double-clicks itself, because the browser only counts a double-click when both clicks land on the same element, and those are redrawn between clicks.

## 0.4.2 (beta)

- The zoom and settings buttons, the year ruler, the era rail and messages now stay clear of Obsidian's status bar, which floats over the bottom right of the workspace.

## 0.4.1 (beta)

- Light mode redesigned to match dark mode: cards read as colored tiles on a slightly deeper stage, with clear colored borders, the theme's full-strength colors (yellow deepened for contrast on white), crisper lines and a firmer card shadow.

## 0.4.0 (beta)

The first public beta.

- Timelines saved as `.evra` files, running in four directions.
- Cards that sit exactly on their dates, stacking snugly and scrolling across instead of shrinking. Crowded years collapse into group cards, and cards turn compact or into dots as you zoom out.
- Custom calendars:
  - months of any length, festival days and leap rules;
  - weekdays and unit names;
  - years counted within an era;
  - a second calendar;
  - import from Calendarium or Fantasy-Calendar.
- Editable templates for every date label.
- Eras nested to any depth, shown as bands, a rail, labels and a breadcrumb. Era edges can be dragged, and any era can be fitted to the screen.
- Spans drawn as threads beside the line, or as blocks. Unknown starts, ongoing spans and lifespans with ages.
- Linked notes:
  - cards show a note's excerpt and cover image;
  - drag notes in from the file explorer;
  - convert a card to a note;
  - optional two-way sync of dates into note properties;
  - create cards from dated notes.
- Search and go to date. Multi-select, copy and paste. Filters, tags, icons, approximate dates, relative (pinned) dates, a "now" marker, a minimap and saved views.
- Color presets that recolor everything that uses them. The built-in colors follow the theme.
- `evra` code blocks that show a timeline inside a note.
- Export as a Markdown table or an outline by era, to the clipboard or a new note.
- The file format reserves fields for the planned sub-timelines.
- Light mode: deeper palette, fainter era shading and tints, softer guides. At scale: bundled spans share one strand, pinned name tags are capped, far-zoom clusters no longer chain into one blob, and very short spans hide while zoomed far out.
- Performance on large timelines (thousands of cards and linked notes): note lookups are cached and asked once per frame, card sizes and note excerpts are kept until the note changes, hovering no longer re-lays out cards, the minimap draws its full range once, and nothing forces the browser to re-lay out the page mid-frame.
