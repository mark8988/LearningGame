import { z } from 'zod';
import { manifestSchema, questionSchema, unitSchema, itemSchema, outfitModelSchema, dropTableSchema, encyclopediaSchema, achievementSchema, knowledgePointSchema, type ContentPack } from './schemas.ts';
import { gameConfig } from './gameConfig.ts';
import { outfitAnchors, styleSlots } from './outfitConfig.ts';

export function parseFile<T>(file: string, schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`${file}：${result.error.issues.map(issue => `${issue.path.join('.') || '根節點'} ${issue.message}`).join('；')}`);
  return result.data;
}
export function validatePack(files: Record<string, unknown>): ContentPack {
  const pack: ContentPack = {
    ...(files['knowledge-points.json'] === undefined ? {} : { knowledgePoints: parseFile('knowledge-points.json', z.array(knowledgePointSchema), files['knowledge-points.json']) }),
    manifest: parseFile('pack.json', manifestSchema, files['pack.json']),
    questions: parseFile('questions.json', z.array(questionSchema).min(1), files['questions.json']),
    units: parseFile('units.json', z.array(unitSchema).min(1), files['units.json']),
    items: parseFile('items.json', z.array(itemSchema), files['items.json']),
    outfitModels: parseFile('outfit-models.json', z.array(outfitModelSchema), files['outfit-models.json']),
    dropTables: parseFile('drops.json', z.array(dropTableSchema), files['drops.json']),
    encyclopedia: parseFile('encyclopedia.json', z.array(encyclopediaSchema), files['encyclopedia.json']),
    achievements: parseFile('achievements.json', z.array(achievementSchema), files['achievements.json']),
  };
  for (const [file, records] of Object.entries({ 'questions.json': pack.questions, 'units.json': pack.units, 'items.json': pack.items, 'drops.json': pack.dropTables, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements })) {
    const seen = new Set<string>();
    records.forEach((record, i) => { if (seen.has(record.id)) throw new Error(`${file}：${i}.id 重複 ${record.id}`); seen.add(record.id); });
  }
  const units = new Set(pack.units.map(u => u.id));
  const questions = new Map(pack.questions.map(q => [q.id, q]));
  const entries = new Map(pack.encyclopedia.map(e => [e.id, e]));
  const tables = new Set(pack.dropTables.map(t => t.id));
  const items = new Map(pack.items.map(item => [item.id, item]));
  const modelAssets = new Set<string>();
  pack.outfitModels.forEach((model, i) => {
    if (modelAssets.has(model.asset)) throw new Error(`outfit-models.json：${i}.asset 重複 ${model.asset}`);
    modelAssets.add(model.asset);
    if (styleSlots[model.style] !== model.slot || model.anchor.some((value, index) => value !== outfitAnchors[model.slot][index])) throw new Error(`outfit-models.json：${i}.anchor 模型樣式、部位或錨點不符規範`);
  });
  pack.items.forEach((item, i) => {
    if (item.kind === 'outfit' && !pack.outfitModels.some(model => model.asset === item.asset && model.slot === item.outfitSlot)) throw new Error(`items.json：${i}.asset 缺少對應部位的 3D 裝扮模型`);
    if (!item.obtainFrom.includes('shop')) return;
    const [min, max] = gameConfig.priceBands[item.rarity];
    if (item.price < min || item.price > max) throw new Error(`items.json：${i}.price 商店售價必須在 ${min}–${max} 之間`);
  });
  const epicOwners = new Set<string>();
  pack.dropTables.forEach((table, i) => {
    for (const rarity of ['common', 'rare', 'epic'] as const) {
      if (new Set(table[rarity]).size !== table[rarity].length) throw new Error(`drops.json：${i}.${rarity} 道具重複`);
      table[rarity].forEach((id, j) => {
        const item = items.get(id);
        if (!item || !item.obtainFrom.includes('drop') || item.rarity !== rarity) throw new Error(`drops.json：${i}.${rarity}.${j} 道具不存在、不可掉落或稀有度不符 ${id}`);
        if (rarity === 'epic') {
          if (epicOwners.has(id)) throw new Error(`drops.json：${i}.epic.${j} 史詩道具必須為單元限定`);
          epicOwners.add(id);
        }
      });
    }
  });
  pack.manifest.unitIds.forEach((id, i) => { if (!units.has(id)) throw new Error(`pack.json：unitIds.${i} 找不到 ${id}`); });
  if (pack.manifest.unitIds.length !== pack.units.length || new Set(pack.manifest.unitIds).size !== pack.units.length) throw new Error('pack.json：unitIds 必須完整且不重複');
  pack.units.forEach((u, i) => {
    if (!tables.has(u.dropTableId)) throw new Error(`units.json：${i}.dropTableId 找不到掉落表 ${u.dropTableId}`);
    if (new Set(u.questionPool).size !== u.questionPool.length) throw new Error(`units.json：${i}.questionPool 題目重複`);
    u.questionPool.forEach((id, j) => { if (questions.get(id)?.unitId !== u.id) throw new Error(`units.json：${i}.questionPool.${j} 找不到同單元題目 ${id}`); });
    u.encyclopediaIds.forEach((id, j) => { if (entries.get(id)?.unitId !== u.id) throw new Error(`units.json：${i}.encyclopediaIds.${j} 找不到同單元條目 ${id}`); });
    if (u.unlockAfter && (!units.has(u.unlockAfter) || pack.units.find(v => v.id === u.unlockAfter)!.order >= u.order)) throw new Error(`units.json：${i}.unlockAfter 必須指向前一單元`);
  });
  pack.questions.forEach((q, i) => { if (!units.has(q.unitId)) throw new Error(`questions.json：${i}.unitId 找不到 ${q.unitId}`); });
  pack.encyclopedia.forEach((entry, i) => { const unit = pack.units.find(unit => unit.id === entry.unitId); if (!unit || !unit.encyclopediaIds.includes(entry.id)) throw new Error(`encyclopedia.json：${i}.unitId 條目必須引用單元並列於 encyclopediaIds`); });
  pack.achievements.forEach((a, i) => { if (a.rewardItemId && !pack.items.some(item => item.id === a.rewardItemId)) throw new Error(`achievements.json：${i}.rewardItemId 找不到道具`); });
  pack.achievements.forEach((a, i) => { if (a.rewardItemId && !pack.items.find(item => item.id === a.rewardItemId)!.obtainFrom.includes('achievement')) throw new Error(`achievements.json：${i}.rewardItemId 道具必須允許成就取得`); });
  validateFactoryProvenance(pack);
  return pack;
}


function validateFactoryProvenance(pack: ContentPack) {
  const meta = pack.manifest.provenance;
  if (!meta) {
    if (pack.knowledgePoints?.length || pack.questions.some(q => q.knowledgePointId || q.sourceRef)) throw new Error('pack.json.provenance：含出處或知識點的題庫必須保留來源綁定');
    return;
  }
  if (meta.packageId !== pack.manifest.id || meta.units.length !== pack.units.length || new Set(meta.units.map(u => u.unitId)).size !== meta.units.length || new Set(meta.units.map(u => u.batchId)).size !== meta.units.length) throw new Error('pack.json.provenance：題庫或單元來源綁定不符');
  if (pack.manifest.demo || pack.manifest.grade > 9) throw new Error('pack.json：工廠題庫必須是已審核的國小至國中教材');
  const points = new Map((pack.knowledgePoints ?? []).map(p => [p.id, p]));
  if (points.size !== (pack.knowledgePoints ?? []).length) throw new Error('knowledge-points.json：知識點ID重複');
  const reference = (ref: { documentId: string; pageNumber: number } | undefined, unitId: string, field: string) => {
    const binding = meta.units.find(u => u.unitId === unitId);
    if (!binding || binding.startPage > binding.endPage || !ref || ref.documentId !== meta.documentId || ref.pageNumber < binding.startPage || ref.pageNumber > binding.endPage) throw new Error(field + '：來源文件或單元頁碼不符');
  };
  for (const unit of pack.units) {
    if (unit.questionPool.length < 20) throw new Error('units.json.' + unit.id + '.questionPool：工廠單元至少需要20題');
    const questions = pack.questions.filter(q => q.unitId === unit.id);
    if (questions.length !== unit.questionPool.length) throw new Error('questions.json：題目必須完整列於單元題池');
    const choices = questions.filter(q => q.type !== 'fillBlank'); const counts = [0,1,2,3].map(i => choices.filter(q => q.answerIndex === i).length);
    if (Math.max(...counts) - Math.min(...counts) > 1) throw new Error('questions.json：正解位置不平均');
  }
  for (const point of points.values()) { if (!pack.units.some(u => u.id === point.unitId)) throw new Error('knowledge-points.json：未知單元'); reference(point.sourceRef, point.unitId, 'knowledge-points.json.' + point.id + '.sourceRef'); }
  for (const q of pack.questions) {
    const point = q.knowledgePointId ? points.get(q.knowledgePointId) : null;
    if (!point || point.unitId !== q.unitId) throw new Error('questions.json.' + q.id + '.knowledgePointId：缺少相同單元的知識點');
    if (!q.reviewedAt || !q.sourceQuestionId) throw new Error('questions.json.' + q.id + '：缺少審核或草稿識別紀錄');
    reference(q.sourceRef, q.unitId, 'questions.json.' + q.id + '.sourceRef');
  }
  for (const entry of pack.encyclopedia) { if (!entry.reviewedAt) throw new Error('encyclopedia.json：缺少審核紀錄'); reference(entry.sourceRef, entry.unitId, 'encyclopedia.json.' + entry.id + '.sourceRef'); }
}
