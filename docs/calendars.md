# Calendars

Each timeline has its own calendar, set in **Settings → Calendar**. Changes apply at once, and **Ctrl/⌘ Z** undoes them.

Dates are stored as a count of days. When you change the calendar, **Keep events on the same day when months change** (on by default) keeps every card on the same named day. For example, "14 Frost, Year 412" stays "14 Frost, Year 412" even if Frost moves or gets shorter.

## Starting points

**Start from** replaces the months with a preset:

| Preset | Months |
|---|---|
| Twelve months of 30 days | Thaw, Seedfall, Bloom … Stillwater (360 days) |
| Gregorian | January to December, with leap years every 4 years except every 100, unless every 400, and Monday to Sunday weekdays |
| Earth-like | January to December, 365 days, no leap years |
| Thirteen moons | 13 months of 28 days |
| Four seasons | 91 days each |
| Years only | One unnamed month of 365 days: dates show years only |

## Months

Each month has a name and its own length. You can:

- drag the ⋮⋮ handle to reorder months,
- use **×** to remove one,
- use **Add a month**, or
- use **Make all months equal**.

A month without a name shows as "Month 3".

### Festival days

Tick **Fest.** to turn a month into festival days, like Midwinter or the Feast of Fools. Festival days sit between months and belong to none of them. They count toward the year, and a date on one reads as just its name: "Midwinter, Year 5". The **Festival days** format controls how those dates look.

## Leap days

A leap rule adds days to one month in some years:

> Add **1** day(s) to **February** every **4** years, except every **100**, unless every **400**.

- *Except* and *unless* are optional.
- You can add several rules, for calendars with more than one kind of leap year.
- The summary under **Months** shows the average year length, for example "365.2425 on average".

## Weekdays

List the names of your weekdays in order, separated by commas. Then choose which weekday the first day of year 0 falls on. Use `{W}` (the full name) or `{Wo}` (the first three letters) in a [date format](formats.md) to show weekdays.

## Unit names

Rename the day, month and year units, and the plural of year. For example, "cycle" and "cycles" instead of "year" and "years". These names appear in:

- dates, through `{U}`;
- labels such as "+10 cycles";
- the snapping options;
- menus such as "± 5 cycles".

## Numbering

**The first year is numbered** sets what year 0 is called. For example, set it to 1 to count from Year 1, or to 1200 to start in 1200. Years before it count down, using the **Years before zero** format ("Year −13").

### Years within an era

Dates can count from the start of the top-level era they fall in, for example "12 SA" for the twelfth year of the Second Age. Put these tokens in the **Year** format:

- `{EY}`: the year within the era;
- `{E}`: the era's abbreviation. By default this is the initials of its name, leaving out "the", "of", "a" and "an". You can set your own in the era's editor.
- `{EN}`: the era's full name.

**Within an era, years count from** sets whether an era's first year is 1 or 0.

## Second calendar

Show a second year count alongside the first, such as another people's reckoning or a regnal calendar:

- **Name**: shown when you hover over its ruler.
- **Days in its year**: this can differ from the main calendar's year.
- **Year label**: `{Y}` is its year number. For example, `{Y} SR`.
- **Its year 0 begins on**: the date where it starts counting.
- **Show it on cards too**: adds the second year after each card's date.

Its years appear on a second ruler, in the accent color, on the far side of the view.

## Importing

To reuse a calendar from another plugin or app, paste its export into **Import** and click **Import calendar**. Evra reads the months (with festival months), leap days and weekdays from:

- **Calendarium** (Obsidian plugin): a calendar exported as JSON.
- **Fantasy-Calendar** (fantasy-calendar.com): the JSON export.

Moons, seasons and events aren't imported. Evra has no use for them yet.

## Saving a calendar for new timelines

Once a calendar is set up the way you like, go to **Settings → Timeline → Defaults** and choose **Use these settings for new timelines**. Every new timeline will start with this calendar, its formats, its colors and its card options. You can forget the saved settings in Obsidian's **Settings → Evra**.
