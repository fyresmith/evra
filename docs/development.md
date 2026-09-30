# Development

## Setup

You need Node.js 18 or later.

```sh
npm install
npm run dev            # rebuild main.js on every change
npm run build          # type-check and build a minified main.js
npm test               # calendar, formatting and note-sync tests
npm run lint           # ESLint with eslint-plugin-obsidianmd (the rules used in plugin review)
npm run install-vault  # copy the plugin into ./test-vault (or: npm run install-vault -- /path/to/vault)
npm run e2e            # end-to-end tests in real Obsidian (headless; see below)
npm run big-world      # generate Aerth, a large example world (~2,700 notes, 91 eras), in test-vault/Aerth
```

`test-vault/` is a small vault containing the sample world. Open it in Obsidian with **Open folder as vault**, then turn on Evra under **Settings → Community plugins**. After a rebuild, run `npm run install-vault` again and reload Obsidian, or use the Hot Reload plugin.

## Layout

| File | What it holds |
|---|---|
| `src/main.ts` | The plugin: registers the view and the `.evra` extension, commands, the ribbon button, the `evra` code block, and events for renamed or changed notes |
| `src/view.ts` | `EvraView`, a `TextFileView` for `.evra` files: loading, saving, undo buttons, workspace state, and the notes adapter the timeline uses |
| `src/timeline.ts` | The timeline itself: layout, drawing, pointer and keyboard handling, cards, eras, popovers, the settings panel, search, minimap, filters and export |
| `src/engine.ts` | The calendar engine: dates as day counts, months, leap rules, weekdays, era years, templates, ruler marks and snapping |
| `src/model.ts` | The document model: defaults, upgrading older files, presets, calendar import and the sample world |
| `src/sync.ts` | Note sync: which properties to write, and reading dates back from notes |
| `src/text.ts` | Note excerpts and inline formatting on cards |
| `src/embed.ts` | The `evra` code block |
| `src/notes.ts` | Note text and cover images, cached for cards |
| `src/settings.ts` | The plugin settings tab |
| `src/commands.ts` | The timeline commands, shared by Obsidian's command palette and the timeline's own search |
| `src/types.ts` | The file format as TypeScript types |
| `styles.css` | All styles, scoped under `.evra-view` and `.evra-embed` |
| `tests/` | Node tests for the engine and sync, and a browser harness for the view |

### How the timeline draws

`mountTimeline()` builds the view once, then redraws on demand in a `requestAnimationFrame` loop.

- **The SVG layer** holds the line, the eras, the threads, the stems and the dots. It is rebuilt every frame.
- **The HTML card layer** is updated in place. A card only re-renders when its content signature changes.
- **Cards are laid out by `pack()`**, a cost-based placer. Each card either slides along the time axis or moves one column outward, whichever costs less. Only cards within a screen of the view are laid out.
- **Cross-axis scrolling** moves the card layer with a CSS transform, so scrolling never triggers the stacking animation.

All HTML is built from escaped strings and parsed through Obsidian's `sanitizeHTMLToDom`. SVG is created element by element.

### Styling

Colors and fonts come from Obsidian's theme variables. They are mapped to `--evra-*` variables at the top of `styles.css`. Themes and CSS snippets can override those variables on `.evra-view`.

Inside the view, form controls are reset to the browser's own look and then styled by Evra, so they look the same in every theme.

## End-to-end tests

`npm run e2e` runs the whole plugin inside a real, headless Obsidian. It uses its own throwaway profile and a throwaway copy of `test-vault`, so nothing real is touched. The tests click, drag and type the way a person would, and each one fails if Obsidian logs an error.

```sh
npm run build && npm run install-vault
npm run e2e                          # everything, light theme
npm run e2e -- --theme both          # light and dark
npm run e2e -- --grep "note sync"    # just the tests whose names match
npm run e2e -- --repeat 3            # run everything several times
```

Screenshots of failures go to `test-dist/e2e-failures`. Obsidian is found at `/usr/lib/electron43/electron` and `/usr/lib/obsidian/app.asar`; set `OBSIDIAN_ELECTRON` and `OBSIDIAN_ASAR` for other installs. The scenarios live in `tests/e2e/specs.mjs`.

## Visual harness

`tests/ui/` renders the timeline in a plain browser page. It uses Obsidian's own `app.css` and `enhance.js`, a stand-in host and the sample world. This is handy for checking layout without starting Obsidian:

```sh
node tests/ui/build.mjs /path/to/extracted/obsidian.asar   # writes test-dist/ui/light.html and dark.html
chromium --headless=new --allow-file-access-from-files --screenshot=shot.png --window-size=1200,820 test-dist/ui/light.html
```

After `npm run big-world`, the build also writes `light-aerth.html` and `dark-aerth.html` for the large world. Add `?slow` to the page address to make every note lookup cost about what it does in Obsidian; that is how the performance work was measured.

To extract `app.css` and `enhance.js`, run `npx asar extract /usr/lib/obsidian/obsidian.asar obs` (the path varies by platform).

## Releasing

1. Update `CHANGELOG.md`.
2. Run `npm version patch` (or `minor` or `major`). This bumps `package.json`, `manifest.json` and `versions.json`.
3. Push the commit and its tag: `git push && git push --tags`.
4. The **Release** GitHub Action checks and builds the plugin, then publishes a release with `main.js`, `manifest.json` and `styles.css` attached, using that version's section of `CHANGELOG.md` as its notes. (A `0.x` tag, from before 1.0, makes a draft pre-release instead.)

The release tag must match the version in `manifest.json` exactly, with no `v` prefix. `npm version` is set up to create tags that way (see `.npmrc`).

### Submitting to the community plugin list

Obsidian's docs describe the full process: <https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin>. In short:

1. Make sure the repository is public, with `README.md`, `LICENSE` and `manifest.json` at its root. The directory reads `manifest.json` from the default branch, so push it first.
2. Publish a GitHub release as described above. Its tag must equal the manifest version, and it must have `main.js`, `manifest.json` and `styles.css` attached.
3. Sign in at <https://community.obsidian.md> with an Obsidian account, link the GitHub account that owns the repository, and add the plugin to the directory.
4. An automated review runs the same kinds of checks as `npm run lint`. To address its feedback, fix the issue and publish a new release with a higher version.

The plugin's id (`evra`) must stay unique and can't contain "obsidian".

## Contributing

Issues and pull requests are welcome. Before opening a pull request, run `npm run build`, `npm run lint` and `npm test`. Keep UI text in sentence case. Don't add default hotkeys to commands.
