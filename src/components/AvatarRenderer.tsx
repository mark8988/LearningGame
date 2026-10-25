import { useLayoutEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { CosmeticItem, OutfitModel } from '../data/schemas';
import type { PlayerSave } from '../logic/save';
import { resolveOutfit } from '../logic/outfits';
import { createOutfitModel, disposeOutfitModel } from './outfitModel';

export function OutfitPart({ model }: { model: OutfitModel }) {
  const ref = useRef<THREE.Group>(null); const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => { const host = ref.current; if (!host) return; const object = createOutfitModel(model); host.add(object); invalidate(); return () => { host.remove(object); disposeOutfitModel(object); }; }, [model, invalidate]);
  return <group ref={ref} />;
}
function Block({ color, position, scale, rotation = [0, 0, 0] }: { color: string; position: [number, number, number]; scale: [number, number, number]; rotation?: [number, number, number] }) {
  return <mesh castShadow position={position} scale={scale} rotation={rotation}><boxGeometry /><meshStandardMaterial color={color} roughness={0.85} /></mesh>;
}
export function AvatarRenderer({ player, items, models, position = [0, 0, 0], celebrating = false }: { player: PlayerSave; items: CosmeticItem[]; models: OutfitModel[]; position?: [number, number, number]; celebrating?: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const parts = resolveOutfit(player, { items, outfitModels: models });
  const has = (slot: string) => parts.some(part => part.slot === slot);
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * (celebrating ? 7 : 2)) * (celebrating ? 0.14 : 0.025); });
  return <group ref={ref} position={position} name="adventurer">
    {!has('shoes') && <>{[-0.16, 0.16].map(x => <Block key={x} color="#564f3e" position={[x, 0.14, 0.03]} scale={[0.22, 0.28, 0.29]} />)}</>}
    {!has('bottom') && <Block color="#63846e" position={[0, 0.33, 0]} scale={[0.48, 0.25, 0.34]} />}
    {!has('top') && <><Block color="#e2b865" position={[0, 0.7, 0]} scale={[0.57, 0.5, 0.38]} /><Block color="#e2b865" position={[-0.4, 0.61, 0]} rotation={[0, 0, -0.15]} scale={[0.2, 0.54, 0.23]} /><Block color="#e2b865" position={[0.4, 0.61, 0]} rotation={[0, 0, 0.15]} scale={[0.2, 0.54, 0.23]} /></>}
    <mesh castShadow position={[0, 1.15, 0]} scale={[0.35, 0.37, 0.31]}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#f0c9a2" flatShading /></mesh>
    {[-0.12, 0.12].map(x => <Block key={x} color="#3b3830" position={[x, 1.18, 0.28]} scale={[0.045, 0.065, 0.03]} />)}
    {!has('hair') && <mesh castShadow position={[0, 1.28, -0.04]} scale={[1, has('hat') ? 0.6 : 1, 1]}><sphereGeometry args={[0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#6b503c" /></mesh>}
    <Block color="#b9834d" position={[0, 0.67, -0.29]} scale={[0.43, 0.5, 0.23]} />
    {parts.map(part => part.slot === 'hair' && has('hat') ? <group key={part.slot} scale={[1, 0.55, 1]} position={[0, part.model.anchor[1] * 0.45, 0]}><OutfitPart model={part.model} /></group> : <OutfitPart key={part.slot} model={part.model} />)}
  </group>;
}
