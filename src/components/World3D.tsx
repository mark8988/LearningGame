import { Component, useRef, type ReactNode } from 'react';
import { Canvas, useFrame, type ThreeElements } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { PlayerSave } from '../logic/save';
import type { Unit } from '../data/schemas';
import { isUnlocked } from '../logic/battle';

function Box({ color, ...props }: ThreeElements['mesh'] & { color: string }) {
  return <mesh castShadow receiveShadow {...props}><boxGeometry /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
function Sphere({ color, ...props }: ThreeElements['mesh'] & { color: string }) {
  return <mesh castShadow {...props}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color={color} roughness={0.9} flatShading /></mesh>;
}
function Tree({ position, scale = 1, color = '#4f7952' }: { position: [number, number, number]; scale?: number; color?: string }) {
  return <group position={position} scale={scale}><Box color="#92704e" position={[0, 0.65, 0]} scale={[0.22, 1.3, 0.22]} /><mesh castShadow position={[0, 1.6, 0]}><coneGeometry args={[0.8, 1.6, 6]} /><meshStandardMaterial color={color} flatShading /></mesh><mesh castShadow position={[0, 2.2, 0]}><coneGeometry args={[0.6, 1.3, 6]} /><meshStandardMaterial color="#88a66e" flatShading /></mesh></group>;
}
export function Avatar({ position = [0, 0, 0], celebrating = false }: { position?: [number, number, number]; celebrating?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * (celebrating ? 7 : 2)) * (celebrating ? 0.14 : 0.025); });
  return <group ref={ref} position={position}>
    <Box color="#564f3e" position={[-0.16, 0.14, 0.03]} scale={[0.22, 0.28, 0.29]} /><Box color="#564f3e" position={[0.16, 0.14, 0.03]} scale={[0.22, 0.28, 0.29]} />
    <Box color="#e2b865" position={[0, 0.61, 0]} scale={[0.57, 0.65, 0.38]} /><Box color="#63846e" position={[0, 0.33, 0]} scale={[0.48, 0.25, 0.34]} />
    <Box color="#e2b865" position={[-0.4, 0.61, 0]} rotation={[0, 0, -0.15]} scale={[0.2, 0.54, 0.23]} /><Box color="#e2b865" position={[0.4, 0.61, 0]} rotation={[0, 0, 0.15]} scale={[0.2, 0.54, 0.23]} />
    <Sphere color="#f0c9a2" position={[0, 1.15, 0]} scale={[0.35, 0.37, 0.31]} />
    <Box color="#3b3830" position={[-0.12, 1.18, 0.28]} scale={[0.045, 0.065, 0.03]} /><Box color="#3b3830" position={[0.12, 1.18, 0.28]} scale={[0.045, 0.065, 0.03]} />
    <mesh castShadow position={[0, 1.42, 0]}><cylinderGeometry args={[0.33, 0.37, 0.28, 8]} /><meshStandardMaterial color="#789266" /></mesh>
    <mesh castShadow position={[0, 1.32, 0]}><cylinderGeometry args={[0.51, 0.51, 0.06, 8]} /><meshStandardMaterial color="#789266" /></mesh>
    <Box color="#b9834d" position={[0, 0.67, -0.29]} scale={[0.43, 0.5, 0.23]} />
  </group>;
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
function Room({ player }: { player: PlayerSave }) {
  return <group>
    <Box color="#94a17a" scale={[11, 0.5, 9]} position={[0, -0.45, 0]} /><Box color="#c7a67d" scale={[7.3, 0.25, 5.9]} position={[0, -0.08, 0]} />
    {Array.from({ length: 13 }, (_, i) => <Box key={i} color={i % 2 ? '#dfc39e' : '#e6cda9'} position={[-3.3 + i * 0.55, 0.065, 0]} scale={[0.52, 0.045, 5.7]} />)}
    <Box color="#e7d6b3" position={[0, 1.65, -2.85]} scale={[7.1, 3.2, 0.18]} /><Box color="#dfcca9" position={[-3.5, 1.65, 0]} scale={[0.18, 3.2, 5.8]} />
    <Box color="#8eac9c" position={[-1, 2, -2.72]} scale={[1.55, 1.35, 0.1]} /><Box color="#f1dbad" position={[-1, 2, -2.62]} scale={[0.07, 1.4, 0.09]} /><Box color="#f1dbad" position={[-1, 2, -2.62]} scale={[1.6, 0.07, 0.09]} />
    <Box color="#9c7550" position={[1.5, 1.9, -2.65]} scale={[1.8, 0.12, 0.4]} />
    {['#8eac9c', '#d6b170', '#b67e65', '#7e958b', '#cbba86'].map((color, i) => <Box key={color} color={color} position={[0.85 + i * 0.24, 2.16, -2.7]} scale={[0.16, 0.4 + i % 2 * 0.1, 0.2]} rotation={[0, 0, i === 4 ? -0.15 : 0]} />)}
    <Box color="#98704b" position={[-3.35, 3.25, 0]} scale={[0.28, 0.22, 6]} /><Box color="#98704b" position={[0, 3.25, -2.85]} scale={[7.3, 0.22, 0.28]} />
    {player.roomLayout.map((f, i) => <Furniture key={`${f.itemId}-${i}`} kind={f.itemId} x={f.x * 0.5 - 2.8} z={f.y * 0.55 - 1.7} />)}
    <Avatar position={[0, 0.1, 0.4]} /><Tree position={[4.2, -0.2, -2.5]} scale={1.3} /><Tree position={[-4.5, -0.2, 2.5]} scale={0.9} /><Tree position={[3.8, -0.2, 3.1]} scale={0.7} />
    {Array.from({ length: 9 }, (_, i) => <Sphere key={i} color={i % 2 ? '#dfca88' : '#84965e'} position={[3.7 + Math.sin(i * 5) * 0.5, -0.04, -0.8 + i * 0.27]} scale={[0.14, 0.15, 0.14]} />)}
  </group>;
}
function Arena({ unit, hit, celebrating }: { unit?: Unit; hit: boolean; celebrating: boolean }) {
  return <group><mesh position={[0, -0.2, 0]} receiveShadow><cylinderGeometry args={[5.2, 4.7, 0.6, 12]} /><meshStandardMaterial color="#a9b087" flatShading /></mesh><mesh position={[0, 0.11, 0]} receiveShadow><cylinderGeometry args={[3.8, 3.8, 0.02, 32]} /><meshStandardMaterial color="#d3c29c" /></mesh>
    {[[-4, 0, -2], [-2.4, 0, -3.6], [0, 0, -4.2], [3.1, 0, -3], [4.6, 0, 1]].map((p, i) => <Tree key={i} position={p as [number, number, number]} scale={0.9 + i % 2 * 0.35} />)}
    <group rotation={[0, 0.55, 0]}><Avatar position={[-2, 0.14, 0.8]} celebrating={celebrating} /></group>{!celebrating && <Boss theme={unit?.boss.asset.split(':')[1]} hit={hit} />}
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
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <div className="scene-error" role="alert">3D 場景無法啟動。請開啟瀏覽器硬體加速，或使用支援 WebGL 的瀏覽器。</div> : this.props.children; }
}
export function World3D({ mode, player, units, unit, hit = false, onSelect }: { mode: 'home' | 'map' | 'battle' | 'result'; player: PlayerSave; units: Unit[]; unit?: Unit; hit?: boolean; onSelect?: (id: string) => void }) {
  return <SceneBoundary><Canvas key={mode} shadows dpr={[1, 1.5]} camera={{ position: mode === 'home' ? [9, 8, 11] : mode === 'map' ? [6, 9, 13] : [7, 5.5, 11], fov: mode === 'map' ? 43 : 40 }} gl={{ antialias: true, powerPreference: 'high-performance' }} fallback={<div className="scene-error">需要支援 WebGL 的瀏覽器才能呈現 3D 世界。</div>} aria-label={mode === 'home' ? '可旋轉的 3D 森林小屋與探險角色' : mode === 'map' ? '3D 冒險浮島地圖' : '3D 森林戰鬥場景'}>
    <color attach="background" args={[mode === 'home' ? '#e6eadc' : '#dce5d6']} /><fog attach="fog" args={['#dce5d6', 22, 48]} />
    <ambientLight intensity={1.6} /><hemisphereLight args={['#fff7e1', '#788466', 1.5]} /><directionalLight position={[5, 10, 6]} intensity={2.3} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} shadow-normalBias={0.04} />
    {mode === 'home' ? <Room player={player} /> : mode === 'map' ? <Islands units={units} player={player} onSelect={onSelect} /> : <Arena unit={unit} hit={hit} celebrating={mode === 'result'} />}
    <OrbitControls makeDefault enablePan={false} enableZoom minDistance={8} maxDistance={22} maxPolarAngle={Math.PI / 2.15} minPolarAngle={0.25} target={[0, mode === 'map' ? 0 : 0.6, 0]} />
  </Canvas></SceneBoundary>;
}
