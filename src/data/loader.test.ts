import { describe, expect, it } from 'vitest';
import { loadBuiltinPack, validatePack } from './loader';
const pack = loadBuiltinPack();
const files = () => structuredClone({ 'pack.json': pack.manifest, 'units.json': pack.units, 'questions.json': pack.questions, 'items.json': pack.items, 'encyclopedia.json': pack.encyclopedia, 'achievements.json': pack.achievements });
describe('內容包驗證', () => {
  it('載入五單元與六十道示範題', () => { expect(pack.units).toHaveLength(5); expect(pack.questions).toHaveLength(60); expect(pack.items.filter(i => i.obtainFrom.includes('starter'))).toHaveLength(4); });
  it('解析必填並指出檔案與筆數', () => { const input = files(); input['questions.json'][2].explanation = ''; expect(() => validatePack(input)).toThrow(/questions.json：2.explanation/); });
  it('拒絕重複 id', () => { const input = files(); input['questions.json'][1].id = input['questions.json'][0].id; expect(() => validatePack(input)).toThrow(/questions.json：1.id 重複/); });
  it('拒絕遺失的題池引用', () => { const input = files(); input['units.json'][0].questionPool[0] = 'missing'; expect(() => validatePack(input)).toThrow(/units.json：0.questionPool.0/); });
  it('拒絕跨單元題目引用', () => { const input = files(); input['units.json'][0].questionPool[0] = pack.units[1].questionPool[0]; expect(() => validatePack(input)).toThrow(/同單元題目/); });
  it('拒絕循環解鎖', () => { const input = files(); input['units.json'][0].unlockAfter = pack.units[1].id; expect(() => validatePack(input)).toThrow(/unlockAfter/); });
  it('拒絕遺失圖鑑引用', () => { const input = files(); input['units.json'][0].encyclopediaIds[0] = 'missing'; expect(() => validatePack(input)).toThrow(/encyclopediaIds.0/); });
});
