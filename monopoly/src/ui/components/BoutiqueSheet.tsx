import { useEffect, useState } from 'react';
import { useApp, useMe } from '../../store/appStore';
import {
  SLOT_NAME,
  SLOT_ORDER,
  TIER_NAME,
  getItem,
  itemsInSlot,
  outfitTier,
  type Slot,
} from '../../game/wardrobe';
import { money } from '../../game/money';
import { act } from '../../net/bridge';
import { Sheet } from './Shell';
import { Critter } from './Critter';
import { tap } from '../../lib/feedback';

/**
 * Бутик.
 *
 * Открыт в любой момент партии, не только в свой ход: наряд ни на что в
 * правилах не влияет. Цены подобраны так, что легендарные вещи по карману
 * только к концу большой партии — отсюда и «по мере богатства».
 *
 * Купленное запоминается в профиле и переносится в следующие партии.
 */
export function BoutiqueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const me = useMe();
  const rememberOutfit = useApp((s) => s.rememberOutfit);
  const [slot, setSlot] = useState<Slot>('head');

  /* Покупки переживают партию — сохраняем их в профиль устройства. */
  useEffect(() => {
    if (!me) return;
    rememberOutfit(me.outfit, me.wardrobe);
  }, [me?.outfit, me?.wardrobe, me, rememberOutfit]);

  if (!me) return null;

  const items = itemsInSlot(slot);
  const worn = me.outfit[slot];
  const shine = outfitTier(me.outfit);

  return (
    <Sheet open={open} onClose={onClose} title="🛍️ Бутик">
      <div className="stack">
        <div className="card row" style={{ gap: 14, alignItems: 'center' }}>
          <div className="boutique-preview">
            <Critter
              characterId={me.character}
              outfit={me.outfit}
              accent={me.color}
              size={96}
            />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 760, fontSize: 15 }}>{me.name}</div>
            <div className="mono" style={{ color: 'var(--gold)', fontWeight: 800, marginTop: 2 }}>
              {money(me.money)}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {shine === 0
                ? 'Пока без единой вещи.'
                : shine < 5
                  ? 'Начало положено.'
                  : shine < 11
                    ? 'Выглядит солидно.'
                    : 'Ходячее состояние.'}
            </div>
          </div>
        </div>

        <div className="wrap">
          {SLOT_ORDER.map((s) => (
            <button
              key={s}
              className={`chip ${slot === s ? 'on' : ''}`}
              onClick={() => {
                tap();
                setSlot(s);
              }}
            >
              {SLOT_NAME[s]}
              {me.outfit[s] ? ' •' : ''}
            </button>
          ))}
        </div>

        {worn && (
          <button
            className="btn block small"
            onClick={() => {
              tap();
              act(me.id, { t: 'wear', slot, itemId: null });
            }}
          >
            Снять {getItem(worn)?.name.toLowerCase()}
          </button>
        )}

        {items.map((item) => {
          const owned = me.wardrobe.includes(item.id);
          const on = worn === item.id;
          const affordable = owned || me.money >= item.price;

          return (
            <button
              key={item.id}
              className={`shop-row ${on ? 'on' : ''} ${affordable ? '' : 'dim'}`}
              disabled={!affordable}
              onClick={() => {
                tap('select');
                act(me.id, { t: 'wear', slot, itemId: item.id });
              }}
            >
              <span className="shop-figure">
                <Critter
                  characterId={me.character}
                  outfit={{ [item.slot]: item.id }}
                  accent={me.color}
                  size={46}
                  animate={false}
                />
              </span>
              <span className="grow" style={{ textAlign: 'left', minWidth: 0 }}>
                <span className="shop-name">
                  {item.name}
                  <i className={`tier tier-${item.tier}`}>{TIER_NAME[item.tier]}</i>
                </span>
                <span className="shop-note">{item.note}</span>
              </span>
              <span className="shop-price mono">
                {on ? 'надето' : owned ? 'надеть' : money(item.price)}
              </span>
            </button>
          );
        })}

        <p className="muted" style={{ fontSize: 12 }}>
          Наряд — только внешний вид: на аренду, стройку и счёт он не влияет.
          Купленное останется с вами и в следующих партиях.
        </p>
      </div>
    </Sheet>
  );
}
