# Changelog

## 1.0.0

This is the first release.

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
