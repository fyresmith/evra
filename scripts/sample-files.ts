// Writes the sample world into a folder: node (bundled) sample-files.cjs <folder>
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { SAMPLE_COVER, SAMPLE_NOTES, sampleDoc } from '../src/model';

const dir = process.argv[2];
mkdirSync(dir, { recursive: true });
for (const [name, text] of Object.entries(SAMPLE_NOTES)) if (!existsSync(`${dir}/${name}.md`)) writeFileSync(`${dir}/${name}.md`, text);
if (!existsSync(`${dir}/The Heron.svg`)) writeFileSync(`${dir}/The Heron.svg`, SAMPLE_COVER);
if (!existsSync(`${dir}/Chronicle of Veld.evra`)) writeFileSync(`${dir}/Chronicle of Veld.evra`, JSON.stringify(sampleDoc(), null, '\t'));
