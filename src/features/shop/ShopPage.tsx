import { useState } from 'react';
import { LuCoins, LuLock } from 'react-icons/lu';
import { useAppState, useDispatch } from '../../app/store';
import { getAchievement } from '../../domain/achievements';
import { CATALOG, getItem, REQUIRED_SLOTS, SHOP_CATEGORIES, type CosmeticItem, type ShopCategory } from '../../domain/catalog';
import { Tabs } from '../../components/ui';
import { useGame } from '../../hooks/useGame';
import { integer } from '../../utils/format';
import { CharacterPreview } from '../mountain/CharacterPreview';
import { ScenePreview } from '../mountain/ScenePreview';

function unlockLabel(item: CosmeticItem, coinName: string): string {
  const u = item.unlock;
  if (u.type === 'default') return 'Gratuito';
  if (u.type === 'coins') return `${integer(u.price)} ${coinName}`;
  if (u.type === 'level') return `Nível ${u.level}`;
  return `Conquista: ${getAchievement(u.code)?.title ?? u.code}`;
}

export function ShopPage() {
  const state = useAppState();
  const dispatch = useDispatch();
  const g = useGame();
  const [cat, setCat] = useState<ShopCategory>('personagem');
  const [selected, setSelected] = useState<string>(state.equipped.body ?? 'body-classic');
  const item = getItem(selected) ?? CATALOG[0];
  const owned = state.inventory.some((i) => i.itemId === item.id);
  const equipped = state.equipped[item.slot] === item.id;
  const preview = { ...state.equipped, [item.slot]: item.id };
  const canBuy = item.unlock.type === 'coins' && !owned;
  const affordable = item.unlock.type === 'coins' && g.coins >= item.unlock.price;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Loja de skins</h1>
          <p>Itens exclusivamente cosméticos — não compram progresso nem alteram indicadores.</p>
        </div>
        <span className="pill-stat" style={{ fontSize: 'var(--t-md)' }}><LuCoins aria-hidden="true" /> {integer(g.coins)} {g.coinName}</span>
      </header>
      <div className="shop">
        <div>
          <Tabs value={cat} onChange={setCat} label="Categorias da loja" options={SHOP_CATEGORIES.map((c) => ({ value: c.id, label: c.label }))} />
          <div className="items">
            {CATALOG.filter((i) => i.category === cat).map((i) => {
              const has = state.inventory.some((x) => x.itemId === i.id);
              const on = state.equipped[i.slot] === i.id;
              return (
                <div key={i.id} className={`item ${selected === i.id ? 'is-selected' : ''} ${on ? 'is-equipped' : ''}`}>
                  {i.slot === 'scene' ? <div className="item__scene"><ScenePreview id={i.id} /></div> : <CharacterPreview look={{ ...state.equipped, [i.slot]: i.id }} size={84} animate={false} />}
                  <h3>{i.name}</h3>
                  {i.collection && <span className="item__collection">{i.collection}</span>}
                  <small>{has ? (on ? 'Equipado' : 'No inventário') : <>{i.unlock.type !== 'coins' && <LuLock aria-hidden="true" style={{ display: 'inline', width: 12, height: 12, verticalAlign: -2 }} />} {unlockLabel(i, g.coinName)}</>}</small>
                  <button type="button" className="item__select" aria-label={`Ver ${i.name}`} aria-pressed={selected === i.id} onClick={() => setSelected(i.id)} />
                </div>
              );
            })}
          </div>
        </div>
        <aside className="card shop__preview" aria-labelledby="prev-h">
          <div className="card__head"><h2 id="prev-h">Prévia</h2></div>
          {item.slot === 'scene' ? (
            <div className="stage stage--scene"><ScenePreview id={item.id} label={`Prévia do cenário ${item.name}`} /></div>
          ) : (
            <div className="stage">
              <CharacterPreview look={preview} mode={item.slot === 'fx' ? 'celebrate' : 'walk'} size={170} label={`Prévia do personagem com ${item.name}`} />
            </div>
          )}
          <h3 style={{ marginTop: 14, fontSize: 'var(--t-xl)' }}>{item.name}</h3>
          {item.collection && <p className="xs muted strong" style={{ margin: '2px 0 0' }}>Coleção {item.collection}</p>}
          <p className="muted small" style={{ margin: '4px 0 12px' }}>{item.description}</p>
          <p className="small strong" style={{ marginBottom: 12 }}>{owned ? 'Você possui este item' : unlockLabel(item, g.coinName)}</p>
          <div className="stack" style={{ gap: 8 }}>
            {owned && !equipped && <button className="btn btn--primary btn--block" onClick={() => dispatch({ type: 'shop/equip', itemId: item.id })}>Equipar</button>}
            {owned && equipped && !REQUIRED_SLOTS.includes(item.slot) && <button className="btn btn--block" onClick={() => dispatch({ type: 'shop/unequip', slot: item.slot })}>Desequipar</button>}
            {owned && equipped && REQUIRED_SLOTS.includes(item.slot) && <p className="xs muted">Visual base em uso.</p>}
            {canBuy && (
              <button className="btn btn--primary btn--block" disabled={!affordable} onClick={() => dispatch({ type: 'shop/buy', itemId: item.id })}>
                {affordable ? `Comprar por ${integer(item.unlock.type === 'coins' ? item.unlock.price : 0)}` : `Faltam ${integer((item.unlock.type === 'coins' ? item.unlock.price : 0) - g.coins)} ${g.coinName}`}
              </button>
            )}
            {!owned && item.unlock.type !== 'coins' && <p className="note small"><LuLock /> Desbloqueado automaticamente ao atingir: {unlockLabel(item, g.coinName).toLowerCase()}.</p>}
          </div>
          <h3 className="small muted" style={{ margin: '18px 0 8px' }}>Inventário ({state.inventory.length})</h3>
          <div className="row">
            {state.inventory.map((i) => {
              const it = getItem(i.itemId);
              return it ? <button key={i.itemId} type="button" className={`chip ${state.equipped[it.slot] === it.id ? 'chip--solid' : ''}`} onClick={() => { setCat(it.category); setSelected(it.id); }}>{it.name}</button> : null;
            })}
          </div>
        </aside>
      </div>
    </>
  );
}
