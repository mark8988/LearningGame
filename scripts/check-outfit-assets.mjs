import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { Box3, Vector3 } from 'three';
import { outfitModelSchema } from '../src/data/schemas.ts';
import { outfitAnchors, outfitBounds, styleSlots } from '../src/data/outfitConfig.ts';
import { createOutfitModel, disposeOutfitModel } from '../src/components/outfitModel.ts';
const root = new URL('../content-packs/science-g3/', import.meta.url);
const models = z.array(outfitModelSchema).parse(JSON.parse(await readFile(new URL('outfit-models.json', root), 'utf8')));
const items = JSON.parse(await readFile(new URL('items.json', root), 'utf8'));
const seen = new Set();
for (const model of models) {
  if (seen.has(model.asset)) throw new Error(`Duplicate model: ${model.asset}`); seen.add(model.asset);
  if (styleSlots[model.style] !== model.slot || model.anchor.some((v, i) => v !== outfitAnchors[model.slot][i])) throw new Error(`Invalid anchor/slot: ${model.asset}`);
  const object = createOutfitModel(model);
  try {
    const bounds = new Box3().setFromObject(object); const size = bounds.getSize(new Vector3()).toArray();
    if (bounds.isEmpty() || size.some((v, i) => !Number.isFinite(v) || v <= 0 || v > outfitBounds[model.slot][i] + 0.001) || bounds.min.y < -0.001 || bounds.max.y > 2.5) throw new Error(`Outfit model exceeds avatar bounds: ${model.asset} ${size}`);
  } finally { disposeOutfitModel(object); }
}
for (const item of items.filter(i => i.kind === 'outfit')) if (!models.some(model => model.asset === item.asset && model.slot === item.outfitSlot)) throw new Error(`Missing outfit model: ${item.id}`);
console.log(`3D outfit assets passed: ${models.length} models, fixed anchors and geometry bounds`);
