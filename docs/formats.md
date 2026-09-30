# Date formats

Every date label Evra shows comes from a template. You can edit the templates in **Settings → Formats**. Each field shows a live preview. To insert a token, click it in the token list and it goes into the field you last edited.

## Tokens

| Token | Meaning | Example |
|---|---|---|
| `{year}` | The year, written with the **Year** format | Year 412 |
| `{Y}` | Year number | 412 |
| `{U}` | Year unit name, capitalized | Year |
| `{M}` | Month name | Frost |
| `{Mo}` | Month name, first three letters | Fro |
| `{m}` | Month number | 10 |
| `{D}` | Day of the month | 14 |
| `{Do}` | Day as an ordinal | 14th |
| `{W}` | Weekday | Moonday |
| `{Wo}` | Weekday, first three letters | Moo |
| `{EY}` | Year within its top-level era | 12 |
| `{E}` | That era's abbreviation | SA |
| `{EN}` | That era's name | The Second Age |

A token that means nothing for a date, such as a weekday when you haven't named any, is simply left out. Extra spaces are tidied away.

## Templates

| Group | Template | Used for | Default |
|---|---|---|---|
| Years | Year | Every year label | `{U} {Y}` |
| | Years before zero | Years before year 0 (`{Y}` is positive here) | `{U} −{Y}` |
| Dates on cards | Exact day | A date with a day | `{D} {M}, {year}` |
| | Month only | The first day of a month | `{M}, {year}` |
| | Whole year | The first day of a year | `{year}` |
| | Festival days | A date on a festival day | `{M}, {year}` |
| Ruler on the line | Year marks | Year labels on the ruler | `{year}` |
| | Month marks | Month labels on the ruler | `{M}` |
| | Day marks | Day labels on the ruler | `{D} {Mo}` |
| Spans | Start to end | A span's dates (`{start}`, `{end}`) | `{start} – {end}` |
| | Word for an ongoing span | Replaces the end of an ongoing span | `ongoing` |
| Approximate dates | Circa | An approximate date (`{date}`) | `c. {date}` |

With **Shorten whole-year spans** on, a span from the start of one year to the start of another reads as "Year 30–44" instead of "Year 30 – Year 44".

A card falling on the first day of a year shows the **Whole year** format, and one on the first day of a month shows **Month only**. This way, dates you only know to the year or month don't look more precise than they are.

## Examples

| Style | Year | Exact day |
|---|---|---|
| Plain numbers | `{Y}` | `{D}/{m}/{Y}` |
| No unit word | `{Y}` | `{Do} of {M}, {Y}` |
| Era years | `{EY} {E}` | `{D} {M} {EY} {E}` → 14 Frost 12 SA |
| With weekdays | `{U} {Y}` | `{W}, {D} {M}, {year}` |
| Before and after | Year: `{Y} AR`, before zero: `{Y} BR` | `{D} {M} {year}` → 3 Thaw 40 BR |

**Reset all formats** puts every template back to its default.
