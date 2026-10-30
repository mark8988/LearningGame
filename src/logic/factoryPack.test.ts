import { describe, expect, it } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { exportPack, importPack } from './transfers';
import type { ContentPack } from '../data/schemas';
const documentId = '00000000-0000-4000-8000-000000000001';
function fixture(count = 20): ContentPack {
  const pack = structuredClone(loadBuiltinPack()); const unit = pack.units[0]; const reference = { documentId, pageNumber: 3, quote: '質量可使用天平測量，常用單位為公克。' }; const reviewedAt = '2026-10-28T00:00:00Z';
  pack.units = [unit]; pack.dropTables = pack.dropTables.slice(0, 1); pack.manifest = { ...pack.manifest, id: 'factory-test', name: '國中測量題庫', grade: 8, demo: false, unitIds: [unit.id], provenance: { format: 'learning-adventure:factory', schemaVersion: 1, packageId: 'factory-test', documentId, sourceHash: 'A'.repeat(64), sourceTitle: '測量教材', createdAt: reviewedAt, units: [{ unitId: unit.id, unitIndex: 0, batchId: '00000000-0000-4000-8000-000000000002', batchRevision: 1, startPage: 3, endPage: 5 }] } };
  const example = pack.questions[0]; pack.questions = Array.from({ length: count }, (_, i) => ({ ...example, id: `factory-q${i}`, stem: `測量知識第${i + 1}題應該如何回答？`, answerIndex: i % 4, sourceRef: reference, knowledgePointId: `kp${i}`, sourceQuestionId: `10000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`, reviewedAt, zhuyin: undefined }));
  unit.questionPool = pack.questions.map(q => q.id); pack.knowledgePoints = pack.questions.map(q => ({ id: q.knowledgePointId!, unitId: unit.id, text: reference.quote, sourceRef: reference }));
  pack.encyclopedia = pack.encyclopedia.filter(e => e.unitId === unit.id).map(e => ({ ...e, sourceRef: reference, reviewedAt })); return pack;
}
describe('CF-C 遊戲內容包契約', () => {
  it('匯入與再次匯出保留出處、版本、審核及知識點對應', () => {
    const parsed = importPack(exportPack(fixture())); expect(parsed.manifest.provenance?.documentId).toBe(documentId); expect(parsed.knowledgePoints).toHaveLength(20); expect(parsed.questions[0].knowledgePointId).toBe('kp0'); expect(parsed.questions[0].sourceRef?.pageNumber).toBe(3); expect(importPack(exportPack(parsed))).toEqual(parsed);
  });
  it('不限制題庫上限，400題仍可驗證', () => expect(importPack(exportPack(fixture(400))).questions).toHaveLength(400));
  it('工廠題庫至少20題，既有示範題庫仍可正常匯入', () => { expect(() => importPack(exportPack(fixture(19)))).toThrow('至少需要20題'); expect(importPack(exportPack(loadBuiltinPack())).questions).toHaveLength(60); });
  it('拒絕缺失知識點或缺少審核紀錄', () => { const pack = fixture(); pack.questions[0].knowledgePointId = 'unknown'; expect(() => importPack(exportPack(pack))).toThrow('knowledgePointId'); pack.questions[0].knowledgePointId = 'kp0'; delete pack.questions[0].reviewedAt; expect(() => importPack(exportPack(pack))).toThrow('審核'); });
  it('拒絕跨來源及超出單元頁範圍的引用', () => { const pack = fixture(); pack.questions[0].sourceRef = { ...pack.questions[0].sourceRef!, documentId: '00000000-0000-4000-8000-000000000099' }; expect(() => importPack(exportPack(pack))).toThrow('來源文件'); pack.questions[0].sourceRef = { documentId, pageNumber: 6, quote: '這是超過目前單元範圍的原文。' }; expect(() => importPack(exportPack(pack))).toThrow('單元頁碼'); });
  it('拒絕題庫ID綁定不符、重複知識點及遺漏來源欄位', () => {
    const pack = fixture(); pack.manifest.provenance!.packageId = 'wrong'; expect(() => importPack(exportPack(pack))).toThrow('來源綁定'); pack.manifest.provenance!.packageId = pack.manifest.id; pack.knowledgePoints!.push(pack.knowledgePoints![0]); expect(() => importPack(exportPack(pack))).toThrow('知識點ID重複');
    pack.knowledgePoints!.pop(); delete pack.manifest.provenance; expect(() => importPack(exportPack(pack))).toThrow('provenance');
  });
  it('審核中間產物不可誤當遊戲題庫', () => expect(() => importPack(JSON.stringify({ format: 'learning-adventure:approved-drafts', version: 1 }))).toThrow('打包所選單元'));
});
