# Known limitations

What isn't built yet, and what works in a way you might not expect. Anything else that goes wrong is a bug:
[open an issue](https://github.com/fyresmith/evra/issues).

## Planned, not built

- **Sub-timelines.** Linking timelines into a tree, and branching one for an alternate history. See the
  [roadmap](../ROADMAP.md).

## Sync

- **Obsidian Sync** carries `.evra` files only with **Sync all other types** on, in Obsidian's Sync settings, on each
  device.
- Tools that copy every file (iCloud, Syncthing, Dropbox, git) carry timelines without any setting.
- If a timeline changes on disk while you have unsaved edits to it, Evra keeps both sets of changes and says so.

## Timelines

- A timeline saved by a newer version of Evra, with a file format this version doesn't know, isn't opened. Evra says
  why and leaves the file untouched. Update Evra to open it.
- A file that isn't valid JSON isn't opened either, and is never overwritten.
- A card's own description holds up to 256 characters. A linked card shows the start of its note, trailing off after
  256 characters.
- When more than six spans overlap on one side of the line, the extra ones share a single lane marked **+N**.
- Filters belong to the view you're looking at. They aren't saved in the file; a saved view keeps a stretch of time,
  not a filter.

## Notes

- Undo in a timeline doesn't undo what note sync wrote into your notes. After an undo, sync writes the restored dates
  back to them.
- A note linked from more than one card takes the earliest card's date.
- Turning note sync off leaves the properties it wrote where they are. **Remove timeline properties from linked
  notes** takes them out.

## Embeds

- An `evra` code block lists the first ten events of what it shows.
- Without a `timeline` option, an embed uses a timeline in the same folder as the note, or else the first one in the
  vault.

## Phones and narrow panes

- On narrow screens, vertical timelines put every card on one side of the line, so the keys and menu items that move
  a card to the other side are left out there.
- Linked notes open beside the timeline on a computer or tablet. A phone has no room for that, and opens them in a new
  tab.
