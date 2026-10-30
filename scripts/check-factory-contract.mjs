import { readdir, readFile } from 'node:fs/promises';
import { validatePack } from '../src/data/validation.ts';
const folder = new URL('../.local/factory-contracts/', import.meta.url);
const names = (await readdir(folder)).filter(name => name.endsWith('.json'));
if (!names.length) throw new Error('Run .NET PackageTests before checking the factory/game contract.');
for (const name of names) {
  const envelope = JSON.parse(await readFile(new URL(name, folder), 'utf8'));
  if (envelope.format !== 'learning-adventure:pack' || envelope.version !== 1) throw new Error(`${name}: envelope mismatch`);
  const pack = validatePack(envelope.files);
  if (!pack.manifest.provenance || pack.questions.length < 20) throw new Error(`${name}: missing factory provenance`);
}
console.log(`Factory/game contract passed: ${names.length} real .NET packages accepted by the game validator`);
