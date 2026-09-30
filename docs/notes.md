# Linked notes and note sync

## Linking cards to notes

A card can link to a note. A linked card:

- takes the note's name as its title;
- shows the start of the note as its description. Headings, properties and code blocks are skipped, and the text trails off after 256 characters, on a whole word.
- shows a **cover image**, if the note has one. The cover comes from the note's `cover` property, which can be a link like `"[[Heron.png]]"`, a vault path or a web address. Otherwise the cover is the first image the note embeds.
- has an open-note button. Hover it for Obsidian's page preview, or click it to open the note.

To link a card to a note:

- **Drag notes onto the timeline** from the file explorer, search results or a link. Each note becomes a card where you drop it.
- Use **Card options → Link to note…** to choose a note.
- Use **Card options → Convert to note**. This makes a new note from the card's title and description. It goes next to the timeline, or in the folder set in Obsidian's **Settings → Evra**.
- Use **Settings → Notes → Create cards from notes**. See [Creating cards from dated notes](#creating-cards-from-dated-notes).

Double-clicking a linked card opens its note. The note opens in the setting chosen under **Settings → Evra → Open linked notes**: beside the timeline (the default), in a new tab, or in place of the timeline. Hold Ctrl or ⌘ while clicking to open it in a new tab instead.

**Unlink note** keeps the card, but turns it back into a plain card with the note's name and excerpt.

If you rename or move a linked note, its cards follow it, including in timelines that aren't open.

## Note sync

Note sync is optional and off by default. When it's on, each linked note carries timeline properties that stay in step with its card:

```yaml
---
timeline-date: 15 Thaw, Year 38
timeline-year: 38
timeline-month: Thaw
timeline-era: The Second Age
---
```

Turn it on in **Settings → Notes → Write timeline properties into linked notes**. The panel previews what the first linked note will look like.

### What gets written

You choose which fields to sync, and you can rename any property:

| Field | Default property | On by default | Value |
|---|---|---|---|
| Date | `timeline-date` | yes | The card's date or span, as it reads on the card |
| Year | `timeline-year` | yes | The year number |
| Month | `timeline-month` | yes | The month name (calendars with months only) |
| Day | `timeline-day` | no | The day of the month |
| End date (spans) | `timeline-end` | no | A span's end date, or the word for ongoing |
| Era | `timeline-era` | yes | The top-level era |
| Sub-era | `timeline-sub-era` | no | The innermost era |
| All eras, as a list | `timeline-eras` | no | Every era the date falls in, outermost first |
| Timeline name | `timeline` | no | The timeline's name |

The properties update whenever the card, its eras or the calendar change. Other properties in the note are left alone.

When you rename a property, the old name is removed from the notes. When you unlink a note or delete its card, the timeline properties are removed from that note.

If a note is linked from more than one card, it takes the earliest card's date.

### Editing a date in the note

Edit a synced **year**, **month** or **day** property in a note, and its card moves to match. A span moves as a whole and keeps its length. The month can be written as its name or its number.

### Which notes are touched

Sync only changes notes that the timeline links to, or has written to before. It never scans or rewrites other notes.

To take the properties back out of every linked note, use **Settings → Notes → Remove timeline properties from linked notes**. Turning sync off leaves notes as they are.

Undo in the timeline doesn't undo note changes. After an undo, sync writes the restored dates back to the notes.

## Creating cards from dated notes

**Settings → Notes → Create cards from notes** lists notes that aren't on the timeline yet but have a date in their properties. A note qualifies if it has:

- a year, with an optional month and day, under your sync property names, or under `year`, `month` and `day`; or
- a `date` property that Evra can read, such as `14 Frost 412`.

Tick the notes you want, then click **Create cards**. The new cards alternate sides and are selected, so you can color or move them together.
