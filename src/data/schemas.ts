import { z } from 'zod';

const id = z.string().min(1);
export const questionSchema = z.object({ id, unitId: id, stem: id, type: z.enum(['choice', 'fillBlank']).optional(), options: z.array(id).max(4).default([]), answerIndex: z.number().int().min(0).max(3).optional(), acceptedAnswers: z.array(z.string().trim().min(1).max(120)).min(1).max(8).optional(), explanation: id, difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]), zhuyin: z.string().optional() }).superRefine((question, ctx) => {
  if (question.type === 'fillBlank') {
    if ((question.stem.match(/_{3,}/g) ?? []).length !== 1) ctx.addIssue({ code: 'custom', path: ['stem'], message: '填空題須有一個 ___ 空格' });
    if (!question.acceptedAnswers?.length) ctx.addIssue({ code: 'custom', path: ['acceptedAnswers'], message: '填空題須提供可接受答案' });
  } else {
    if (question.answerIndex === undefined) ctx.addIssue({ code: 'custom', path: ['answerIndex'], message: '選擇題須提供正確答案位置' });
    if (question.options.length !== 4 || new Set(question.options).size !== 4) ctx.addIssue({ code: 'custom', path: ['options'], message: '選擇題須有四個不同選項' });
  }
}).transform(question => ({ ...question, answerIndex: question.answerIndex ?? 0 })).refine(question => !question.zhuyin || question.zhuyin.trim().split(/\s+/).length === Array.from(question.stem).filter(char => /\p{Script=Han}/u.test(char)).length, { path: ['zhuyin'], message: '注音需以空白分隔，對應每個漢字（不含標點）' });
export const unitSchema = z.object({ id, name: id, order: z.number().int().positive(), boss: z.object({ name: id, asset: id, hp: z.number().positive(), attack: z.number().positive() }), questionPool: z.array(id).min(10), encyclopediaIds: z.array(id), dropTableId: id, unlockAfter: id.optional() });
export const itemSchema = z.object({ id, kind: z.enum(['furniture', 'outfit']), name: id, rarity: z.enum(['common', 'rare', 'epic']), price: z.number().int().nonnegative(), asset: id, obtainFrom: z.array(z.enum(['shop', 'drop', 'achievement', 'starter'])).min(1), gridW: z.number().int().positive().optional(), gridH: z.number().int().positive().optional(), layer: z.number().int().optional(), outfitSlot: z.enum(['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory', 'handheld']).optional() }).superRefine((item, ctx) => {
  if (item.kind === 'furniture' && (!item.gridW || !item.gridH)) ctx.addIssue({ code: 'custom', path: ['gridW'], message: '家具必須提供 gridW 與 gridH' });
  if (item.kind === 'outfit' && !item.outfitSlot) ctx.addIssue({ code: 'custom', path: ['outfitSlot'], message: '裝扮必須提供 outfitSlot' });
});
export const manifestSchema = z.object({ id, name: id, version: id, subject: id, grade: z.number().int().min(1).max(12), unitIds: z.array(id).min(1), demo: z.boolean() });
export const encyclopediaSchema = z.object({ id, unitId: id, title: id, text: id, illustration: z.enum(['plant', 'animal', 'weather', 'magnet', 'water']) });
export const achievementSchema = z.object({ id, name: id, metric: z.enum(['correct', 'battlesWon', 'collection', 'placed']), target: z.number().int().positive(), rewardItemId: id.optional(), coins: z.number().int().nonnegative().optional() }).refine(value => !!value.rewardItemId || (value.coins ?? 0) > 0, { message: '成就必須提供道具或金幣獎勵' });
export type Question = z.infer<typeof questionSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type CosmeticItem = z.infer<typeof itemSchema>;
export type OutfitSlot = NonNullable<CosmeticItem['outfitSlot']>;
export const outfitModelSchema = z.object({ asset: id, slot: z.enum(['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory', 'handheld']), style: z.enum(['hair', 'jacket', 'trousers', 'boots', 'cap', 'crown', 'feather', 'magnet', 'scarf', 'lantern']), color: z.string().regex(/^#[0-9a-fA-F]{6}$/), accent: z.string().regex(/^#[0-9a-fA-F]{6}$/), anchor: z.tuple([z.number().finite(), z.number().finite(), z.number().finite()]) });
export type OutfitModel = z.infer<typeof outfitModelSchema>;
export const dropTableSchema = z.object({ id, common: z.array(id).min(1), rare: z.array(id).min(1), epic: z.array(id).min(1) });
export type DropTable = z.infer<typeof dropTableSchema>;
export interface ContentPack { manifest: z.infer<typeof manifestSchema>; questions: Question[]; units: Unit[]; items: CosmeticItem[]; outfitModels: OutfitModel[]; dropTables: DropTable[]; encyclopedia: z.infer<typeof encyclopediaSchema>[]; achievements: z.infer<typeof achievementSchema>[] }
