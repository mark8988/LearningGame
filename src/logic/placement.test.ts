import { describe, expect, it } from 'vitest';
import { loadBuiltinPack } from '../data/loader';
import { newGame } from './save';
import { availableFurniture, collectionStats, footprint, placeFurniture, pointerToCell, projectGrid, validatePlacement } from './placement';
const pack = loadBuiltinPack();
describe('房間格子與庫存', () => {
  it('依旋轉交換佔格尺寸', () => { const desk = pack.items.find(i => i.id === 'desk')!; expect(footprint(desk, 0)).toEqual({ w: 2, h: 1 }); expect(footprint(desk, 1)).toEqual({ w: 1, h: 2 }); });
  it('合法擺放產生新 layout，不修改持有數或原始存檔', () => {
    const player = newGame(pack); const result = placeFurniture(player, pack.items, { itemId: 'desk', x: 0, y: 0, rotation: 0 });
    expect(result.ok).toBe(true); expect(result.player.roomLayout).toHaveLength(1); expect(player.roomLayout).toHaveLength(0); expect(result.player.inventory).toEqual(player.inventory); expect(availableFurniture(result.player, 'desk')).toBe(0);
  });
  it.each([[-1, 0], [0, -1], [11, 0], [0, 8], [1.5, 2], [NaN, 0]])('拒絕出界或非整數座標 %s,%s', (x, y) => expect(validatePlacement(newGame(pack), pack.items, { itemId: 'desk', x, y, rotation: 0 }).ok).toBe(false));
  it('精確依旋轉後佔格檢查右側與下側邊界', () => {
    const player = newGame(pack);
    expect(validatePlacement(player, pack.items, { itemId: 'desk', x: 11, y: 6, rotation: 1 }).ok).toBe(true);
    expect(validatePlacement(player, pack.items, { itemId: 'desk', x: 11, y: 7, rotation: 1 }).ok).toBe(false);
  });
  it('拒絕同層重疊，但允許相鄰家具貼齊', () => {
    const player = newGame(pack); player.roomLayout = [{ itemId: 'desk', x: 2, y: 2, rotation: 0 }];
    expect(validatePlacement(player, pack.items, { itemId: 'chair', x: 3, y: 2, rotation: 0 }).message).toContain('同層');
    expect(validatePlacement(player, pack.items, { itemId: 'chair', x: 4, y: 2, rotation: 0 }).ok).toBe(true);
  });
  it('地毯可墊在桌子下，但同層地毯不可重疊', () => {
    const player = newGame(pack); player.inventory.rug = 2; player.roomLayout = [{ itemId: 'rug', x: 2, y: 2, rotation: 0 }];
    expect(validatePlacement(player, pack.items, { itemId: 'desk', x: 2, y: 2, rotation: 0 }).ok).toBe(true);
    expect(validatePlacement(player, pack.items, { itemId: 'rug', x: 3, y: 2, rotation: 0 }).ok).toBe(false);
  });
  it('移動忽略自己，其他家具碰撞仍拒絕且保持原位置', () => {
    const player = newGame(pack); player.roomLayout = [{ itemId: 'desk', x: 2, y: 2, rotation: 0 }, { itemId: 'chair', x: 5, y: 4, rotation: 0 }];
    expect(placeFurniture(player, pack.items, { itemId: 'desk', x: 3, y: 2, rotation: 0 }, 0).ok).toBe(true);
    const failed = placeFurniture(player, pack.items, { itemId: 'desk', x: 5, y: 4, rotation: 0 }, 0);
    expect(failed.ok).toBe(false); expect(failed.player).toBe(player); expect(player.roomLayout[0].x).toBe(2);
  });
  it('拒絕不存在、非家具、未持有及用完庫存的擺放', () => {
    const player = newGame(pack);
    for (const itemId of ['missing', 'explorer-hat', 'bookshelf']) expect(placeFurniture(player, pack.items, { itemId, x: 0, y: 0, rotation: 0 }).ok).toBe(false);
    player.roomLayout = [{ itemId: 'desk', x: 0, y: 0, rotation: 0 }]; expect(placeFurniture(player, pack.items, { itemId: 'desk', x: 3, y: 0, rotation: 0 }).ok).toBe(false);
  });
  it('每件庫存可擺一次，移動不額外佔用數量', () => {
    const player = newGame(pack); player.inventory.desk = 2;
    const a = placeFurniture(player, pack.items, { itemId: 'desk', x: 0, y: 0, rotation: 0 }).player;
    const b = placeFurniture(a, pack.items, { itemId: 'desk', x: 2, y: 0, rotation: 0 }).player;
    expect(availableFurniture(b, 'desk')).toBe(0); expect(placeFurniture(b, pack.items, { itemId: 'desk', x: 2, y: 1, rotation: 0 }, 1).ok).toBe(true);
    expect(placeFurniture(b, pack.items, { itemId: 'desk', x: 2, y: 1, rotation: 0 }, 99).ok).toBe(false);
  });
});
describe('收藏與畫面座標', () => {
  it('收藏率以家具款式計算，不計服裝或重複數量', () => {
    const player = newGame(pack); player.inventory.desk = 9; player.inventory['explorer-hat'] = 1;
    expect(collectionStats(player, pack.items)).toEqual({ owned: 4, total: 8, percent: 50, placed: 0, title: '溫馨新手' });
    expect(collectionStats(player, [])).toMatchObject({ percent: 0, total: 0 });
  });
  it('稱號綜合已擺放數與收藏率', () => {
    const player = newGame(pack); player.roomLayout = Array.from({ length: 10 }, (_, x) => ({ itemId: 'chair', x, y: 0, rotation: 0 }));
    expect(collectionStats(player, pack.items).title).toBe('森林設計師');
    player.inventory.bookshelf = 1; player.inventory.telescope = 1; expect(collectionStats(player, pack.items).title).toBe('佈置大師');
    player.roomLayout = player.roomLayout.slice(0, 3); expect(collectionStats(player, pack.items).title).toBe('溫馨巧手');
  });
  it('等角投影正反變換對應滑鼠／觸控落點，含格子外座標', () => {
    const projection = { origin: { x: 220, y: 30 }, column: { x: 17, y: 8 }, row: { x: -14, y: 12 } };
    for (const [x, y] of [[0, 0], [11, 7], [4, 3], [-1, 4]]) { const point = projectGrid(projection, x + 0.5, y + 0.5); expect(pointerToCell(projection, point.x, point.y)).toEqual({ x, y }); }
    expect(pointerToCell({ ...projection, row: projection.column }, 1, 1)).toBeNull();
  });
});
