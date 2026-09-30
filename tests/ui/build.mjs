import esbuild from 'esbuild';
import { copyFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
const OBS = process.argv[2];
await esbuild.build({ entryPoints: ['tests/ui/harness.ts'], bundle: true, format: 'iife', outfile: 'test-dist/ui/harness.js', alias: { obsidian: './tests/ui/obsidian-dom.ts' }, logLevel: 'error' });
copyFileSync(`${OBS}/app.css`, 'test-dist/ui/app.css');
copyFileSync(`${OBS}/enhance.js`, 'test-dist/ui/enhance.js');
copyFileSync('styles.css', 'test-dist/ui/styles.css');
for (const [theme, extra] of [['light', ''], ['dark', ''], ['light', 'aerth'], ['dark', 'aerth']]) writeFileSync(`test-dist/ui/${theme}${extra ? '-' + extra : ''}.html`, `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="app.css"><link rel="stylesheet" href="styles.css"><style>html,body{height:100%;margin:0}.workspace-leaf-content{position:absolute;inset:0;display:flex;flex-direction:column}.view-content{flex:1;height:100%}</style></head>
<body class="theme-${theme} mod-linux is-frameless"><div class="workspace-leaf-content"><div class="view-content"></div></div><script src="enhance.js"></script>${extra ? `<script src="${extra}.js"></script>` : ''}<script src="harness.js"></script></body></html>`);

// the large example world, when it has been generated (npm run big-world)
const W = 'test-vault/Aerth';
if (existsSync(`${W}/Chronicle of Aerth.evra`)) {
	const notes = {};
	for (const d of ['People', 'Places', 'Factions', 'Artifacts', 'Events']) for (const f of readdirSync(`${W}/${d}`)) notes[`${d}/${f.replace(/\.md$/, '')}`] = readFileSync(`${W}/${d}/${f}`, 'utf8');
	writeFileSync('test-dist/ui/aerth.js', 'window.AERTH=' + JSON.stringify({ doc: JSON.parse(readFileSync(`${W}/Chronicle of Aerth.evra`, 'utf8')), notes }));
}
