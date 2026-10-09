# Troubleshooting

Common problems and what to do about each. If yours isn't here,
[open an issue](https://github.com/fyresmith/evra/issues) and say what you did, what you expected and what happened.

## A timeline won't open

Evra shows a message in place of the timeline and leaves the file exactly as it is.

- **It was saved by a newer version of Evra.** The message says so. Update Evra under **Settings → Community plugins
  → Check for updates**.
- **The file isn't valid JSON.** This can happen while a sync tool is half-way through writing it; it opens once the
  file is whole again, and edits you hadn't saved are kept. If it was edited by hand, fix the JSON in a text editor.
  [File format](dev/file-format.md) says what belongs in it.

## Keyboard shortcuts do nothing

Shortcuts work while a timeline has focus. Click the timeline first if another pane has it. Press **?** in a timeline
for the list.

Evra's commands have no default hotkeys. Assign your own in Obsidian's **Settings → Hotkeys**: search for "Evra".

## A timeline doesn't reach my other devices

Obsidian Sync carries `.evra` files only with **Sync all other types** on, in its settings, on each device.

## A notice says both sets of changes were kept

The timeline's file changed on disk (a sync tool, another device) while you had unsaved edits to it. Evra merged the
two rather than drop either. Look over the cards you were working on.

## Cards are only on one side of the line

On a phone, or in a narrow pane, a vertical timeline puts every card on one side so none are cut off. Widen the pane
and they go back to their own sides.

## I can't find a card

- Press **Ctrl/⌘ K** and type part of its name.
- Check the filter: a pill at the top right shows when one is on, and cards that don't match are faded or hidden.
- Press **F** to fit everything on screen. Zoomed far out, cards become dots and close dots merge into numbered
  clusters: click a cluster to zoom into it.

## A note's properties aren't updating

Note sync is off until you turn it on, for each timeline: **Settings → Notes → Write timeline properties into linked
notes**, in the timeline's own settings panel. It writes only to notes the timeline links to, and only the fields
ticked under **Properties to sync**. See [Linked notes and note sync](notes.md#note-sync).

## An embed shows the wrong timeline

Without a `timeline` option, an `evra` code block uses a timeline in the same folder as the note, or else the first
one in the vault. Name the one you mean: `timeline: Chronicle of Veld`. See [Timelines in notes](embeds.md).

## I turned Evra off and my timelines vanished from the file explorer

They're still there. Obsidian lists `.evra` files only while Evra is on, or with **Detect all file extensions** on
under **Settings → Files and links**.
