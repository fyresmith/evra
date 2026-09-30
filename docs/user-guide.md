# User guide

This guide covers everything you can do inside a timeline. For calendars and date formats, see [Calendars](calendars.md) and [Date formats](formats.md).

In these docs, **Settings → …** means the timeline's own settings panel: the sliders button at the bottom right of a timeline. Each timeline has its own calendar, formats and colors. Obsidian's **Settings → Evra** holds only a few plugin-wide options, such as where new timelines are saved.

## The layout

A timeline is one line of time.

- **Cards** sit on either side of the line, and a short stem joins each card to its date. When cards are close together, they stack outward from the line. Each card sits as close to the line as it can, and slides a little along the line before it moves further out. Cards never shrink to fit. When there are more cards than fit across the view, the timeline scrolls sideways: use Shift + scroll, a trackpad, or the scrollbar at the edge.
- **The year ruler** runs along the edge of the view, with faint guide lines across it. The line itself stays uncluttered.
- **The era rail** sits beside the ruler. It has one bar per era, at every depth.
- **The breadcrumb** at the top left names the eras at the middle of the view. Click a name to fit that era to the screen. Click the ⌄ next to a name to jump to a sibling era.
- **The controls** sit at the bottom right: zoom in, zoom out, fit everything, saved views, filter, change direction, settings and shortcuts.
- **The minimap** sits along the right edge (along the top when the timeline is horizontal). It shows the whole range, and a box marks the part you're looking at. Click or drag the minimap to move.

## Zooming and moving

- **Scroll** to move through time.
- **Ctrl/⌘ + scroll** (or pinch) zooms around the pointer.
- **Dragging empty space** pans in both directions.
- **F** fits everything on screen.
- **Z** zooms to the selected cards.
- **G** jumps to a date you type.

The ruler adapts as you zoom, from millennia down to single days.

As you zoom out, cards change form:

- Full cards become **compact** cards (a single line each). Hover a compact card to see it at full size.
- Further out, cards become **dots**, and close dots merge into a numbered cluster. Click a cluster to zoom into it.
- A year with more than three events on one side (you can change the number) collapses into a **group card**. Click the group to list its events, or double-click it to spread them out.

## Events

| To | Do this |
|---|---|
| Add an event | Double-click beside the line. The card lands on the nearest year, on the side you clicked. Or press **N**. |
| Edit | Double-click a card, or select it and press **E** or **↵**. Type the title, press ↵, then type a description of up to 256 characters. |
| Write several in a row | While editing a description, press ↵ to save and start the next event. |
| Move | Drag the card. It snaps to the ruler's marks. Hold **Alt** to move by single days. Drag it across the line to switch sides. |
| Nudge | **↑ ↓** (or **← →** when the timeline is horizontal) move the selection by one ruler mark. The other two arrow keys switch sides. |
| Color | Click **⋯** on the card and pick a swatch, or press **1–9**. **0** clears the color. |
| Delete | **⌫**, or **⋯ → Delete**. Every change can be undone. |

Starting a new edit always saves the one in progress.

A card grows to fit its description. A card without a description shrinks to just its title and date.

### Card options

Click **⋯** on a card (or press **L**) to open its options:

- **Color**, including **+** to make a new color preset from any color.
- **Link to note…** or **Convert to note**. Convert to note turns the card's title and description into a new note.
- **Icon**: a small glyph before the title.
- **Tags**, separated by commas. Tags can be filtered.
- **Make it a span**, or **Make it a single moment**.
- **Approximate**: shows the date as "c. Year 49", with a soft haze along the line of ± a month to ± a century.
- **Pin relative to** another card. The pinned card keeps its distance ("5 years, 7 months after The pale comet") and follows when the other card moves.
- **People involved**: shows the ages of the people you tick. See [Lifespans](#lifespans).
- **Move to other side**, **Duplicate**, **Delete**.

## Spans

A span has a start and an end, such as a war, a reign, a voyage or a life. To make one:

- drag a moment's dot along the line;
- drag along the line and choose **New span**;
- choose **Make it a span** in the card's options; or
- select a card and press **S**.

By default, each span is a **thread**. It curves off the line at its start, runs in a lane beside the line, and rejoins the line at its end. Its card attaches anywhere along the thread. While you scroll through the middle of a long span, its name stays pinned to the edge of the view. When more than six spans overlap on one side, the extra ones share a single lane marked **+N**.

The dots at a span's two ends are handles, and you can drag either one. If the two dots overlap, the direction you drag decides which end moves.

In the card options you can mark a span as having an **Unknown start** or as **Ongoing**.

If you prefer shaded blocks to threads, change it in **Settings → Cards → Spans**.

### Lifespans

Mark a span as **Someone's life** in its options, and other cards show that person's age:

- if the card's description links to them, such as `[[Mira Ashdown]]`;
- if the card's note links to them; or
- if you tick them under **People involved**.

## Eras

Eras divide the line and nest inside each other to any depth.

- **Create an era:** drag along the line, then choose **New era**. If the stretch you dragged falls inside an existing era, the menu says **New sub-era of …**. You can also right-click and choose **Add an era here**.
- **Edit an era:** click its label, its bar in the rail, or its name in a right-click menu. In the editor you can rename it and set its abbreviation (used in [era-relative years](calendars.md#years-within-an-era)). You can also type exact start and end dates, pick a color, and add a sub-era inside it.
- **Resize an era:** drag its edge from anywhere across the timeline.
  - Where two eras share an edge, they move together. Hold **Alt** to move just one.
  - An era stays inside its parent and never overlaps its neighbours.
- **Fit an era to the screen:** right-click its label, click it in the breadcrumb, or right-click the timeline and choose **Fit "…" to screen**.
- **Delete an era:** use the button in its editor. Its sub-eras move up a level.

## Selecting several cards

- **Shift + click** adds a card to the selection, or removes it.
- **Shift + drag** on empty space draws a selection box.
- **Ctrl/⌘ A** selects every card.

With several cards selected, dragging one card moves them all. Their shared options menu lets you color, flip sides, copy, duplicate, zoom to or delete them together.

**Ctrl/⌘ C** copies the selected cards. **Ctrl/⌘ V** pastes them at the pointer, keeping their spacing. **Ctrl/⌘ D** duplicates them.

## Search and commands

Press **Ctrl/⌘ K** or **/** to search cards, eras and notes. Type a date, such as `412`, `Frost 412` or `14 Frost, Year 412`, to jump straight to it. Type **>** first to run a command instead.

Every timeline command is also in Obsidian's command palette, under **Evra**. None of them have default hotkeys, so you can assign your own in **Settings → Hotkeys**.

## Filters

The filter button narrows the timeline by:

- text,
- color,
- tag,
- era,
- side, or
- whether a card links to a note.

Cards that don't match either **fade** or **hide**. A pill at the top right shows how many cards match. Filters belong to the view you're looking at; they aren't saved in the file.

## Now

Right-click and choose **Set "now" here** to mark where your story is up to, such as a campaign's current date. You can also set it under **Settings → Timeline → Now**, where you can choose to fade everything after it. Press **.** to go to now.

## Saved views

Press **B** or use the bookmark button to save what you're looking at under a name. Saved views are stored in the timeline file. Each window also remembers its own zoom and scroll position.

## Direction

Timelines run top to bottom by default. You can switch to bottom to top, left to right, or right to left with the arrow button, in **Settings → Timeline**, or with a command.

## Export

In **Settings → Timeline → Export**, or from the command palette, you can:

- **Copy as a Markdown table**: date, event, side and tags.
- **Copy as an outline by era**: headings for each era, with events listed beneath.
- **Copy the timeline file**: the raw JSON.
- **Copy an embed for this view**: an [`evra` code block](embeds.md) for the stretch of time on screen.
- **Save the table** or **Save the outline** as a new note next to the timeline.

## Undo

**Ctrl/⌘ Z** undoes and **Ctrl/⌘ Shift Z** redoes. The arrows in the view's header do the same. Undo covers everything in the timeline file: cards, eras, the calendar, formats and colors. It doesn't cover changes that note sync made to your notes. Those notes have their own history.
