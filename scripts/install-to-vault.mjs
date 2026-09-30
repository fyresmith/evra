// Copies the built plugin into a vault (default: ./test-vault) and fills an empty test vault with the sample world.
//   npm run build && npm run install-vault [-- /path/to/vault]
import esbuild from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const vault = process.argv[2] || 'test-vault';
if (!existsSync('main.js')) { console.error('Run "npm run build" first.'); process.exit(1); }
const dest = `${vault}/.obsidian/plugins/evra`;
mkdirSync(dest, { recursive: true });
for (const f of ['main.js', 'manifest.json', 'styles.css']) copyFileSync(f, `${dest}/${f}`);

const enabled = `${vault}/.obsidian/community-plugins.json`;
const list = existsSync(enabled) ? JSON.parse(readFileSync(enabled, 'utf8')) : [];
if (!list.includes('evra')) { list.push('evra'); writeFileSync(enabled, JSON.stringify(list, null, 2)); }

if (vault === 'test-vault' && !existsSync(`${vault}/Chronicle of Veld.evra`)) {
	await esbuild.build({ entryPoints: ['scripts/sample-files.ts'], bundle: true, platform: 'node', format: 'cjs', outfile: 'test-dist/sample-files.cjs', logLevel: 'error' });
	execFileSync(process.execPath, ['test-dist/sample-files.cjs', vault]);
}
console.log(`Installed Evra into ${dest}. In Obsidian: Settings → Community plugins → turn on Evra (and turn off Restricted mode if asked).`);
