# The .evra file format (version 1)

A timeline is a single UTF-8 JSON file with the `.evra` extension, indented with tabs. It is meant to be readable, diffable and safe to edit by hand. Evra fills in anything missing when it opens a file. If a file isn't valid JSON, Evra shows a message and leaves the file untouched.

## Dates

Every date is an integer: the number of days since day 1 of year 0 of the timeline's own calendar. Negative numbers are before year 0. The calendar (months, leap rules) decides which day number falls on which named date. To keep every event on the same named day when the calendar changes, Evra rewrites the stored numbers.

Year numbers in `range` and in `from` and `to` in embeds are the calendar's internal year numbers, before `yearStart` is added.

## Top level

```jsonc
{
	"format": "evra",          // always "evra"
	"version": 1,              // this document's format version
	"name": "Chronicle of Veld",
	"cal": { … },              // the calendar, below
	"palette": [ … ],          // color presets, below
	"opts": { … },             // display options, below
	"range": [0, 80],          // first and last year of the line
	"orientation": "ttb",      // "ttb" | "btt" | "ltr" | "rtl"
	"cardWidth": 240,          // px, 160–360
	"eras": [ … ],
	"events": [ … ],
	"now": 18839,              // optional: the "now" marker (a day), or null
	"views": [ … ],            // optional: saved views
	"lastView": [10440, 16920],// optional: the starting view for a new window (days)

	// Reserved for sub-timelines (planned). Evra 1.x keeps these but doesn't use them yet.
	"parent": "[[World]]",     // a link to the parent timeline
	"kind": "scope",           // "scope" (a part of the parent) or "branch" (a fork)
	"forkAt": 12000            // for branches: the day the branch splits off
}
```

## Events

```jsonc
{
	"id": "k3j9x0a",           // unique within the file; keep ids stable
	"t": 13680,                // the date (a span's start)
	"end": 15900,              // optional: makes the card a span
	"side": "a",               // "a": left or top; "b": right or bottom
	"title": "Siege of the Keep begins",
	"text": "Ashen banners on the east bank…",  // up to 256 characters; **bold**, *italic* and [[links]] display
	"color": "1",              // a palette id, or null
	"file": "Fall of the River Keep",  // optional: a linked note (link text without ".md"), or null
	"os": true,                // optional: unknown start
	"oe": true,                // optional: ongoing
	"icon": "⚔",               // optional
	"tags": ["war", "keep"],   // optional
	"circa": 360,              // optional: ± this many days
	"life": true,              // optional: a span that is someone's life
	"people": ["id1", "id2"],  // optional: lifespans involved
	"rel": { "to": "id", "from": "start", "offset": 2040, "at": 19800 },
	                           // optional: pinned to another card's start or end; offset is kept current

	// Reserved for sub-timelines (planned):
	"importance": 2,           // 1–3: how far up the tree this event shows
	"promote": true            // always show in the parent timeline
}
```

When a card links to a note, the note's name is the card's title, and `title` and `text` are ignored.

## Eras

```jsonc
{ "id": "s1", "parent": "s", "name": "Reign of Ash", "start": 7920, "end": 16920, "color": "1", "abbr": "RA" }
```

- `parent` is another era's id, or `null` for a top-level era.
- An era lies inside its parent's `start` and `end`, and doesn't overlap its siblings.
- `end` is exclusive.
- `abbr` is optional. It is used for `{E}`, and defaults to the name's initials.

## Calendar

```jsonc
{
	"months": [ { "id": "m1", "name": "Thaw", "days": 30, "inter": false } ],   // inter: festival days
	"units": { "day": "day", "month": "month", "year": "year", "years": "years" },
	"fmt": { "year": "{U} {Y}", "yearNeg": "{U} −{Y}", "dateDay": "{D} {M}, {year}", "dateMonth": "{M}, {year}",
	         "dateYear": "{year}", "dateInter": "{M}, {year}", "circa": "c. {date}", "tickYear": "{year}",
	         "tickMonth": "{M}", "tickDay": "{D} {Mo}", "range": "{start} – {end}", "ongoing": "ongoing", "shortRange": true },
	"yearStart": 0,            // the number shown for year 0
	"leaps": [ { "id": "l1", "month": "m2", "days": 1, "every": 4, "except": 100, "unless": 400, "off": 0 } ],
	"weekdays": ["Moonday", "Tidesday"],
	"weekStart": 0,            // index of the weekday of day 0
	"eraBase": 1,              // 1 or 0: the first year within an era
	"second": { "on": false, "name": "Second calendar", "yearDays": 400, "offset": 0, "fmt": "{Y} SR", "onCards": true }
}
```

A leap rule adds `days` to month `month` in year *y* when *y* − `off` is a multiple of `every`, unless it is also a multiple of `except` (and then only if it is not a multiple of `unless`).

## Palette

```jsonc
[ { "id": "1", "name": "Red", "hex": null }, { "id": "k2x", "name": "Ashen", "hex": "#6b5b73" } ]
```

`hex: null` marks a built-in color that follows the Obsidian theme. The built-ins have ids `"1"` to `"6"`: red, orange, yellow, green, cyan and purple. Cards and eras refer to presets by id, so changing a preset recolors everything that uses it.

## Options

```jsonc
{
	"spanStyle": "threads",    // "threads" | "blocks"
	"groupOver": 3,            // group a year's events on one side past this many (0: never)
	"snapTo": "auto",          // "auto" (the ruler) | "d" | "m" | "y"
	"bands": true,             // shade eras
	"subLabels": true,         // show sub-era names
	"cardLines": 99,           // description lines shown on cards: 0, 2, 4 or 99 (all)
	"tint": true,              // tint cards with their color
	"fadeFuture": false,       // fade what comes after "now"
	"v": 2,
	"sync": {
		"on": false,
		"fields": { "date": { "on": true, "key": "timeline-date" }, … },
		"written": ["timeline-date"],   // property names this timeline has written (so renamed ones can be removed)
		"notes": ["Notes/Veld.md"]      // notes this timeline has written to (so unlinked ones can be cleaned)
	}
}
```

## Saved views

```jsonc
{ "id": "v1", "name": "The war years", "a": 10440, "b": 16200, "x": 0 }
```

`a` and `b` are the first and last day on screen, and `x` is the sideways scroll.

## Compatibility

- Future 1.x versions will only add optional fields.
- Evra keeps fields it doesn't recognize.
- A change that older versions couldn't read would raise `version`.
