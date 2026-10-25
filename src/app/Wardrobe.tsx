import { useState } from 'react';
import { ArrowRight, Check, RotateCcw, Shirt, Sparkles } from 'lucide-react';
import { boot } from '../stores/gameStore';
import { World3D } from '../components/World3D';
import { outfitSlots, slotNames } from '../data/outfitConfig';
import type { OutfitSlot } from '../data/schemas';
import { rarityNames } from './Shop';
import { resolveOutfit } from '../logic/outfits';
export function Wardrobe() {
  const game = boot!.store(); const { pack, player } = game;
  const [slot, setSlot] = useState<OutfitSlot>('hat');
  const owned = pack.items.filter(item => item.kind === 'outfit' && item.outfitSlot === slot && player.ownedItemIds.includes(item.id) && (player.inventory[item.id] ?? 0) > 0);
  const appearance = resolveOutfit(player, pack);
  return <div className="wardrobe-layout"><aside className="wardrobe-preview"><section className="scene-card wardrobe-scene"><World3D mode="wardrobe" player={player} units={pack.units} items={pack.items} models={pack.outfitModels} /><div className="scene-caption"><span>你的探險穿搭</span><span>拖曳旋轉 · 雙指縮放</span></div></section><div className="wardrobe-caption"><Sparkles size={18} /><p>喜歡的樣子，就是最好的裝備。<small>裝扮不影響攻擊力、生命或獎勵。</small></p></div><ul className="equipped-list" aria-label="已穿戴部位">{outfitSlots.map(key => <li key={key}><span>{slotNames[key]}</span><b>{appearance.find(p => p.slot === key)?.item.name ?? '森林日常裝'}</b></li>)}</ul></aside>
    <section className="wardrobe-closet"><div className="wardrobe-heading"><Shirt size={23} /><div><h2>我的衣櫃</h2><p>點選已收藏的裝扮，立即換上並自動儲存。</p></div></div><div className="wardrobe-tabs" role="tablist" aria-label="裝扮部位">{outfitSlots.map(key => <button key={key} role="tab" aria-selected={key === slot} onClick={() => setSlot(key)}>{slotNames[key]}</button>)}</div><div className="wardrobe-items" role="tabpanel" aria-label={`${slotNames[slot]}衣櫃`}><button className={`outfit-card ${!player.equippedOutfit[slot] ? 'equipped' : ''}`} aria-label={`還原預設${slotNames[slot]}`} aria-pressed={!player.equippedOutfit[slot]} onClick={() => game.equip(slot, null)}><span className="outfit-art"><RotateCcw size={29} /></span><b>森林日常裝</b><small>還原預設{slotNames[slot]}</small>{!player.equippedOutfit[slot] && <span className="equipped-tag"><Check size={14} />穿戴中</span>}</button>{owned.map(item => <button key={item.id} className={`outfit-card ${player.equippedOutfit[slot] === item.id ? 'equipped' : ''}`} aria-label={`穿戴${item.name}`} aria-pressed={player.equippedOutfit[slot] === item.id} onClick={() => game.equip(slot, item.id)}><span className={`outfit-art ${item.rarity}`}><Shirt size={32} strokeWidth={1.4} /></span><span className={`rarity ${item.rarity}`}>{rarityNames[item.rarity]}</span><b>{item.name}</b><small>{slotNames[slot]} · 已收藏</small>{player.equippedOutfit[slot] === item.id && <span className="equipped-tag"><Check size={14} />穿戴中</span>}</button>)}</div>{!owned.length && <div className="empty-wardrobe"><Shirt size={27} /><h3>這個部位還沒有收藏</h3><p>到商店試穿看看，或在冒險寶箱裡發現驚喜。</p><button className="text-button" onClick={() => game.navigate('shop')}>去森林商店<ArrowRight size={16} /></button></div>}</section>
  </div>;
}
