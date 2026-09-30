# Changelog

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
