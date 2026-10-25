import { describe, expect, it } from 'vitest';
import { loadBuiltinPack, validatePack } from './loader';
const pack = loadBuiltinPack();
const files = () => structuredClone({ 'pack.json': pack.manifest, 'units.json': pack.units, 'questions.json': pack.questions, 'items.json': pack.items, 'outfit-models.json': pack.outfitModels, 'drops.json': pack.dropTables, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements });
describe('內容包驗證', () => {
  it('載入五單元與六十道示範題', () => { expect(pack.units).toHaveLength(5); expect(pack.questions).toHaveLength(60); expect(pack.items.filter(i => i.obtainFrom.includes('starter'))).toHaveLength(4); });
  it('解析必填並指出檔案與筆數', () => { const input = files(); input['questions.json'][2].explanation = ''; expect(() => validatePack(input)).toThrow(/questions.json：2.explanation/); });
  it('拒絕重複 id', () => { const input = files(); input['questions.json'][1].id = input['questions.json'][0].id; expect(() => validatePack(input)).toThrow(/questions.json：1.id 重複/); });
  it('拒絕遺失的題池引用', () => { const input = files(); input['units.json'][0].questionPool[0] = 'missing'; expect(() => validatePack(input)).toThrow(/units.json：0.questionPool.0/); });
  it('拒絕跨單元題目引用', () => { const input = files(); input['units.json'][0].questionPool[0] = pack.units[1].questionPool[0]; expect(() => validatePack(input)).toThrow(/同單元題目/); });
  it('拒絕循環解鎖', () => { const input = files(); input['units.json'][0].unlockAfter = pack.units[1].id; expect(() => validatePack(input)).toThrow(/unlockAfter/); });
  it('拒絕遺失圖鑑引用', () => { const input = files(); input['units.json'][0].encyclopediaIds[0] = 'missing'; expect(() => validatePack(input)).toThrow(/encyclopediaIds.0/); });
  it('拒絕遺失掉落表', () => { const input = files(); input['units.json'][0].dropTableId = 'missing'; expect(() => validatePack(input)).toThrow(/units.json：0.dropTableId/); });
  it('拒絕掉落稀有度不符的道具', () => { const input = files(); input['drops.json'][0].common[0] = 'leaf-crown'; expect(() => validatePack(input)).toThrow(/drops.json：0.common.0/); });
  it('每單元史詩掉落必須獨有', () => { const input = files(); input['drops.json'][1].epic = [...input['drops.json'][0].epic]; expect(() => validatePack(input)).toThrow(/史詩道具必須為單元限定/); });
  it('拒絕超出定價帶的商店價格', () => { const input = files(); input['items.json'][0].price = 0; expect(() => validatePack(input)).toThrow(/items.json：0.price/); });
  it('拒絕缺失的裝扮模型', () => { const input = files(); input['outfit-models.json'] = []; expect(() => validatePack(input)).toThrow(/缺少對應部位的 3D 裝扮模型/); });
  it('拒絕錯誤的模型錨點或部位樣式', () => { const input = files(); input['outfit-models.json'][0].anchor[1] = 5; expect(() => validatePack(input)).toThrow(/outfit-models.json：0.anchor/); });
});
