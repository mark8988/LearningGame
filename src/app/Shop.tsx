import { useState } from 'react';
import { Armchair, ArrowRight, Coins, FlaskConical, Package, Shirt } from 'lucide-react';
import { boot } from '../stores/gameStore';
import { World3D } from '../components/World3D';
import { Dialog } from '../components/Dialog';
import { gameConfig } from '../data/gameConfig';
import { purchase } from '../logic/shop';

export const rarityNames = { common: '普通', rare: '稀有', epic: '史詩' };
export function Shop() {
  const game = boot!.store();
  const { pack, player } = game;
  const [tab, setTab] = useState<'furniture' | 'outfit' | 'potions'>('furniture');
  const [selectedId, setSelectedId] = useState(pack.items.find(i => i.kind === 'furniture' && i.obtainFrom.includes('shop'))?.id ?? '');
  const [confirm, setConfirm] = useState(false);
  const selected = pack.items.find(i => i.id === selectedId);
  const potion = tab === 'potions';
  const name = potion ? gameConfig.potion.name : selected?.name ?? '此分類尚無商品';
  const price = potion ? gameConfig.potion.price : selected?.price ?? 0;
  const quantity = potion ? player.potions : player.inventory[selectedId] ?? 0;
  const eligibility = purchase(player, potion ? gameConfig.potion.id : selectedId, pack);
  const tabs = [{ id: 'furniture', label: '家具', icon: Armchair }, { id: 'outfit', label: '服裝', icon: Shirt }, { id: 'potions', label: '藥水', icon: FlaskConical }] as const;
  return <>
    <div className="shop-tabs" role="tablist" aria-label="商品分類">{tabs.map(({ id, label, icon: Icon }) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); if (id !== 'potions') setSelectedId(pack.items.find(i => i.kind === id && i.obtainFrom.includes('shop'))?.id ?? ''); }}><Icon size={18} />{label}</button>)}</div>
    <div className="shop-layout"><section className="shop-products" role="tabpanel" aria-label={`${tabs.find(t => t.id === tab)!.label}商品`}>
      <div className="shop-intro"><b>{potion ? '為下一次冒險補充元氣' : tab === 'furniture' ? '把森林的溫暖，帶回家' : '收藏屬於你的探險風格'}</b><p>{potion ? '戰鬥中回復 50 HP，生命全滿時不會消耗。' : tab === 'furniture' ? '家具已收入背包，之後可在佈置模式中擺放。' : '裝扮僅改變外觀，衣櫃換裝功能即將開放。'}</p></div>
      <div className="product-grid">{potion ? <button className="product-card selected" aria-pressed="true"><span className="product-illustration potion"><FlaskConical size={40} strokeWidth={1.4} /></span><span className="rarity common">消耗品</span><b>{gameConfig.potion.name}</b><span className="product-price"><Coins size={14} />{gameConfig.potion.price} 金幣</span><small>背包：{player.potions} / {gameConfig.potion.limit} 瓶</small></button> : pack.items.filter(i => i.kind === tab && i.obtainFrom.includes('shop')).map(item => <button key={item.id} className={`product-card ${selectedId === item.id ? 'selected' : ''}`} aria-pressed={selectedId === item.id} onClick={() => setSelectedId(item.id)}><span className={`product-illustration ${item.rarity}`}>{item.kind === 'furniture' ? <Armchair size={40} strokeWidth={1.4} /> : <Shirt size={40} strokeWidth={1.4} />}</span><span className={`rarity ${item.rarity}`}>{rarityNames[item.rarity]}</span><b>{item.name}</b><span className="product-price"><Coins size={14} />{item.price} 金幣</span><small>{item.kind === 'furniture' ? `已擁有 ${player.inventory[item.id] ?? 0} / 9 件` : player.ownedItemIds.includes(item.id) ? '已收藏' : '尚未收藏'}</small></button>)}</div>
      <div className="shop-inventory"><Package size={17} /><span>收藏背包：{player.ownedItemIds.length} 款外觀道具 · {player.potions} 瓶藥水</span></div>
    </section><aside className="product-preview"><section className="scene-card product-scene"><World3D mode="shop" player={player} units={pack.units} item={potion ? 'potion' : selected} /><div className="scene-caption"><span>3D 商品預覽</span><span>拖曳可旋轉</span></div></section><div className="preview-details"><span className={`rarity ${potion ? 'common' : selected?.rarity ?? 'common'}`}>{potion ? '隨身補給' : selected ? rarityNames[selected.rarity] : '敬請期待'}</span><h2>{name}</h2><p>{potion ? '回復最多 50 HP，不超過生命上限。使用藥水不會消耗答題回合。' : !selected ? '這份內容包目前沒有此分類的商品，先探索其他收藏吧！' : selected.kind === 'furniture' ? '每款可收藏最多九件。未來佈置小屋時，就能讓它找到自己的位置。' : '每款裝扮收藏一件即可。通關掉到重複裝扮，會自動轉為 30 金幣。'}</p>{(potion || selected) && <><div className="preview-price"><span><Coins size={19} /><b>{price}</b>金幣</span><small>已擁有 {quantity} {potion ? '瓶' : '件'}</small></div><button className="primary" disabled={!eligibility.ok} onClick={() => setConfirm(true)}>購買{name}<ArrowRight size={16} /></button>{!eligibility.ok && <p className="purchase-reason">{eligibility.message}</p>}</>}</div></aside></div>
    {confirm && <Dialog title={`購買${name}？`} onClose={() => setConfirm(false)}><p>花費 <b>{price}</b> 金幣購買一件。你的餘額為 {player.coins} 金幣。</p><button className="primary" onClick={() => { game.buy(potion ? gameConfig.potion.id : selectedId); setConfirm(false); }}>確認購買<Coins size={17} /></button><button className="text-button" onClick={() => setConfirm(false)}>再看看</button></Dialog>}
  </>;
}
