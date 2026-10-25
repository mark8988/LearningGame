import { Component, useLayoutEffect, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PlayerSave } from '../logic/save';
import type { CosmeticItem, OutfitModel, Unit } from '../data/schemas';
import { isUnlocked } from '../logic/battle';
import { footprint, ROOM_GRID, type PlacedFurniture } from '../logic/placement';
import { AvatarRenderer, OutfitPart } from './AvatarRenderer';
import { resolveOutfit } from '../logic/outfits';

function Box({ color, ...props }: ThreeElements['mesh'] & { color: string }) {
  return <mesh castShadow receiveShadow {...props}><boxGeometry /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
function Sphere({ color, ...props }: ThreeElements['mesh'] & { color: string }) {
  return <mesh castShadow {...props}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={color} roughness={0.9} flatShading /></mesh>;
}
function Tree({ position, scale = 1, color = '#4f7952' }: { position: [number, number, number]; scale?: number; color?: string }) {
  return <group position={position} scale={scale}><Box color="#92704e" position={[0, 0.65, 0]} scale={[0.22, 1.3, 0.22]} /><mesh castShadow position={[0, 1.6, 0]}><coneGeometry args={[0.8, 1.6, 6]} /><meshStandardMaterial color={color} flatShading /></mesh><mesh castShadow position={[0, 2.2, 0]}><coneGeometry args={[0.6, 1.3, 6]} /><meshStandardMaterial color="#88a66e" flatShading /></mesh></group>;
}
function Boss({ theme = 'plant', hit = false }: { theme?: string; hit?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const color = theme === 'weather' ? '#8b86b4' : theme === 'water' ? '#7ec9cf' : theme === 'magnet' ? '#a9938d' : theme === 'animal' ? '#d6b88b' : '#739766';
  useFrame(({ clock }) => { if (ref.current) { ref.current.position.y = 0.8 + Math.sin(clock.elapsedTime * 2) * 0.1; ref.current.rotation.z = hit ? Math.sin(clock.elapsedTime * 25) * 0.035 : 0; } });
  return <group ref={ref} position={[2.3, 0.8, 0]}><Sphere color={hit ? '#edcaa3' : color} scale={[0.96, 1.15, 0.8]} position={[0, 0.55, 0]} /><Sphere color={color} position={[-0.95, 0.25, 0]} scale={[0.3, 0.65, 0.33]} /><Sphere color={color} position={[0.95, 0.25, 0]} scale={[0.3, 0.65, 0.33]} />
    <Sphere color="#f8f1d6" position={[-0.3, 0.8, 0.68]} scale={[0.2, 0.25, 0.13]} /><Sphere color="#f8f1d6" position={[0.3, 0.8, 0.68]} scale={[0.2, 0.25, 0.13]} />
    <Sphere color="#2d4739" position={[-0.3, 0.78, 0.79]} scale={[0.075, 0.12, 0.045]} /><Sphere color="#2d4739" position={[0.3, 0.78, 0.79]} scale={[0.075, 0.12, 0.045]} />
    <mesh castShadow position={[-0.45, 1.7, 0]} rotation={[0, 0, 0.4]}><coneGeometry args={[0.3, 0.8, 5]} /><meshStandardMaterial color="#d8bb77" /></mesh><mesh castShadow position={[0.45, 1.7, 0]} rotation={[0, 0, -0.4]}><coneGeometry args={[0.3, 0.8, 5]} /><meshStandardMaterial color="#d8bb77" /></mesh>
  </group>;
}
function Furniture({ kind, x, z }: { kind: string; x: number; z: number }) {
  return <group position={[x, 0.1, z]}>
    {kind === 'bed' ? <><Box color="#99704d" scale={[1.5, 0.3, 2.2]} position={[0, 0.2, 0]} /><Box color="#7e9a87" scale={[1.4, 0.25, 1.8]} position={[0, 0.46, 0.1]} /><Box color="#faf2d9" scale={[1.15, 0.2, 0.45]} position={[0, 0.6, -0.65]} /><Box color="#99704d" scale={[1.6, 0.9, 0.12]} position={[0, 0.45, -1.08]} /></> : kind === 'rug' ? <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]} receiveShadow><circleGeometry args={[1.4, 8]} /><meshStandardMaterial color="#d4ad67" /></mesh> : <><Box color="#af865b" scale={[kind === 'desk' ? 1.5 : 0.6, 0.14, kind === 'desk' ? 0.8 : 0.6]} position={[0, 0.8, 0]} />{[-1, 1].flatMap(a => [-1, 1].map(b => <Box key={`${a}${b}`} color="#967049" scale={[0.1, 0.8, 0.1]} position={[a * (kind === 'desk' ? 0.6 : 0.23), 0.4, b * 0.24]} />))}{kind === 'chair' && <Box color="#af865b" scale={[0.6, 0.6, 0.12]} position={[0, 1.05, -0.24]} />}</>}
  </group>;
}
export function Room({ player, items, models = [], hideIndex }: { player: PlayerSave; items: CosmeticItem[]; models?: OutfitModel[]; hideIndex?: number }) {
  return <group>
    <Box color="#94a17a" scale={[11, 0.5, 9]} position={[0, -0.45, 0]} /><Box color="#c7a67d" scale={[7.3, 0.25, 5.9]} position={[0, -0.08, 0]} />
    {Array.from({ length: 13 }, (_, i) => <Box key={i} color={i % 2 ? '#dfc39e' : '#e6cda9'} position={[-3.3 + i * 0.55, 0.065, 0]} scale={[0.52, 0.045, 5.7]} />)}
    <Box color="#e7d6b3" position={[0, 1.65, -2.85]} scale={[7.1, 3.2, 0.18]} /><Box color="#dfcca9" position={[-3.5, 1.65, 0]} scale={[0.18, 3.2, 5.8]} />
    <Box color="#8eac9c" position={[-1, 2, -2.72]} scale={[1.55, 1.35, 0.1]} /><Box color="#f1dbad" position={[-1, 2, -2.62]} scale={[0.07, 1.4, 0.09]} /><Box color="#f1dbad" position={[-1, 2, -2.62]} scale={[1.6, 0.07, 0.09]} />
    <Box color="#9c7550" position={[1.5, 1.9, -2.65]} scale={[1.8, 0.12, 0.4]} />
    {['#8eac9c', '#d6b170', '#b67e65', '#7e958b', '#cbba86'].map((color, i) => <Box key={color} color={color} position={[0.85 + i * 0.24, 2.16, -2.7]} scale={[0.16, 0.4 + i % 2 * 0.1, 0.2]} rotation={[0, 0, i === 4 ? -0.15 : 0]} />)}
    <Box color="#98704b" position={[-3.35, 3.25, 0]} scale={[0.28, 0.22, 6]} /><Box color="#98704b" position={[0, 3.25, -2.85]} scale={[7.3, 0.22, 0.28]} />
    {player.roomLayout.map((f, i) => { const item = items.find(item => item.id === f.itemId); return item && i !== hideIndex ? <PlacedItem3D key={`${f.itemId}-${i}`} item={item} placement={f} /> : null; })}
    <AvatarRenderer player={player} items={items} models={models} position={[0, 0.1, 2.5]} /><Tree position={[4.2, -0.2, -2.5]} scale={1.3} /><Tree position={[-4.5, -0.2, 2.5]} scale={0.9} /><Tree position={[3.8, -0.2, 3.1]} scale={0.7} />
    {Array.from({ length: 9 }, (_, i) => <Sphere key={i} color={i % 2 ? '#dfca88' : '#84965e'} position={[3.7 + Math.sin(i * 5) * 0.5, -0.04, -0.8 + i * 0.27]} scale={[0.14, 0.15, 0.14]} />)}
  </group>;
}
export function PlacedItem3D({ item, placement }: { item: CosmeticItem; placement: PlacedFurniture }) {
  const ref = useRef<THREE.Group>(null);
  useLayoutEffect(() => {
    const model = ref.current;
    if (!model) return;
    model.scale.set(1, 1, 1); model.position.set(0, 0, 0);
    const clone = model.clone(); clone.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(clone);
    const size = bounds.getSize(new THREE.Vector3()); const center = bounds.getCenter(new THREE.Vector3());
    const sx = ((item.gridW ?? 1) * ROOM_GRID.cellSize - 0.06) / Math.max(size.x, 0.01);
    const sz = ((item.gridH ?? 1) * ROOM_GRID.cellSize - 0.06) / Math.max(size.z, 0.01);
    const sy = Math.min(sx, sz);
    model.scale.set(sx, sy, sz); model.position.set(-center.x * sx, -bounds.min.y * sy, -center.z * sz);
  }, [item.id, item.gridW, item.gridH]);
  const { w, h } = footprint(item, placement.rotation);
  const position: [number, number, number] = [ROOM_GRID.x + (placement.x + w / 2) * ROOM_GRID.cellSize, 0.1 + (item.layer ?? 1) * 0.015, ROOM_GRID.z + (placement.y + h / 2) * ROOM_GRID.cellSize];
  return <group position={position} rotation={[0, placement.rotation * Math.PI / 2, 0]}><group ref={ref}><ProductModel item={item} /></group></group>;
}
function ProductModel({ item, model }: { item: CosmeticItem | 'potion'; model?: OutfitModel }) {
  if (item !== 'potion' && item.kind === 'outfit' && model) return <group scale={1.5} position={[-model.anchor[0] * 1.5, 0.8 - model.anchor[1] * 1.5, -model.anchor[2] * 1.5]}><OutfitPart model={model} /></group>;
  if (item === 'potion') return <group><mesh castShadow position={[0, 0.75, 0]}><cylinderGeometry args={[0.38, 0.48, 0.95, 8]} /><meshStandardMaterial color="#b0c5a1" /></mesh><Box color="#99b38e" scale={[0.45, 0.35, 0.45]} position={[0, 1.32, 0]} /><Box color="#b38b59" scale={[0.48, 0.16, 0.48]} position={[0, 1.53, 0]} /><Box color="#f5e6c3" scale={[0.3, 0.12, 0.06]} position={[0, 0.8, 0.47]} /><Box color="#f5e6c3" scale={[0.12, 0.34, 0.06]} position={[0, 0.8, 0.47]} /></group>;
  if (item.kind === 'furniture') {
    if (item.id === 'bookshelf') return <group><Box color="#ac8158" scale={[1.5, 1.9, 0.5]} position={[0, 0.95, 0]} />{[0.4, 1.05, 1.7].map(y => <group key={y}><Box color="#745c45" scale={[1.25, 0.45, 0.07]} position={[0, y, 0.28]} />{['#8da48e', '#cbb577', '#bd9174'].map((c, i) => <Box key={c} color={c} scale={[0.24, 0.42, 0.2]} position={[-0.4 + i * 0.35, y, 0.37]} />)}</group>)}</group>;
    if (item.id === 'telescope') return <group><Box color="#b8a27a" scale={[0.14, 1.1, 0.14]} position={[0, 0.6, 0]} /><Box color="#aa916f" scale={[1.2, 0.12, 0.12]} position={[0, 0.15, 0]} /><mesh castShadow position={[0, 1.35, 0]} rotation={[0.4, 0, Math.PI / 2.7]}><cylinderGeometry args={[0.25, 0.2, 1.5, 10]} /><meshStandardMaterial color="#709086" /></mesh></group>;
    if (item.id === 'rainbow-window') return <group><Box color="#b49062" scale={[1.8, 1.8, 0.18]} position={[0, 1, 0]} /><Box color="#a7c8c0" scale={[1.5, 1.5, 0.2]} position={[0, 1, 0.03]} />{['#c89a86', '#d9c281', '#93aa83', '#8baaba', '#a49aba'].map((color, i) => <mesh key={color} position={[0, 0.85, 0.2 + i * 0.01]}><torusGeometry args={[0.6 - i * 0.09, 0.04, 5, 20, Math.PI]} /><meshStandardMaterial color={color} /></mesh>)}</group>;
    if (item.id === 'crystal-fountain') return <group><mesh castShadow position={[0, 0.3, 0]}><cylinderGeometry args={[0.9, 0.75, 0.5, 8]} /><meshStandardMaterial color="#9cb8b4" /></mesh><mesh castShadow position={[0, 1, 0]}><octahedronGeometry args={[0.65, 0]} /><meshStandardMaterial color="#a1d2d2" metalness={0.2} roughness={0.2} /></mesh></group>;
    return <Furniture kind={item.id} x={0} z={0} />;
  }
  if (item.outfitSlot === 'hat') return <group><mesh castShadow position={[0, 0.9, 0]}><cylinderGeometry args={[0.55, 0.65, 0.6, 8]} /><meshStandardMaterial color={item.rarity === 'epic' ? '#a8b67b' : '#82966f'} /></mesh><mesh castShadow position={[0, 0.6, 0]}><cylinderGeometry args={[0.85, 0.85, 0.09, 8]} /><meshStandardMaterial color="#c6b079" /></mesh>{item.rarity === 'epic' && <Sphere color="#d7c77b" position={[0, 1.45, 0]} scale={[0.2, 0.4, 0.2]} />}</group>;
  if (item.outfitSlot === 'top') return <group><Box color="#799478" position={[0, 0.9, 0]} scale={[1, 1.2, 0.5]} /><Box color="#799478" position={[-0.7, 1.1, 0]} rotation={[0, 0, -0.5]} scale={[0.45, 0.85, 0.45]} /><Box color="#799478" position={[0.7, 1.1, 0]} rotation={[0, 0, 0.5]} scale={[0.45, 0.85, 0.45]} /><Box color="#d9c99a" position={[0, 0.9, 0.27]} scale={[0.07, 1.15, 0.03]} /></group>;
  if (item.outfitSlot === 'handheld') return <group><Box color="#7d8d6a" position={[0, 0.2, 0]} scale={[0.8, 0.2, 0.8]} /><Box color="#e9d59a" position={[0, 0.75, 0]} scale={[0.6, 0.85, 0.6]} /><Box color="#7d8d6a" position={[0, 1.23, 0]} scale={[0.8, 0.15, 0.8]} /><mesh position={[0, 1.5, 0]}><torusGeometry args={[0.25, 0.05, 6, 12]} /><meshStandardMaterial color="#7d8d6a" /></mesh></group>;
  return <group><Box color="#8ca17d" position={[0, 1.1, 0]} scale={[1.3, 0.3, 0.6]} /><Box color="#8ca17d" position={[0.3, 0.65, 0.22]} scale={[0.32, 0.8, 0.18]} /><Sphere color="#c6b778" position={[0.3, 0.25, 0.22]} scale={0.2} /></group>;
}
function TreasureChest({ open }: { open: boolean }) {
  const lid = useRef<THREE.Group>(null);
  useFrame((_, delta) => { if (lid.current) lid.current.rotation.x = THREE.MathUtils.damp(lid.current.rotation.x, open ? -1.6 : 0, 5, delta); });
  return <group position={[1.5, 0.3, 0.7]} rotation={[0, -0.3, 0]}><Box color="#a77c4d" position={[0, 0.4, 0]} scale={[1.7, 0.8, 1.2]} /><Box color="#d9ba70" position={[-0.55, 0.4, 0.01]} scale={[0.13, 0.82, 1.24]} /><Box color="#d9ba70" position={[0.55, 0.4, 0.01]} scale={[0.13, 0.82, 1.24]} /><group ref={lid} position={[0, 0.8, -0.6]}><Box color="#b48b58" position={[0, 0.15, 0.6]} scale={[1.72, 0.3, 1.22]} /><Box color="#e7c880" position={[0, 0.05, 1.23]} scale={[0.25, 0.4, 0.08]} /></group>{open && <><pointLight position={[0, 1.3, 0]} color="#f5d47a" intensity={5} distance={5} />{[-0.5, 0, 0.5].map((x, i) => <Sphere key={x} color="#f3d48b" position={[x, 1.4 + i * 0.3, 0]} scale={0.1} />)}</>}</group>;
}
function Arena({ unit, hit, result, won, chestOpen, player, items, models }: { unit?: Unit; hit: boolean; result: boolean; won: boolean; chestOpen: boolean; player: PlayerSave; items: CosmeticItem[]; models: OutfitModel[] }) {
  return <group><mesh position={[0, -0.2, 0]} receiveShadow><cylinderGeometry args={[5.2, 4.7, 0.6, 12]} /><meshStandardMaterial color="#a9b087" flatShading /></mesh><mesh position={[0, 0.11, 0]} receiveShadow><cylinderGeometry args={[3.8, 3.8, 0.02, 32]} /><meshStandardMaterial color="#d3c29c" /></mesh>
    {[[-4, 0, -2], [-2.4, 0, -3.6], [0, 0, -4.2], [3.1, 0, -3], [4.6, 0, 1]].map((p, i) => <Tree key={i} position={p as [number, number, number]} scale={0.9 + i % 2 * 0.35} />)}
    <group rotation={[0, 0.55, 0]}><AvatarRenderer player={player} items={items} models={models} position={[-2, 0.14, 0.8]} celebrating={result && won} /></group>{!result && <Boss theme={unit?.boss.asset.split(':')[1]} hit={hit} />}{result && won && <TreasureChest open={chestOpen} />}
    <Sphere color="#8e9e7b" position={[-3.9, 0.3, 1.8]} scale={[0.6, 0.4, 0.6]} /><Sphere color="#8e9e7b" position={[3.9, 0.3, 1.8]} scale={[0.5, 0.4, 0.5]} />
  </group>;
}
function Islands({ units, player, onSelect }: { units: Unit[]; player: PlayerSave; onSelect?: (id: string) => void }) {
  return <group>{units.map((unit, i) => { const unlocked = isUnlocked(unit, player.clearedUnitIds); const x = (i - 2) * 2.3; const z = Math.sin(i * 1.4) * 1.2; return <group key={unit.id} position={[x, 0, z]} onClick={() => unlocked && onSelect?.(unit.id)}>
    <mesh receiveShadow castShadow><cylinderGeometry args={[1.25, 0.75, 0.65, 7]} /><meshStandardMaterial color={unlocked ? '#9fae77' : '#aaa99b'} flatShading /></mesh><Tree position={[0.1, 0.3, -0.3]} scale={0.65} color={unlocked ? '#688965' : '#92978e'} />
    <Sphere color={player.clearedUnitIds.includes(unit.id) ? '#edc46a' : unlocked ? '#dce4b4' : '#89928a'} position={[-0.35, 0.6, 0.4]} scale={0.23} />
    {i < units.length - 1 && [0, 1, 2].map(j => <Box key={j} color="#b8a07b" position={[1.2 + j * 0.25, -0.05, -0.15]} scale={[0.18, 0.12, 0.55]} />)}
  </group>; })}</group>;
}
export class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-error" role="alert">3D 場景無法啟動。請開啟瀏覽器硬體加速，或使用支援 WebGL 的瀏覽器。</div> : this.props.children; }
}
export function World3D({ mode, player, units, unit, hit = false, onSelect, item, chestOpen = false, won = true, items = [], models = [] }: { mode: 'home' | 'map' | 'battle' | 'result' | 'shop' | 'wardrobe'; player: PlayerSave; units: Unit[]; unit?: Unit; hit?: boolean; onSelect?: (id: string) => void; item?: CosmeticItem | 'potion'; chestOpen?: boolean; won?: boolean; items?: CosmeticItem[]; models?: OutfitModel[] }) {
  const appearance = resolveOutfit(player, { items, outfitModels: models });
  return <SceneBoundary><Canvas key={mode} shadows frameloop={mode === 'shop' || mode === 'map' || mode === 'wardrobe' ? 'demand' : 'always'} dpr={[1, 1.5]} camera={{ position: mode === 'home' ? [9, 8, 11] : mode === 'map' ? [6, 9, 13] : mode === 'wardrobe' ? [2.8, 1.9, 4] : mode === 'shop' ? [4, 3, 5] : [7, 5.5, 11], fov: mode === 'map' ? 43 : 40 }} gl={{ antialias: true, powerPreference: 'high-performance' }} fallback={<div className="scene-error">需要支援 WebGL 的瀏覽器才能呈現 3D 世界。</div>} aria-label={mode === 'home' ? '可旋轉的 3D 森林小屋與探險角色' : mode === 'map' ? '3D 冒險浮島地圖' : mode === 'wardrobe' ? '3D 人物穿搭預覽' : mode === 'shop' ? '商品 3D 預覽' : '3D 森林戰鬥場景'}>
    <color attach="background" args={[mode === 'home' ? '#e6eadc' : '#dce5d6']} /><fog attach="fog" args={['#dce5d6', 22, 48]} />
    <ambientLight intensity={1.6} /><hemisphereLight args={['#fff7e1', '#788466', 1.5]} /><directionalLight position={[5, 10, 6]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-normalBias={0.04} />
    {mode === 'home' ? <Room player={player} items={items} models={models} /> : mode === 'map' ? <Islands units={units} player={player} onSelect={onSelect} /> : mode === 'shop' || mode === 'wardrobe' ? <><mesh receiveShadow position={[0, -0.12, 0]}><cylinderGeometry args={[mode === 'wardrobe' ? 1 : 2.2, mode === 'wardrobe' ? 0.9 : 2, 0.25, 12]} /><meshStandardMaterial color="#bac7a4" /></mesh>{mode === 'wardrobe' ? <AvatarRenderer player={player} items={items} models={models} /> : item && <ProductModel item={item} model={item === 'potion' ? undefined : models.find(model => model.asset === item.asset)} />}</> : <Arena unit={unit} hit={hit} result={mode === 'result'} won={won} chestOpen={chestOpen} player={player} items={items} models={models} />}
    <OrbitControls makeDefault enablePan={false} enableZoom minDistance={mode === 'wardrobe' ? 3 : mode === 'shop' ? 4 : 8} maxDistance={22} maxPolarAngle={Math.PI / 2.15} minPolarAngle={0.25} target={[0, mode === 'wardrobe' ? 0.9 : mode === 'map' ? 0 : 0.6, 0]} />
  </Canvas>{mode !== 'map' && mode !== 'shop' && <span className="sr-only" aria-label="目前穿搭" data-testid="avatar-outfit" data-items={appearance.map(p => p.item.id).join('|')}>{appearance.map(p => p.item.name).join('、') || '森林日常裝'}</span>}</SceneBoundary>;
}
