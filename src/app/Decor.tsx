import { useRef, useState, type PointerEvent } from 'react';
import { Armchair, ArrowLeft, Check, Hand, Package, RotateCw, Trash2, Trophy, X } from 'lucide-react';
import { boot } from '../stores/gameStore';
import { RoomEditor3D } from '../components/RoomEditor3D';
import { availableFurniture, collectionStats, footprint, pointerToCell, projectGrid, ROOM_GRID, validatePlacement, type FurnitureSelection, type GridProjection, type PlacedFurniture } from '../logic/placement';

interface Drag { pointerId: number; offset: { x: number; y: number }; startX: number; startY: number; moved: boolean; justSelected: boolean }
export function Decor() {
  const game = boot!.store();
  const { player, pack } = game;
  const [selection, setSelection] = useState<FurnitureSelection | null>(null);
  const selectionRef = useRef(selection); selectionRef.current = selection;
  const [preview, setPreview] = useState<PlacedFurniture | null>(null);
  const [projection, setProjection] = useState<GridProjection | null>(null);
  const [activeCell, setActiveCell] = useState(0);
  const sceneRef = useRef<HTMLDivElement>(null);
  const cells = useRef<(SVGPolygonElement | null)[]>([]);
  const drag = useRef<Drag | null>(null);
  const furniture = pack.items.filter(item => item.kind === 'furniture' && (player.inventory[item.id] ?? 0) > 0);
  const selectedItem = pack.items.find(item => item.id === selection?.itemId);
  const stats = collectionStats(player, pack.items);
  const validation = preview ? validatePlacement(player, pack.items, preview, selection?.index ?? null) : null;
  const choose = (next: FurnitureSelection) => { selectionRef.current = next; setSelection(next); setPreview(null); };
  const cancel = () => { drag.current = null; selectionRef.current = null; setSelection(null); setPreview(null); };
  function cellAt(clientX: number, clientY: number) {
    const host = sceneRef.current;
    if (!host || !projection) return null;
    const rect = host.getBoundingClientRect();
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    return pointerToCell(projection, clientX - rect.left - host.clientLeft, clientY - rect.top - host.clientTop);
  }
  function candidate(cell: { x: number; y: number }, offset = { x: 0, y: 0 }): PlacedFurniture | null {
    const selected = selectionRef.current;
    return selected ? { itemId: selected.itemId, x: cell.x - offset.x, y: cell.y - offset.y, rotation: selected.rotation } : null;
  }
  function commit(placement: PlacedFurniture) {
    const selected = selectionRef.current;
    if (selected && game.place(placement, selected.index)) cancel(); else setPreview(placement);
  }
  function begin(event: PointerEvent<Element>, next: FurnitureSelection, offset = { x: 0, y: 0 }, justSelected = false) {
    if (event.button !== 0) return;
    event.preventDefault();
    choose(next);
    drag.current = { pointerId: event.pointerId, offset, startX: event.clientX, startY: event.clientY, moved: false, justSelected };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pickPlaced(cell: { x: number; y: number }) {
    return player.roomLayout.map((placed, index) => ({ placed, index, item: pack.items.find(i => i.id === placed.itemId)! })).filter(({ placed, item }) => {
      if (!item) return false; const { w, h } = footprint(item, placed.rotation);
      return cell.x >= placed.x && cell.x < placed.x + w && cell.y >= placed.y && cell.y < placed.y + h;
    }).sort((a, b) => (b.item.layer ?? 1) - (a.item.layer ?? 1))[0];
  }
  function sceneDown(event: PointerEvent<SVGSVGElement>) {
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) return;
    const selected = selectionRef.current;
    if (selected) { begin(event, selected); setPreview(candidate(cell)); }
    else {
      const picked = pickPlaced(cell);
      if (picked) {
        begin(event, { itemId: picked.placed.itemId, index: picked.index, rotation: picked.placed.rotation }, { x: cell.x - picked.placed.x, y: cell.y - picked.placed.y }, true);
        setPreview({ ...picked.placed });
      }
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!selectionRef.current) return;
    const current = drag.current;
    if (current && current.pointerId !== event.pointerId) return;
    if (current && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) > 4) current.moved = true;
    const cell = cellAt(event.clientX, event.clientY);
    setPreview(cell ? candidate(cell, current?.offset) : null);
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    drag.current = null;
    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) { setPreview(null); return; }
    if (current.justSelected && !current.moved) return;
    const placement = candidate(cell, current.offset);
    if (placement) commit(placement);
  }
  const polygon = (x: number, y: number, w = 1, h = 1) => projection ? [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].map(([cx, cy]) => { const p = projectGrid(projection, cx, cy); return `${p.x},${p.y}`; }).join(' ') : '';
  const activate = (x: number, y: number) => {
    if (selectionRef.current) { const placement = candidate({ x, y }); if (placement) commit(placement); }
    else { const picked = pickPlaced({ x, y }); if (picked) { choose({ itemId: picked.placed.itemId, index: picked.index, rotation: picked.placed.rotation }); setPreview(picked.placed); } }
  };
  const dimensions = selectedItem && selection ? footprint(selectedItem, selection.rotation) : null;
  const furnitureOptions = () => furniture.map(item => {
    const available = availableFurniture(player, item.id);
    return <button key={item.id} className={selection?.index === null && selection.itemId === item.id ? 'selected' : ''} disabled={available === 0} aria-label={`從家具箱選擇${item.name}`} onPointerDown={event => begin(event, { itemId: item.id, index: null, rotation: 0 })} onClick={event => { if (event.detail === 0) choose({ itemId: item.id, index: null, rotation: 0 }); }}><span><Armchair size={22} /></span><div><b>{item.name}</b><small>{item.gridW}×{item.gridH} 格 · 可用 {available} / {player.inventory[item.id]}</small></div></button>;
  });
  return <>
    <div className="decor-summary"><span><Trophy size={19} /><b>{stats.title}</b></span><span>家具收藏 <b>{stats.owned} / {stats.total}</b><progress aria-label="家具收藏率" max={100} value={stats.percent} /><small>{stats.percent}%</small></span><span>已擺放 <b data-testid="placed-count">{stats.placed}</b> 件</span></div>
    <div className="decor-layout" onPointerMove={move} onPointerUp={end} onPointerCancel={() => { drag.current = null; setPreview(null); }} onLostPointerCapture={event => { if (drag.current?.pointerId === event.pointerId) { drag.current = null; setPreview(null); } }} onKeyDown={event => { if (event.key === 'Escape') cancel(); }}>
      <section className="decor-workspace"><div className="decor-toolbar"><span><Hand size={17} />{selectedItem ? `${selection?.index === null ? '擺放' : '移動'}${selectedItem.name} · ${dimensions!.w}×${dimensions!.h} 格` : '選家具，再拖到喜歡的位置'}</span><div><button disabled={!selection} onClick={() => { if (!selection) return; const next = { ...selection, rotation: selection.rotation === 0 ? 1 as const : 0 as const }; selectionRef.current = next; setSelection(next); setPreview(preview ? { ...preview, rotation: next.rotation } : null); }}><RotateCw size={16} />旋轉</button><button disabled={!selection} onClick={cancel}><X size={16} />取消</button></div></div>
        <div className="furniture-options decor-mobile-tray" aria-label="隨手家具箱">{furnitureOptions()}</div>
        <div ref={sceneRef} className="scene-card decor-canvas"><RoomEditor3D player={player} items={pack.items} preview={preview} movingIndex={selection?.index ?? null} onProjection={setProjection} />
          {projection && <svg className="room-grid" aria-label="房間 12×8 擺放格子" onPointerDown={sceneDown}>{Array.from({ length: ROOM_GRID.columns * ROOM_GRID.rows }, (_, i) => {
            const x = i % ROOM_GRID.columns; const y = Math.floor(i / ROOM_GRID.columns);
            const covered = !!preview && !!dimensions && x >= preview.x && x < preview.x + dimensions.w && y >= preview.y && y < preview.y + dimensions.h;
            return <polygon key={i} ref={node => { cells.current[i] = node; }} points={polygon(x, y)} className={`grid-cell ${covered ? validation?.ok ? 'valid' : 'invalid' : ''}`} role="button" tabIndex={i === activeCell ? 0 : -1} aria-label={`第 ${x + 1} 欄第 ${y + 1} 列`} onFocus={() => setActiveCell(i)} onClick={event => { if (event.detail === 0) activate(x, y); }} onKeyDown={event => {
              const deltas: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -ROOM_GRID.columns, ArrowDown: ROOM_GRID.columns };
              if (event.key in deltas) { event.preventDefault(); const next = Math.max(0, Math.min(95, i + deltas[event.key])); setActiveCell(next); cells.current[next]?.focus(); const point = candidate({ x: next % 12, y: Math.floor(next / 12) }); if (point) setPreview(point); }
              if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(x, y); }
            }} />;
          })}{preview && dimensions && <polygon className={`placement-outline ${validation?.ok ? 'valid' : 'invalid'}`} points={polygon(preview.x, preview.y, dimensions.w, dimensions.h)} aria-hidden="true" />}</svg>}
          <span className="decor-grid-label">12 × 8 · 自動對齊格子</span>
        </div>
        <div className="decor-feedback" data-valid={validation?.ok ?? true}><span>{validation?.ok === false ? <X size={17} /> : <Check size={17} />}</span><p>{validation?.message ?? '拖曳家具或先選家具再點格子；綠色可放，紅色請換位置。'}</p></div>
        <div className="decor-instructions"><p>滑鼠或單指拖曳都可以。點選已擺好的家具可移動；鍵盤可用方向鍵選格、Enter 擺放、Esc 取消。</p><button className="primary" onClick={() => game.navigate('home')}><Check size={17} />完成佈置，回小屋</button></div>
      </section>
      <aside className="furniture-box"><h2><Package size={20} />我的家具箱</h2><p>收回家具不會減少持有數量。</p><div className="furniture-options desktop-furniture-options">{furnitureOptions()}{!furniture.length && <p>家具箱還是空的，到森林商店挑一件吧！</p>}</div>
        <h3>已擺放的家具 <small>{stats.placed}</small></h3><div className="placed-list">{player.roomLayout.map((placed, index) => { const item = pack.items.find(i => i.id === placed.itemId); return <div key={`${placed.itemId}-${index}`} className={selection?.index === index ? 'selected' : ''}><button aria-label={`移動${item?.name ?? placed.itemId} ${index + 1}`} onPointerDown={event => begin(event, { itemId: placed.itemId, index, rotation: placed.rotation })} onClick={event => { if (event.detail === 0) choose({ itemId: placed.itemId, index, rotation: placed.rotation }); }}><b>{item?.name ?? placed.itemId}</b><small>第 {placed.x + 1} 欄 · 第 {placed.y + 1} 列</small></button><button aria-label={`收回${item?.name ?? placed.itemId} ${index + 1}`} onClick={() => { cancel(); game.removeFurniture(index); }}><Trash2 size={17} /></button></div>; })}{!stats.placed && <p>從第一件家具開始，打造自己的小天地。</p>}</div><button className="text-button" onClick={() => game.navigate('shop')}><ArrowLeft size={15} />到商店找新家具</button>
      </aside>
    </div>
  </>;
}
