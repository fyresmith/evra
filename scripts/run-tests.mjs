// Bundles each tests/*.test.ts for Node (with a stand-in for the "obsidian" module) and runs it.
import esbuild from 'esbuild';
import { readdirSync } from 'fs';
import { spawnSync } from 'child_process';

const files = readdirSync('tests').filter((f) => f.endsWith('.test.ts'));
let failed = 0;
for (const f of files) {
	const out = `test-dist/${f.replace(/\.ts$/, '.cjs')}`;
	await esbuild.build({ entryPoints: [`tests/${f}`], bundle: true, platform: 'node', format: 'cjs', outfile: out, alias: { obsidian: './tests/obsidian-stub.ts' }, logLevel: 'error' });
	const r = spawnSync(process.execPath, [out], { stdio: 'inherit' });
	if (r.status !== 0) failed++;
}
if (failed) { console.error(`\n${failed} test file(s) failed`); process.exit(1); }
console.log('\nAll tests passed');
