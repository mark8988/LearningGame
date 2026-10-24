export const gameConfig = {
  dropWeights: { common: 0.7, rare: 0.25, epic: 0.05 },
  bonusDropChance: 0.25,
  duplicateCoins: 30,
  furnitureLimit: 9,
  potion: { id: 'hp-potion', name: '森林 HP 藥水', price: 25, heal: 50, limit: 99 },
  priceBands: { common: [30, 80], rare: [120, 250], epic: [400, 800] },
} as const;
