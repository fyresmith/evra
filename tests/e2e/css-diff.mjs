// Compares two captures from css-capture.mjs:  node tests/e2e/css-diff.mjs before.json after.json
import { readFileSync } from 'fs';
const [a, b] = process.argv.slice(2).map((f) => JSON.parse(readFileSync(f, 'utf8')));
const PROPS = readFileSync('tests/e2e/css-capture.mjs', 'utf8').match(/const PROPS = (\[[\s\S]*?\]);/)[1];
const names = eval(PROPS);
let n = 0; const seen = new Map();
for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
	if (a[k] === b[k]) continue;
	if (!(k in a) || !(k in b)) { n++; if (n < 15) console.log(k in a ? 'only before' : 'only after', k.slice(0, 160)); continue; }
	const x = a[k].split('|'), y = b[k].split('|');
	x.forEach((v, i) => { if (v !== y[i]) { n++; const sig = names[i] + ': ' + v + ' → ' + y[i]; seen.set(sig, (seen.get(sig) || []).concat(k)); } });
}
for (const [sig, ks] of seen) console.log(ks.length + '× ' + sig.slice(0, 200) + '\n     e.g. ' + ks[0].slice(0, 170));
console.log(n, 'differences');
