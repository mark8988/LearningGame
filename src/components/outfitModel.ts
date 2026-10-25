import * as THREE from 'three';
import type { OutfitModel } from '../data/schemas';
export function createOutfitModel(model: OutfitModel) {
  const group = new THREE.Group(); group.name = model.asset; group.position.set(...model.anchor);
  const material = (color: string) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true });
  const add = (geometry: THREE.BufferGeometry, color: string, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]) => {
    const mesh = new THREE.Mesh(geometry, material(color)); mesh.position.set(...position); mesh.rotation.set(...rotation); mesh.castShadow = true; group.add(mesh); return mesh;
  };
  const box = (size: [number, number, number], p: [number, number, number], color = model.color, r?: [number, number, number]) => add(new THREE.BoxGeometry(...size), color, p, r);
  const cylinder = (top: number, bottom: number, height: number, p: [number, number, number], color = model.color) => add(new THREE.CylinderGeometry(top, bottom, height, 10), color, p);
  switch (model.style) {
    case 'hair':
      add(new THREE.SphereGeometry(0.35, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), model.color, [0, -0.02, 0]);
      box([0.12, 0.22, 0.2], [-0.29, -0.08, 0]); box([0.12, 0.22, 0.2], [0.29, -0.08, 0]);
      add(new THREE.ConeGeometry(0.14, 0.22, 5), model.accent, [0.12, 0.3, -0.03], [0, 0, -0.3]); break;
    case 'jacket':
      box([0.59, 0.5, 0.4], [0, 0.09, 0]); box([0.2, 0.54, 0.24], [-0.4, 0, 0], model.color, [0, 0, -0.15]); box([0.2, 0.54, 0.24], [0.4, 0, 0], model.color, [0, 0, 0.15]);
      box([0.04, 0.48, 0.02], [0, 0.09, 0.21], model.accent); box([0.14, 0.12, 0.02], [-0.16, 0, 0.21], model.accent); break;
    case 'trousers': box([0.23, 0.28, 0.35], [-0.15, -0.02, 0]); box([0.23, 0.28, 0.35], [0.15, -0.02, 0]); box([0.48, 0.06, 0.36], [0, 0.1, 0], model.accent); break;
    case 'boots':
      for (const x of [-0.16, 0.16]) { box([0.24, 0.29, 0.32], [x, 0.01, 0]); box([0.25, 0.05, 0.35], [x, -0.115, 0.015], model.accent); } break;
    case 'cap': cylinder(0.33, 0.37, 0.22, [0, 0.05, 0]); cylinder(0.5, 0.5, 0.05, [0, -0.07, 0], model.accent); break;
    case 'crown':
      cylinder(0.34, 0.35, 0.1, [0, 0, 0], model.accent);
      for (let i = 0; i < 6; i++) { const angle = i * Math.PI / 3; add(new THREE.ConeGeometry(0.12, 0.35, 4), model.color, [Math.cos(angle) * 0.28, 0.17, Math.sin(angle) * 0.28], [0.15 * Math.sin(angle), 0, -0.15 * Math.cos(angle)]); } break;
    case 'feather': cylinder(0.32, 0.36, 0.32, [0, 0.12, 0]); cylinder(0.5, 0.5, 0.05, [0, -0.07, 0], model.accent); box([0.1, 0.4, 0.05], [0.29, 0.35, 0.07], model.accent, [0, 0, -0.25]); break;
    case 'magnet':
      cylinder(0.34, 0.35, 0.07, [0, -0.06, 0], model.accent);
      box([0.13, 0.36, 0.17], [-0.22, 0.13, 0]); box([0.13, 0.36, 0.17], [0.22, 0.13, 0], model.accent); box([0.57, 0.12, 0.17], [0, 0.32, 0]); break;
    case 'scarf': box([0.62, 0.12, 0.49], [0, 0, 0]); box([0.14, 0.44, 0.06], [0.18, -0.22, 0.24]); box([0.15, 0.04, 0.07], [0.18, -0.42, 0.24], model.accent); break;
    case 'lantern':
      box([0.24, 0.32, 0.24], [0, 0, 0]); box([0.3, 0.05, 0.3], [0, 0.185, 0], model.accent); box([0.3, 0.05, 0.3], [0, -0.185, 0], model.accent);
      add(new THREE.TorusGeometry(0.09, 0.025, 5, 10), model.accent, [0, 0.3, 0]); break;
  }
  return group;
}
export function disposeOutfitModel(group: THREE.Group) {
  group.traverse(object => { if (object instanceof THREE.Mesh) { object.geometry.dispose(); const materials = Array.isArray(object.material) ? object.material : [object.material]; materials.forEach(material => material.dispose()); } });
}
