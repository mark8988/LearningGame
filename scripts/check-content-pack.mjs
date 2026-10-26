import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { unitSchema, questionSchema, encyclopediaSchema } from '../src/data/schemas.ts';
const root = new URL('../content-packs/science-g3/', import.meta.url);
const read = async file => JSON.parse(await readFile(new URL(file, root), 'utf8'));
const units = z.array(unitSchema).parse(await read('units.json'));
const questions = z.array(questionSchema).parse(await read('questions.json'));
const encyclopedia = z.array(encyclopediaSchema).parse(await read('encyclopedia.json'));
if (units.length !== 5) throw new Error('Built-in pack must have five units');
for (const unit of units) {
  const pool = unit.questionPool.map(id => questions.find(q => q.id === id && q.unitId === unit.id));
  if (pool.length < 1 || pool.some(q => !q) || new Set(unit.questionPool).size !== pool.length) throw new Error(`${unit.id}: nonempty unique valid question pool required`);
  for (const q of pool) if (!q.explanation.trim()) throw new Error(`${q.id}: explanation required`);
  const choices = pool.filter(q => q.type !== 'fillBlank');
  const counts = [0, 1, 2, 3].map(answer => choices.filter(q => q.answerIndex === answer).length);
  if (Math.max(...counts) - Math.min(...counts) > 1) throw new Error(`${unit.id}: choice positions must be balanced`);
  const entries = encyclopedia.filter(entry => unit.encyclopediaIds.includes(entry.id) && entry.unitId === unit.id);
  if (entries.length < 1 || entries.length > 3 || entries.length !== unit.encyclopediaIds.length) throw new Error(`${unit.id}: one to three referenced knowledge entries required`);
}
console.log(`Learning content passed: ${units.length} units, ${questions.length} questions, ${encyclopedia.length} illustrated entries; balanced choice positions and valid references`);
