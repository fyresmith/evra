<h1 align="center">Evra</h1>

<p align="center"><b>Timelines for worldbuilders, inside Obsidian.</b><br>
Your own calendar · eras nested as deep as you like · stories as threads · cards linked to your notes</p>

<p align="center">
<img alt="Version" src="https://img.shields.io/badge/version-0.5.0_beta-7c5cff">
<img alt="Obsidian" src="https://img.shields.io/badge/Obsidian-1.6%2B-483699">
<img alt="License" src="https://img.shields.io/badge/license-MIT-3a9a5c">
</p>

<p align="center"><img src="docs/media/tour.gif" alt="Scrolling through a timeline in Evra" width="900"></p>

> **Beta.** Evra is new, so expect rough edges. Back up your vault, and please [report problems](https://github.com/fyresmith/evra/issues).

Most timeline tools assume our calendar and our kind of history. Evra is built for the ones you make up:
- a calendar with thirteen moons and a festival week;
- ages that contain reigns that contain wars;
- a history that runs to three thousand years and two thousand events.

Each timeline is its own `.evra` file in your vault, and its cards can link to the notes you already have.

<table>
<tr>
<td width="50%"><img src="docs/media/hero-light.png" alt="Evra in Obsidian's light theme"></td>
<td width="50%"><img src="docs/media/hero-dark.png" alt="Evra in Obsidian's dark theme"></td>
</tr>
<tr><td align="center"><sub>Light theme</sub></td><td align="center"><sub>Dark theme</sub></td></tr>
</table>

## Contents

- [Getting started](#getting-started)
- [A tour](#a-tour)
  - [Add events in seconds](#add-events-in-seconds)
  - [Drag to change dates](#drag-to-change-dates)
  - [Eras inside eras](#eras-inside-eras)
  - [Any calendar you can imagine](#any-calendar-you-can-imagine)
  - [Stories as threads](#stories-as-threads)
  - [Cards that know your notes](#cards-that-know-your-notes)
  - [Timelines inside notes](#timelines-inside-notes)
  - [Find anything, jump anywhere](#find-anything-jump-anywhere)
  - [Filters, tags and card options](#filters-tags-and-card-options)
  - [Colors that stay consistent](#colors-that-stay-consistent)
  - [Any direction](#any-direction)
  - [Built for big worlds](#built-for-big-worlds)
  - [Made for the keyboard, too](#made-for-the-keyboard-too)
- [Everything else](#everything-else)
- [Documentation](#documentation)
- [Roadmap](#roadmap)
- [Privacy and your files](#privacy-and-your-files)
- [Contributing](#contributing)

## Getting started

Evra is in beta, so it isn't in Obsidian's community plugin list yet. Install it one of these ways:

- **With BRAT (recommended):**
  1. Install the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin.
  2. Run **BRAT: Add a beta plugin for testing** and enter `fyresmith/evra`.
- **By hand:**
  1. Download `main.js`, `manifest.json` and `styles.css` from the [latest release](https://github.com/fyresmith/evra/releases).
  2. Put them in `<your vault>/.obsidian/plugins/evra/`.

Then turn Evra on in **Settings → Community plugins**.

**Your first timeline:**
1. Click the Evra button in the ribbon, or run **Evra: New timeline** from the command palette. You can also right-click a folder and choose **New timeline**.
2. Double-click beside the line to add an event.
3. Drag along the line to create an era.

Want to see a finished one first? Run **Evra: Open the sample timeline**. It opens *The Chronicle of Veld*, a small world with eras, spans, lifespans and linked notes.

## A tour

### Add events in seconds

Double-click beside the line and start typing: a title, then **Enter**, then a description. Pressing **Enter** in the description saves the card and starts the next one, so you can write a history in one go. Each card lands on the nearest year, on the side you clicked.

<p align="center"><img src="docs/media/add-event.gif" alt="Double-clicking to add an event and typing its title and description" width="900"></p>

- Cards size themselves to their text; a card with no description shrinks to its title and date.
- Cards stack snugly instead of shrinking. When a crowded stretch overflows, the timeline scrolls sideways.
- A year with many events on one side collapses into a group card while you're zoomed out.

### Drag to change dates

Drag a card to move it through time; it snaps to the marks on the ruler. Drag it across the line to switch sides. Drag a moment's dot along the line to turn it into a span.

<p align="center"><img src="docs/media/drag.gif" alt="Dragging a card to a new date, across the line, and stretching a dot into a span" width="900"></p>

Hold **Alt** to move by single days. **Shift**-click or **Shift**-drag to select several cards and move them together. Everything can be undone.

### Eras inside eras

Drag along the line to mark a stretch of time, then choose **New era**. If that stretch falls inside another era, it becomes a sub-era. Eras nest to any depth: ages, reigns, wars, sieges. You see them as:

- soft bands behind the timeline;
- colored bars beside the year ruler;
- labels at every level;
- a breadcrumb at the top of the view.

<p align="center"><img src="docs/media/eras.gif" alt="Dragging along the line to create a sub-era, naming it and picking a color" width="900"></p>

<table>
<tr>
<td width="55%"><img src="docs/media/era-editor.png" alt="The era editor"></td>
<td>

**The era editor** sets:
- the era's name;
- an abbreviation for dates like "12 SA";
- exact start and end dates;
- its color.

It can also add a sub-era inside it.

**Resize an era** by dragging its edge from anywhere across the timeline. Neighbouring eras move with it, or hold **Alt** to split a shared edge.

**Right-click** any era to fit it to the screen. Click a name in the breadcrumb to do the same.

</td>
</tr>
</table>

### Any calendar you can imagine

Every timeline has its own calendar:
- months of any length, reordered by dragging;
- festival days that sit between months;
- leap-day rules like "every 4 years, except every 100, unless every 400";
- named weekdays, and your own unit names ("cycle" instead of "year");
- years counted from the start of each era;
- a second calendar shown alongside the first.

You can start from a preset, or import a calendar from **Calendarium** or **Fantasy-Calendar**.

<table>
<tr>
<td width="50%"><img src="docs/media/settings-calendar.png" alt="Calendar settings: months, lengths and festival days"></td>
<td width="50%"><img src="docs/media/settings-formats.png" alt="Date format templates with tokens and live previews"></td>
</tr>
<tr>
<td align="center"><sub>Months, leap days, weekdays, numbering</sub></td>
<td align="center"><sub>Every date label is a template you can edit, with a live preview</sub></td>
</tr>
</table>

Every date label comes from a template you can edit: `{D} {M}, {year}`, `{Do} of {M}`, `{EY} {E}`, weekdays with `{W}`, and more. See [Date formats](docs/formats.md).

### Stories as threads

A span, such as a war, a voyage or a reign, leaves the line at its start, runs beside it, and rejoins it at its end. Its card can sit anywhere along its thread. While you scroll through the middle of a long span, its name stays pinned to the edge of the view.

<table>
<tr>
<td width="50%"><img src="docs/media/hero-light.png" alt="Spans drawn as threads beside the line"></td>
<td width="50%"><img src="docs/media/spans-blocks.png" alt="Spans drawn as shaded blocks"></td>
</tr>
<tr><td align="center"><sub>Threads (the default)</sub></td><td align="center"><sub>Blocks</sub></td></tr>
</table>

Spans can have an **unknown start** or be **ongoing**. Mark a span as **someone's life**, and every card that mentions that person shows their age at the time.

### Cards that know your notes

Drag a note from the file explorer onto the timeline and it becomes a card. The card shows the note's opening lines and its cover image. Hover the card's link button for Obsidian's own page preview. Rename or move the note and the card follows.

<p align="center"><img src="docs/media/hover-preview.png" alt="Hovering a linked card shows Obsidian's page preview of the note" width="700"></p>

**Note sync** is optional and off by default. When it's on, Evra writes each card's date, year, month and era into its note's properties, and keeps them current as you move things. It works the other way too: edit the year in a note, and its card moves. You choose which properties to sync and what they're called. Only notes the timeline links to are ever changed.

<p align="center"><img src="docs/media/note-sync.gif" alt="Dragging a card updates the linked note's timeline properties" width="900"></p>

<table>
<tr>
<td width="50%"><img src="docs/media/settings-notes.png" alt="Note sync settings with a preview of the properties"></td>
<td>

- **Pick the fields:** date, year, month, day, end date, era, sub-era, every era as a list, and the timeline's name.
- **Rename them:** use `year` instead of `timeline-year`, for example.
- **Preview first:** the panel shows exactly what a note will get.
- **Create cards from notes:** Evra finds notes that have a year or a date in their properties but aren't on the timeline yet, and adds the ones you pick.

</td>
</tr>
</table>

### Timelines inside notes

Put part of a timeline in any note with an `evra` code block: a whole timeline, one era, a range of years, or one tag. Click an event in it to jump to that card.

````markdown
```evra
timeline: Chronicle of Veld
era: Reign of Ash
```
````

<p align="center"><img src="docs/media/embed.png" alt="A note showing an embedded timeline of one era" width="900"></p>

### Find anything, jump anywhere

Press **Ctrl/⌘ K** and type:
- a card, era or note to find it (names that start with what you typed come first);
- a date, such as `412`, `Frost 412` or `14 Frost, Year 412`, to jump straight there;
- `>` first, to run any timeline command.

<p align="center"><img src="docs/media/search.gif" alt="Searching for a date and a card" width="900"></p>

<table>
<tr>
<td width="50%"><img src="docs/media/search-text.png" alt="Search results across cards, eras and notes"></td>
<td width="50%"><img src="docs/media/search-date.png" alt="Typing a date to jump to it"></td>
</tr>
</table>

### Filters, tags and card options

The filter narrows the timeline by text, color, tag, era, side, or whether a card links to a note. Everything else either fades or hides. A card's **⋯** menu gives you:
- colors, icons and tags;
- approximate dates ("c. Year 49");
- pinning to another card ("3 years after the comet"), so it moves when that card moves;
- the people involved, whose ages then show on the card;
- linking to a note, or turning the card into one.

<table>
<tr>
<td width="50%"><img src="docs/media/filter.png" alt="Filtering by the war tag, fading everything else"></td>
<td width="50%"><img src="docs/media/card-menu.png" alt="A card's options menu"></td>
</tr>
<tr><td align="center"><sub>Filter by tag, color, era, side or linked notes</sub></td><td align="center"><sub>Card options</sub></td></tr>
</table>

### Colors that stay consistent

Cards and eras use color presets. Change a preset, and everything that uses it changes too. The six built-in colors follow your Obsidian theme until you give them a color of your own.

<p align="center"><img src="docs/media/colors.gif" alt="Changing the red preset to blue recolors every red card and era" width="900"></p>

### Any direction

Top to bottom, bottom to top, left to right or right to left. One click switches, and the view keeps the same stretch of time on screen.

<p align="center"><img src="docs/media/directions.gif" alt="Cycling through the four directions" width="900"></p>

<p align="center"><img src="docs/media/horizontal.png" alt="A horizontal timeline" width="900"></p>

### Built for big worlds

Evra's repository can generate **Aerth**, a test world (`npm run big-world`): 2,700 notes, 1,900 cards and 91 eras nested four deep, across 3,000 years. As you zoom out:
- full cards become compact one-line cards (hover one to see it at full size);
- compact cards become dots;
- close dots merge into numbered clusters.

Scrolling and zooming stay smooth throughout.

<p align="center"><img src="docs/media/zoom.gif" alt="Zooming from single years out to three thousand years and back" width="820"></p>

<table>
<tr>
<td width="50%"><img src="docs/media/aerth-compact.png" alt="Compact cards across a century"></td>
<td width="50%"><img src="docs/media/aerth-overview.png" alt="Three thousand years with ages, eras and clusters"></td>
</tr>
<tr><td align="center"><sub>A century, in compact cards</sub></td><td align="center"><sub>Three thousand years at a glance</sub></td></tr>
</table>

### Made for the keyboard, too

<table>
<tr>
<td width="45%"><img src="docs/media/shortcuts.png" alt="The shortcuts list"></td>
<td>

| Keys | Action |
|---|---|
| **N** | New event at the pointer |
| **E** or **↵** | Edit the selected card |
| **J / K** | Next or previous card in time |
| **↑ ↓** | Nudge the selection along the ruler |
| **S** | Make it a span |
| **1–9** | Color the selection |
| **G** | Go to a date |
| **F / Z** | Fit everything / zoom to the selection |
| **Ctrl/⌘ C · V · D** | Copy · paste at the pointer · duplicate |
| **Ctrl/⌘ Z** | Undo (Shift to redo) |

Every timeline command is also in Obsidian's command palette. None of them have default hotkeys, so you can set your own.

</td>
</tr>
</table>

## Everything else

- **A "now" marker** for where your story is up to, with an option to fade everything after it.
- **Saved views**: bookmark a stretch of time and come back to it in one click.
- **A minimap** of the whole range, which you can click or drag to move around.
- **Export** as a Markdown table or an outline by era, to the clipboard or a new note.
- **Defaults for new timelines**: save a calendar, formats and colors once, and every new timeline starts with them.
- **Copy and paste** cards, keeping their spacing; paste lands at the pointer.
- **Themes**: Evra takes its colors and fonts from your Obsidian theme, in light and dark.
- **Touch**: pinch to zoom, and press and hold for the menu. (Mobile is the least-tested part of the beta.)

## Documentation

| Guide | What's in it |
|---|---|
| [User guide](docs/user-guide.md) | Cards, spans, eras, selecting, searching, filters, export |
| [Calendars](docs/calendars.md) | Months, leap years, festival days, weekdays, era years, second calendars, importing |
| [Date formats](docs/formats.md) | Every label template and its tokens |
| [Keyboard and mouse](docs/shortcuts.md) | Every shortcut and command |
| [Linked notes and note sync](docs/notes.md) | Linking, previews, covers, property sync |
| [Timelines in notes](docs/embeds.md) | The `evra` code block |
| [File format](docs/file-format.md) | What's inside a `.evra` file |
| [Development](docs/development.md) | Building, testing, the example worlds, releasing |

## Roadmap

**Sub-timelines** are next. You'll be able to link timelines into a tree, like continent › nation › city, or universe › galaxy › planet, and branch a timeline for alternate histories. Parent events will show as context in the timelines below them, and important events will rise into the timelines above. Version 1 of the file format already reserves the fields this needs, so your timelines won't need converting.

Ideas and requests are welcome in [issues](https://github.com/fyresmith/evra/issues).

## Privacy and your files

- **Offline:** Evra works entirely offline. It makes no network requests and collects nothing.
- **Your timelines:** each one is a readable JSON file (`.evra`) in your vault. Evra changes it when you edit that timeline, or when a note it links to is renamed, so the link keeps working.
- **Your notes:** Evra changes a note in two cases only: when you turn on note sync for a timeline that links to it, or when you ask Evra to create a note.

## Contributing

Bug reports, ideas and pull requests are welcome. See [Development](docs/development.md) to build Evra, run the tests, and generate the large example world. Before opening a pull request, run `npm run lint` and `npm test`.

## License

[MIT](LICENSE) © Caleb Smith
