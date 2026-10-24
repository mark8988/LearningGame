import { z } from 'zod';

const id = z.string().min(1);
export const questionSchema = z.object({ id, unitId: id, stem: id, options: z.tuple([id, id, id, id]), answerIndex: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]), explanation: id, difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]), zhuyin: z.string().optional() });
export const unitSchema = z.object({ id, name: id, order: z.number().int().positive(), boss: z.object({ name: id, asset: id, hp: z.number().positive(), attack: z.number().positive() }), questionPool: z.array(id).min(10), encyclopediaIds: z.array(id), dropTableId: id, unlockAfter: id.optional() });
export const itemSchema = z.object({ id, kind: z.enum(['furniture', 'outfit']), name: id, rarity: z.enum(['common', 'rare', 'epic']), price: z.number().int().nonnegative(), asset: id, obtainFrom: z.array(z.enum(['shop', 'drop', 'achievement', 'starter'])).min(1), gridW: z.number().int().positive().optional(), gridH: z.number().int().positive().optional(), layer: z.number().int().optional(), outfitSlot: z.enum(['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory', 'handheld']).optional() }).superRefine((item, ctx) => {
  if (item.kind === 'furniture' && (!item.gridW || !item.gridH)) ctx.addIssue({ code: 'custom', path: ['gridW'], message: '家具必須提供 gridW 與 gridH' });
  if (item.kind === 'outfit' && !item.outfitSlot) ctx.addIssue({ code: 'custom', path: ['outfitSlot'], message: '裝扮必須提供 outfitSlot' });
});
export const manifestSchema = z.object({ id, name: id, version: id, subject: id, grade: z.number().int().min(1).max(12), unitIds: z.array(id).min(1), demo: z.boolean() });
export const encyclopediaSchema = z.object({ id, unitId: id, title: id, text: id });
export const achievementSchema = z.object({ id, name: id, metric: z.enum(['correct', 'battlesWon', 'collection', 'placed']), target: z.number().int().positive(), rewardItemId: id.optional(), coins: z.number().int().nonnegative().optional() });
export type Question = z.infer<typeof questionSchema>;
export type Unit = z.infer<typeof unitSchema>;
export type CosmeticItem = z.infer<typeof itemSchema>;
export const dropTableSchema = z.object({ id, common: z.array(id).min(1), rare: z.array(id).min(1), epic: z.array(id).min(1) });
export type DropTable = z.infer<typeof dropTableSchema>;
export interface ContentPack { manifest: z.infer<typeof manifestSchema>; questions: Question[]; units: Unit[]; items: CosmeticItem[]; dropTables: DropTable[]; encyclopedia: z.infer<typeof encyclopediaSchema>[]; achievements: z.infer<typeof achievementSchema>[] }
