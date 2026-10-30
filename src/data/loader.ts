import type { ContentPack } from './schemas';
import { validatePack } from './validation';
export { validatePack, parseFile } from './validation';

const modules = import.meta.glob('../../content-packs/science-g3/*.json', { eager: true, import: 'default' });
export function loadBuiltinPack(): ContentPack {
  const files = Object.fromEntries(Object.entries(modules).map(([path, value]) => [path.split('/').pop()!, value]));
  const pack = validatePack(files);
  console.info(`[內容包] ${pack.manifest.name}：${pack.units.length} 個單元，${pack.questions.length} 題`);
  return pack;
}
