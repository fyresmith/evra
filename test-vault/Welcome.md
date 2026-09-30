# Evra test vault

This vault holds the sample world, the **Chronicle of Veld**. Open `Chronicle of Veld.evra` to see the timeline.

Things to try:
- Double-click beside the line to add an event; double-click a card to edit it.
- Drag along the line to make an era or a span.
- Drag a note from the file explorer onto the timeline.
- Right-click an era label to fit it to the screen.
- Open the settings panel (the sliders button, bottom right) and turn on note sync under **Notes**.

A timeline inside a note:

```evra
timeline: Chronicle of Veld
era: Reign of Ash
```

## A big world

The `Aerth` folder holds a generated world for trying Evra at scale: about 2,700 notes and 1,900 cards across 3,000 years, with 91 eras nested four deep, on its own calendar (ten months, a festival week, leap days, a nine-day week and a second "Elven" year count). Open `Aerth/Chronicle of Aerth.evra`. Regenerate it with `npm run big-world`.
