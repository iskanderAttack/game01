import { ABILITIES } from '../../game/abilities';
import { tap } from '../../lib/feedback';

/** Значок энергии: только молния и число — точки не помещались на телефон. */
export function EnergyBar({ energy }: { energy: number }) {
  return (
    <div className="energy-bar">
      <span>⚡</span>
      <span className="mono">{energy}</span>
    </div>
  );
}

export function AbilityBar({
  energy,
  selected,
  onSelect,
  disabled,
}: {
  energy: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="ability-bar">
      {ABILITIES.map((a) => {
        const affordable = energy >= a.cost;
        return (
          <button
            key={a.id}
            className={`ability-btn ${selected === a.id ? 'on' : ''}`}
            disabled={disabled || !affordable}
            onClick={() => {
              tap('select');
              onSelect(selected === a.id ? null : a.id);
            }}
          >
            <div className="ability-emoji">{a.emoji}</div>
            <div className="ability-name">{a.name}</div>
            <div className="ability-cost mono">{a.cost}⚡</div>
          </button>
        );
      })}
    </div>
  );
}
