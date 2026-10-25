import { useState, type ReactNode } from 'react';
import { Armchair, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, CircleHelp, Coins, Compass, FlaskConical, Heart, Home, Leaf, LockKeyhole, Maximize2, Mountain, RotateCcw, Shield, ShoppingBag, Sparkles, Sprout, Star, Trophy, X } from 'lucide-react';
import { boot, bootError, type Screen } from '../stores/gameStore';
import { isUnlocked, levelFromXp } from '../logic/battle';
import { World3D } from '../components/World3D';
import { Dialog } from '../components/Dialog';
import { Shop } from './Shop';
import { Results } from './Results';
import { Decor } from './Decor';
import { Wardrobe } from './Wardrobe';
import { Dex } from './Dex';
import { Review } from './Review';
import { Achievements, AchievementNotice } from './Achievements';
import { ParentGate, Parent } from './Parent';
import { PreferencesPanel } from './PreferencesPanel';
import { QuestionStem } from '../components/QuestionStem';
import { usePreferences } from '../stores/preferences';
import { OfflineStatus } from '../components/OfflineStatus';
import { collectionStats } from '../logic/placement';

const icons = [Sprout, Leaf, Mountain, Shield, Sparkles];
function Brand() { return <div className="brand"><span className="brand-icon"><Sprout size={27} strokeWidth={1.7} /></span><div><b>森知冒險</b><span>FOREST OF CURIOSITY</span></div></div>; }
function Badge({ children }: { children: ReactNode }) { return <span className="eyebrow">{children}</span>; }
function Meter({ value, max, label, boss = false }: { value: number; max: number; label: string; boss?: boolean }) { return <div className={`meter ${boss ? 'boss-meter' : ''}`}><div><span>{label}</span><b>{value} <small>/ {max}</small></b></div><progress max={max} value={value} aria-label={`${label}生命值`} /></div>; }

export function App() {
  return boot ? <Game /> : <main className="boot-error"><Brand /><h1>冒險世界暫時無法載入</h1><p role="alert">{bootError}</p><p>請檢查內容包資料，修正後重新整理。</p></main>;
}
function Game() {
  const game = boot!.store();
  const { player, screen, pack, battle, result } = game;
  const [parentGate, setParentGate] = useState(false);
  const [settings, setSettings] = useState(false);
  const largeText = usePreferences(state => state.largeText);
  const [help, setHelp] = useState(false);
  const [leave, setLeave] = useState(false);
  const level = levelFromXp(player.xp);
  const furnitureStats = collectionStats(player, pack.items);
  const next = pack.units.find(u => !player.clearedUnitIds.includes(u.id)) ?? pack.units[0];
  const navigate = (target: Exclude<Screen, 'battle' | 'result' | 'review'>) => { if (screen === 'battle') { setLeave(true); } else game.navigate(target); };
  const openReview = () => { if (screen === 'battle') setLeave(true); else game.startReview(); };
  const title: Record<Screen, string> = { home: '我的森林小屋', map: '展開自然的冒險', battle: battle?.unit.name ?? '自然挑戰', result: result?.won ? '好奇心，讓你更強大！' : '每次探索，都有新發現', shop: '森林裡的小商店', decor: '佈置我的小屋', wardrobe: '穿上喜歡的自己', dex: '自然知識圖鑑', review: '複習小徑', achievements: '每一份努力，都值得收藏', parent: '陪孩子，把好奇心養大' };
  return <div className={`app-shell ${largeText ? 'large-text' : ''}`}>
    <aside className="sidebar"><Brand /><div className="sidebar-label">我的探險日常</div><nav aria-label="主要導覽"><button aria-label="我的小屋" className={screen === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={19} />我的小屋<span className="nav-dot" /></button><button aria-label="冒險地圖" className={screen === 'map' || screen === 'battle' || screen === 'result' ? 'active' : ''} onClick={() => navigate('map')}><Compass size={19} />冒險地圖<ChevronRight size={16} /></button><button aria-label="森林商店" className={screen === 'shop' ? 'active' : ''} onClick={() => navigate('shop')}><ShoppingBag size={19} />森林商店<ChevronRight size={16} /></button><button aria-label="小屋佈置" className={screen === 'decor' ? 'active' : ''} onClick={() => navigate('decor')}><Armchair size={19} />小屋佈置<ChevronRight size={16} /></button><button aria-label="我的衣櫃" className={screen === 'wardrobe' ? 'active' : ''} onClick={() => navigate('wardrobe')}><Sparkles size={19} />我的衣櫃<ChevronRight size={16} /></button></nav>
      <nav className="learning-nav" aria-label="學習導覽"><button aria-label="自然圖鑑" className={screen === 'dex' ? 'active' : ''} onClick={() => navigate('dex')}><BookOpen size={18} />自然圖鑑<ChevronRight size={15} /></button><button aria-label="複習小徑" className={screen === 'review' ? 'active' : ''} onClick={openReview}><Leaf size={18} />複習小徑<ChevronRight size={15} /></button><button aria-label="探險成就" className={screen === 'achievements' ? 'active' : ''} onClick={() => navigate('achievements')}><Trophy size={18} />探險成就<ChevronRight size={15} /></button></nav>
      <div className="side-bottom"><div className="seed-card"><Leaf size={25} /><b>每天一點好奇心</b><p>大大的世界，<br />藏在小小的問題裡。</p></div><button className="help-button" onClick={() => setHelp(true)}><CircleHelp size={17} />探險指南</button><span className="version">學習冒險 · 開發預覽 0.6</span></div>
    </aside>
    <main className="main-area"><header className="topbar"><span className="breadcrumb">我的世界 <ChevronRight size={13} /> <b>{screen === 'home' ? '森林小屋' : screen === 'map' ? '冒險地圖' : screen === 'battle' ? '自然挑戰' : screen === 'shop' ? '森林商店' : screen === 'decor' ? '小屋佈置' : screen === 'wardrobe' ? '我的衣櫃' : screen === 'dex' ? '自然圖鑑' : screen === 'review' ? '複習小徑' : screen === 'achievements' ? '探險成就' : screen === 'parent' ? '家長模式' : '冒險回顧'}</b></span><div className="player-badges"><span className="coin-badge"><Coins size={18} /> <b data-testid="coins">{player.coins}</b><small>金幣</small></span><span className="profile-avatar">小</span><div><b>小小探險家</b><span>Lv. {level} 自然學徒</span></div></div></header>
      {game.warning && <div className="warning" role="alert">{game.warning}<button aria-label="關閉提醒" onClick={game.dismissWarning}><X size={16} /></button></div>}
      {game.notice && <div className="game-notice" role="status">{game.notice}</div>}
      <div className="utility-bar"><OfflineStatus /><button onClick={() => setSettings(true)}>閱讀與音效</button><button onClick={() => { if (screen === 'battle') setLeave(true); else setParentGate(true); }}>家長模式</button></div><AchievementNotice /><div className="page-content"><div className="page-heading"><div><Badge><span />{screen === 'home' ? 'A LITTLE HOME, A BIG ADVENTURE' : screen === 'map' ? 'LET YOUR CURIOSITY LEAD THE WAY' : screen === 'shop' ? 'LITTLE TREASURES, LOVELY MEMORIES' : screen === 'decor' ? 'MAKE ROOM FOR LITTLE JOYS' : screen === 'wardrobe' ? 'A STYLE THAT FEELS LIKE YOU' : 'GROW WITH EVERY DISCOVERY'}</Badge><h1>{title[screen]}</h1><p>{screen === 'home' ? '歡迎回家，探險家。今天想發現什麼新鮮事？' : screen === 'map' ? '從一片葉子開始，一步步解開自然的祕密。' : screen === 'battle' ? '仔細想一想，用知識守護這片森林。' : screen === 'shop' ? '把冒險的收穫，變成一份喜歡的小收藏。' : screen === 'decor' ? '一桌一椅，慢慢拼出你喜歡的小天地。' : screen === 'wardrobe' ? '每件小收藏，都讓冒險多一點自己的樣子。' : screen === 'parent' ? '陪伴學習，備份每一次成長。' : '把新學到的知識，裝進你的探險背包。'}</p></div><div className={`save-indicator ${game.saveStatus}`}><span />{game.saveStatus === 'saved' ? '進度已儲存' : game.saveStatus === 'pending' ? '正在儲存…' : '存檔需協助'}</div></div>
      {screen === 'parent' && <Parent />}
      {screen === 'shop' && <Shop />}
      {screen === 'decor' && <Decor />}
      {screen === 'wardrobe' && <Wardrobe />}
      {screen === 'dex' && <Dex />}
      {screen === 'review' && <Review />}
      {screen === 'achievements' && <Achievements />}
      {screen === 'home' && <>
        <div className="home-grid"><section className="scene-card home-scene"><div className="scene-label"><Home size={16} /><span>森林裡的一隅</span><i>我的小屋</i></div><World3D mode="home" player={player} units={pack.units} items={pack.items} models={pack.outfitModels} /><div className="scene-caption"><span><span className="sun-dot" />晴朗 · 適合探險的一天</span><span><Maximize2 size={13} />拖曳旋轉 · 滾動縮放</span></div></section>
        <aside className="adventure-panel"><div className="panel-top"><span className="small-icon"><Compass size={22} /></span><span>下一站，去探索</span></div><Badge>{pack.manifest.subject}探險 · {pack.manifest.grade} 年級</Badge><h2>{next.name}</h2><p>森林的守護者正在等你，<br />帶上好奇心，一起出發吧！</p><div className="mini-landscape"><Sprout size={54} strokeWidth={1} /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><Leaf size={20} className="floating-leaf" /></div><div className="panel-meta"><span><BookOpen size={15} />每場最多 10 道挑戰</span><span><Coins size={15} />通關賺金幣</span></div><button className="primary" onClick={() => game.navigate('map')}>開始冒險<ArrowRight size={18} /></button><span className="panel-note">不怕答錯，每一次都是學習。</span></aside></div>
        <div className="home-collection"><span><Trophy size={20} /><b>{furnitureStats.title}</b></span><p>家具收藏 {furnitureStats.owned} / {furnitureStats.total} · 已擺放 {furnitureStats.placed} 件</p><button onClick={() => game.navigate('decor')}><Armchair size={17} />佈置小屋<ArrowRight size={15} /></button><button onClick={() => game.navigate('wardrobe')}><Sparkles size={17} />我的衣櫃</button></div>
        <div className="section-heading"><h2>一點一滴，都是成長</h2><span>你的探險足跡</span></div><div className="stats-grid"><Stat icon={<Mountain size={22} />} label="探索的單元" value={`${player.clearedUnitIds.length}`} suffix={`/ ${pack.units.length}`} note="每一站都有新發現" /><Stat icon={<Check size={22} />} label="答對的問題" value={`${player.stats.correct}`} suffix="題" note="知識正在悄悄發芽" /><Stat icon={<Star size={22} />} label="收集的星星" value={`${Object.values(player.unitStars).reduce((a, b) => a + b, 0)}`} suffix="顆" note="留給努力的你" /></div>
        <div className="learning-shortcuts"><button onClick={() => game.navigate('dex')}><BookOpen size={19} /><b>自然圖鑑</b><span>收藏冒險裡的知識</span></button><button onClick={openReview}><Leaf size={19} /><b>複習小徑</b><span>{player.wrongQuestionIds.length} 題等待再探索</span></button><button onClick={() => game.navigate('achievements')}><Trophy size={19} /><b>探險成就</b><span>{player.unlockedAchievementIds.length} 項努力已被記下</span></button></div><div className="tip-strip"><span><Leaf size={19} /></span><p><b>森林小知識</b>植物的葉片就像小小的廚房，利用陽光製造生長需要的養分。</p><span>保持好奇 <Sparkles size={15} /></span></div>
      </>}
      {screen === 'map' && <><button className="review-entry" onClick={openReview}><Leaf size={23} /><span><b>複習小徑</b><small>{player.wrongQuestionIds.length ? `還有 ${player.wrongQuestionIds.length} 題，等你再想一想` : '錯題都複習好了，真棒！'}</small></span><ArrowRight size={18} /></button><section className="scene-card map-scene"><div className="scene-label"><Compass size={16} /><span>自然探險群島</span><i>{player.clearedUnitIds.length} / {pack.units.length} 已探索</i></div><World3D mode="map" player={player} units={pack.units} onSelect={game.startBattle} /><div className="scene-caption"><span>循著好奇心，一站一站前進</span><span>拖曳可旋轉 3D 地圖</span></div></section><div className="unit-grid">{pack.units.map((unit, i) => { const unlocked = isUnlocked(unit, player.clearedUnitIds); const Icon = icons[i % icons.length]; return <button key={unit.id} className={`unit-card ${unlocked ? '' : 'locked'}`} disabled={!unlocked} onClick={() => game.startBattle(unit.id)}><span className="unit-number">0{i + 1}</span><span className="unit-icon"><Icon size={26} /></span><h2>{unit.name}</h2><p>{unit.boss.name}</p><div className="unit-stars">{[1, 2, 3].map(n => <Star key={n} size={15} fill={(player.unitStars[unit.id] ?? 0) >= n ? 'currentColor' : 'none'} />)}</div><span className="unit-action">{unlocked ? <>進入挑戰<ArrowRight size={15} /></> : <><LockKeyhole size={14} />通過前一關解鎖</>}</span></button>; })}</div></>}
      {screen === 'battle' && battle && <div className="battle-layout"><section className="scene-card battle-scene"><div className="battle-health"><Meter value={battle.playerHp} max={battle.playerMaxHp} label={`探險家 Lv.${battle.level}`} /><span className="versus">VS</span><Meter value={battle.bossHp} max={battle.unit.boss.hp} label={battle.unit.boss.name} boss /></div><World3D mode="battle" player={player} units={pack.units} items={pack.items} models={pack.outfitModels} unit={battle.unit} hit={!!battle.feedback?.correct} /><div className="scene-caption"><span><Heart size={14} />外觀不影響戰鬥能力</span><button onClick={() => setLeave(true)}><ArrowLeft size={14} />返回地圖</button></div>{battle.feedback && <div className={`damage-pop ${battle.feedback.correct ? '' : 'miss'}`}>{battle.feedback.critical ? '爆擊！' : battle.feedback.correct ? '知識的力量' : '再想一想'} −{battle.feedback.damage}</div>}</section>
        <section className="question-card" aria-label="答題挑戰"><div className="question-meta"><Badge>知識挑戰</Badge><span>第 {battle.index + 1} / {battle.questions.length} 題</span></div><div className="question-dots">{battle.questions.map((q, i) => <span key={q.id} className={i < battle.index ? 'done' : i === battle.index ? 'current' : ''} />)}</div><button className="potion-button" disabled={player.potions === 0 || battle.playerHp === battle.playerMaxHp || !!battle.feedback || !!battle.outcome} onClick={game.usePotion}><FlaskConical size={17} />使用藥水（{player.potions} 瓶）<small>回復 50 HP</small></button><h2 data-stem={battle.questions[battle.index].stem}><QuestionStem question={battle.questions[battle.index]} /></h2><div className="answers">{battle.questions[battle.index].options.map((answer, i) => <button key={`${battle.index}-${i}`} disabled={!!battle.feedback} className={battle.feedback ? i === battle.questions[battle.index].answerIndex ? 'correct' : i === battle.feedback.choice ? 'incorrect' : '' : ''} onClick={() => game.answer(i)}><span>{String.fromCharCode(65 + i)}</span>{answer}{battle.feedback && i === battle.questions[battle.index].answerIndex && <Check size={18} />}</button>)}</div>
          {battle.feedback ? <div className={`feedback ${battle.feedback.correct ? '' : 'wrong'}`} role="status"><b>{battle.feedback.correct ? '答對了，做得好！' : '沒關係，一起學起來！'}</b><p>{battle.questions[battle.index].explanation}</p><button className="primary" onClick={game.nextTurn}>{battle.outcome ? '看看冒險成果' : '繼續挑戰'}<ArrowRight size={17} /></button></div> : <p className="question-hint"><CircleHelp size={15} />慢慢想，沒有時間限制。</p>}
        </section></div>}
      {screen === 'result' && <Results />}
      <footer><span><Sprout size={14} />讓學習，成為一場喜歡的冒險。</span><span>{pack.manifest.grade} 年級{pack.manifest.subject} · {pack.manifest.demo ? '示範內容包' : pack.manifest.name}</span></footer></div>
    </main>
    {parentGate && <ParentGate onClose={() => setParentGate(false)} onVerified={() => { setParentGate(false); game.authorizeParent(); }} />}
    {settings && <PreferencesPanel onClose={() => setSettings(false)} />}
    {help && <Dialog title="給小小探險家的指南" onClose={() => setHelp(false)}><p>從冒險地圖選擇已解鎖的單元。每次挑戰最多 10 題，答對能攻擊守護者，答錯會顯示解析並記錄錯題。</p><p>通關可獲得金幣、經驗、星星和一至兩件道具。重複裝扮及已滿九件的家具轉換成 30 金幣；獎勵自動入庫，不必擔心忘記開箱。</p><p>商店可購買家具、服裝或 HP 藥水。小屋佈置中可拖曳、旋轉、移動及收回家具，地毯可墊在桌椅下方。到衣櫃換上已收藏的裝扮，也可以先在商店試穿。</p><p>通關可解鎖知識圖鑑；複習小徑答對可移除錯題並得 2 金幣；成就達成後獎勵自動入帳。拖曳可旋轉 3D 場景，佈置時視角固定。進度會自動存在此瀏覽器；清除網站資料會刪除進度。</p><button className="primary" onClick={() => setHelp(false)}>準備好了<Check size={17} /></button></Dialog>}
    {leave && <Dialog title="要先回地圖休息嗎？" onClose={() => setLeave(false)}><p>這場挑戰尚未結算的金幣不會發放，已答題的經驗與錯題紀錄會保留。</p><button className="primary" onClick={() => { setLeave(false); game.navigate('map'); }}>回到地圖<RotateCcw size={17} /></button><button className="text-button" onClick={() => setLeave(false)}>繼續挑戰</button></Dialog>}
  </div>;
}
function Stat({ icon, label, value, suffix, note }: { icon: ReactNode; label: string; value: string; suffix: string; note: string }) { return <section className="stat-card"><span className="stat-icon">{icon}</span><div><span>{label}</span><p><b>{value}</b><small>{suffix}</small></p><span className="stat-note">{note}</span></div></section>; }
