let pass = 0, fail = 0;
export function ok(cond: boolean, msg: string): void {
	if (cond) pass++; else { fail++; console.log('FAIL ' + msg); }
}
export function eq<T>(a: T, b: T, msg: string): void { ok(a === b, `${msg}: expected ${String(b)}, got ${String(a)}`); }
export function done(name: string): void {
	console.log(`${fail ? '✗' : '✓'} ${name}: ${pass} passed${fail ? `, ${fail} failed` : ''}`);
	if (fail) process.exit(1);
}
