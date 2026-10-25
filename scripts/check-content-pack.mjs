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
  if (pool.length < 12 || pool.some(q => !q) || new Set(unit.questionPool).size !== pool.length) throw new Error(`${unit.id}: at least 12 unique valid questions required`);
  for (const q of pool) if (new Set(q.options).size !== 4 || !q.explanation.trim()) throw new Error(`${q.id}: four distinct options and explanation required`);
  for (let answer = 0; answer < 4; answer++) { const ratio = pool.filter(q => q.answerIndex === answer).length / pool.length; if (ratio < 0.15 || ratio > 0.35) throw new Error(`${unit.id}: answer distribution ${answer} invalid`); }
  if (pool.length === 12 && [1, 2, 3].some((difficulty, i) => pool.filter(q => q.difficulty === difficulty).length !== [4, 6, 2][i])) throw new Error(`${unit.id}: difficulty mix must be 4:6:2`);
  const entries = encyclopedia.filter(entry => unit.encyclopediaIds.includes(entry.id) && entry.unitId === unit.id);
  if (entries.length < 2 || entries.length > 3 || entries.length !== unit.encyclopediaIds.length) throw new Error(`${unit.id}: two to three referenced knowledge entries required`);
}
console.log(`Learning content passed: ${units.length} units, ${questions.length} questions, ${encyclopedia.length} illustrated entries; answer distribution and difficulty mix valid`);
