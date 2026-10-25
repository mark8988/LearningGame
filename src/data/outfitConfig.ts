import type { OutfitSlot } from './schemas';
export const outfitSlots = ['hair', 'top', 'bottom', 'shoes', 'hat', 'accessory', 'handheld'] as const;
export const slotNames: Record<OutfitSlot, string> = { hair: '髮型', top: '上衣', bottom: '下身', shoes: '鞋子', hat: '帽子', accessory: '配件', handheld: '手持物' };
export const outfitAnchors: Record<OutfitSlot, [number, number, number]> = { hair: [0, 1.28, -0.04], top: [0, 0.61, 0], bottom: [0, 0.33, 0], shoes: [0, 0.14, 0.03], hat: [0, 1.37, 0], accessory: [0, 0.9, 0.03], handheld: [0.53, 0.35, 0.13] };
export const outfitBounds: Record<OutfitSlot, [number, number, number]> = { hair: [0.9, 0.7, 0.9], top: [1.2, 1, 0.7], bottom: [0.7, 0.5, 0.6], shoes: [0.8, 0.5, 0.7], hat: [1.1, 1, 1.1], accessory: [0.9, 0.8, 0.8], handheld: [0.6, 0.8, 0.6] };
export const styleSlots: Record<string, OutfitSlot> = { hair: 'hair', jacket: 'top', trousers: 'bottom', boots: 'shoes', cap: 'hat', crown: 'hat', feather: 'hat', magnet: 'hat', scarf: 'accessory', lantern: 'handheld' };
