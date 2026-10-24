import type { CosmeticItem } from '../data/schemas';
import type { PlayerSave } from './save';

export const ROOM_GRID = { columns: 12, rows: 8, cellSize: 0.55, x: -3.3, z: -2.2 } as const;
export type PlacedFurniture = PlayerSave['roomLayout'][number];
export interface FurnitureSelection { itemId: string; index: number | null; rotation: 0 | 1 }
export function footprint(item: CosmeticItem, rotation: 0 | 1) {
  const w = item.gridW ?? 1; const h = item.gridH ?? 1;
  return rotation === 0 ? { w, h } : { w: h, h: w };
}
export function availableFurniture(player: PlayerSave, itemId: string) {
  return Math.max(0, (player.inventory[itemId] ?? 0) - player.roomLayout.filter(p => p.itemId === itemId).length);
}
export function validatePlacement(player: PlayerSave, items: CosmeticItem[], placement: PlacedFurniture, movingIndex: number | null = null): { ok: boolean; message: string } {
  const item = items.find(i => i.id === placement.itemId);
  if (!item || item.kind !== 'furniture') return { ok: false, message: '請選擇家具箱裡的家具。' };
  if (movingIndex !== null && (!Number.isInteger(movingIndex) || player.roomLayout[movingIndex]?.itemId !== item.id)) return { ok: false, message: '找不到要移動的家具，請重新選擇。' };
  if (movingIndex === null && availableFurniture(player, item.id) <= 0) return { ok: false, message: '這款家具已全部擺放，請先移動或收回。' };
  const { x, y, rotation } = placement;
  if (!Number.isInteger(x) || !Number.isInteger(y) || (rotation !== 0 && rotation !== 1)) return { ok: false, message: '請將家具對齊房間格子。' };
  const { w, h } = footprint(item, rotation);
  if (x < 0 || y < 0 || x + w > ROOM_GRID.columns || y + h > ROOM_GRID.rows) return { ok: false, message: '家具超出房間邊界，請往房間內移動。' };
  const overlaps = player.roomLayout.some((placed, index) => {
    if (index === movingIndex) return false;
    const other = items.find(i => i.id === placed.itemId);
    if (!other || (other.layer ?? 1) !== (item.layer ?? 1)) return false;
    const size = footprint(other, placed.rotation);
    return x < placed.x + size.w && x + w > placed.x && y < placed.y + size.h && y + h > placed.y;
  });
  return overlaps ? { ok: false, message: '這裡已有同層家具，請選擇其他格子。' } : { ok: true, message: '可以擺放，放開即可完成。' };
}
export function placeFurniture(player: PlayerSave, items: CosmeticItem[], placement: PlacedFurniture, movingIndex: number | null = null) {
  const validation = validatePlacement(player, items, placement, movingIndex);
  if (!validation.ok) return { ...validation, player };
  const layout = [...player.roomLayout];
  if (movingIndex === null) layout.push({ ...placement }); else layout[movingIndex] = { ...placement };
  return { ...validation, player: { ...player, roomLayout: layout } };
}
export function collectionStats(player: PlayerSave, items: CosmeticItem[]) {
  const furniture = items.filter(i => i.kind === 'furniture');
  const owned = furniture.filter(i => (player.inventory[i.id] ?? 0) > 0).length;
  const ratio = furniture.length ? owned / furniture.length : 0;
  const placed = player.roomLayout.length;
  const title = placed >= 10 && ratio >= 0.75 ? '佈置大師' : placed >= 6 && ratio >= 0.5 ? '森林設計師' : placed >= 3 ? '溫馨巧手' : '溫馨新手';
  return { owned, total: furniture.length, percent: Math.round(ratio * 100), placed, title };
}
export interface GridProjection { origin: { x: number; y: number }; column: { x: number; y: number }; row: { x: number; y: number } }
export function projectGrid(projection: GridProjection, x: number, y: number) {
  return { x: projection.origin.x + projection.column.x * x + projection.row.x * y, y: projection.origin.y + projection.column.y * x + projection.row.y * y };
}
export function pointerToCell(projection: GridProjection, x: number, y: number) {
  const dx = x - projection.origin.x; const dy = y - projection.origin.y;
  const determinant = projection.column.x * projection.row.y - projection.column.y * projection.row.x;
  if (Math.abs(determinant) < 0.001) return null;
  return { x: Math.floor((dx * projection.row.y - dy * projection.row.x) / determinant), y: Math.floor((projection.column.x * dy - projection.column.y * dx) / determinant) };
}
