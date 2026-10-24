import { useLayoutEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera, Vector3 } from 'three';
import type { CosmeticItem } from '../data/schemas';
import type { PlayerSave } from '../logic/save';
import { ROOM_GRID, type GridProjection, type PlacedFurniture } from '../logic/placement';
import { PlacedItem3D, Room, SceneBoundary } from './World3D';

function EditorCamera({ onProjection }: { onProjection(value: GridProjection): void }) {
  const { camera, size } = useThree();
  useLayoutEffect(() => {
    if (!(camera instanceof OrthographicCamera)) return;
    camera.position.set(8, 11, 10); camera.lookAt(0, 0.3, 0);
    camera.zoom = Math.min(size.width / 10.7, size.height / 8.3);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const project = (x: number, y: number) => {
      const v = new Vector3(ROOM_GRID.x + x * ROOM_GRID.cellSize, 0.1, ROOM_GRID.z + y * ROOM_GRID.cellSize).project(camera);
      return { x: (v.x + 1) * size.width / 2, y: (1 - v.y) * size.height / 2 };
    };
    const origin = project(0, 0); const column = project(1, 0); const row = project(0, 1);
    onProjection({ origin, column: { x: column.x - origin.x, y: column.y - origin.y }, row: { x: row.x - origin.x, y: row.y - origin.y } });
  }, [camera, size.width, size.height, onProjection]);
  return null;
}
export function RoomEditor3D({ player, items, preview, movingIndex, onProjection }: { player: PlayerSave; items: CosmeticItem[]; preview: PlacedFurniture | null; movingIndex: number | null; onProjection(value: GridProjection): void }) {
  const selected = preview && items.find(item => item.id === preview.itemId);
  return <SceneBoundary><Canvas orthographic shadows frameloop="demand" dpr={[1, 1.5]} camera={{ position: [8, 11, 10], zoom: 50, near: 0.1, far: 100 }} gl={{ antialias: true }} aria-label="3D 小屋佈置場景" fallback={<div className="scene-error">請使用支援 WebGL 的瀏覽器來佈置 3D 小屋。</div>}>
    <color attach="background" args={['#e6eadc']} /><ambientLight intensity={1.6} /><hemisphereLight args={['#fff7e1', '#788466', 1.5]} /><directionalLight position={[5, 10, 6]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-normalBias={0.04} />
    <EditorCamera onProjection={onProjection} />
    <Room player={player} items={items} hideIndex={preview && movingIndex !== null ? movingIndex : undefined} />
    {selected && preview && <PlacedItem3D item={selected} placement={preview} />}
  </Canvas></SceneBoundary>;
}
