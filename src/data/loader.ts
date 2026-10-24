import { z } from 'zod';
import { manifestSchema, questionSchema, unitSchema, itemSchema, encyclopediaSchema, achievementSchema, type ContentPack } from './schemas';

export function parseFile<T>(file: string, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`${file}：${result.error.issues.map(issue => `${issue.path.join('.') || '根節點'} ${issue.message}`).join('；')}`);
  return result.data;
}
export function validatePack(files: Record<string, unknown>): ContentPack {
  const pack: ContentPack = {
    manifest: parseFile('pack.json', manifestSchema, files['pack.json']),
    questions: parseFile('questions.json', z.array(questionSchema).min(1), files['questions.json']),
    units: parseFile('units.json', z.array(unitSchema).min(1), files['units.json']),
    items: parseFile('items.json', z.array(itemSchema), files['items.json']),
    encyclopedia: parseFile('encyclopedia.json', z.array(encyclopediaSchema), files['encyclopedia.json']),
    achievements: parseFile('achievements.json', z.array(achievementSchema), files['achievements.json']),
  };
  for (const [file, records] of Object.entries({ 'questions.json': pack.questions, 'units.json': pack.units, 'items.json': pack.items, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements })) {
    const seen = new Set<string>();
    records.forEach((record, i) => { if (seen.has(record.id)) throw new Error(`${file}：${i}.id 重複 ${record.id}`); seen.add(record.id); });
  }
  const units = new Set(pack.units.map(u => u.id));
  const questions = new Map(pack.questions.map(q => [q.id, q]));
  const entries = new Map(pack.encyclopedia.map(e => [e.id, e]));
  pack.manifest.unitIds.forEach((id, i) => { if (!units.has(id)) throw new Error(`pack.json：unitIds.${i} 找不到 ${id}`); });
  if (pack.manifest.unitIds.length !== pack.units.length || new Set(pack.manifest.unitIds).size !== pack.units.length) throw new Error('pack.json：unitIds 必須完整且不重複');
  pack.units.forEach((u, i) => {
    if (new Set(u.questionPool).size !== u.questionPool.length) throw new Error(`units.json：${i}.questionPool 題目重複`);
    u.questionPool.forEach((id, j) => { if (questions.get(id)?.unitId !== u.id) throw new Error(`units.json：${i}.questionPool.${j} 找不到同單元題目 ${id}`); });
    u.encyclopediaIds.forEach((id, j) => { if (entries.get(id)?.unitId !== u.id) throw new Error(`units.json：${i}.encyclopediaIds.${j} 找不到同單元條目 ${id}`); });
    if (u.unlockAfter && (!units.has(u.unlockAfter) || pack.units.find(v => v.id === u.unlockAfter)!.order >= u.order)) throw new Error(`units.json：${i}.unlockAfter 必須指向前一單元`);
  });
  pack.questions.forEach((q, i) => { if (!units.has(q.unitId)) throw new Error(`questions.json：${i}.unitId 找不到 ${q.unitId}`); });
  pack.achievements.forEach((a, i) => { if (a.rewardItemId && !pack.items.some(item => item.id === a.rewardItemId)) throw new Error(`achievements.json：${i}.rewardItemId 找不到道具`); });
  return pack;
}

const modules = import.meta.glob('../../content-packs/science-g3/*.json', { eager: true, import: 'default' });
export function loadBuiltinPack(): ContentPack {
  const files = Object.fromEntries(Object.entries(modules).map(([path, value]) => [path.split('/').pop()!, value]));
  const pack = validatePack(files);
  console.info(`[內容包] ${pack.manifest.name}：${pack.units.length} 個單元，${pack.questions.length} 題`);
  return pack;
}
