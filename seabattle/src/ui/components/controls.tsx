import { tap } from '../../lib/feedback';

export function Toggle({
  emoji,
  label,
  hint,
  value,
  onChange,
}: {
  emoji: string;
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      className="toggle-row"
      style={{ background: 'none', border: 0, padding: 0, width: '100%', textAlign: 'left' }}
      onClick={() => {
        tap();
        onChange(!value);
      }}
    >
      <span style={{ fontSize: 20, width: 26, flex: 'none' }}>{emoji}</span>
      <span className="grow">
        <span className="setting-label" style={{ display: 'block' }}>
          {label}
        </span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className={`switch ${value ? 'on' : ''}`}>
        <span />
      </span>
    </button>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; emoji?: string }[];
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'on' : ''}
          onClick={() => {
            tap('select');
            onChange(o.value);
          }}
        >
          {o.emoji && <span>{o.emoji}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Stepper({
  emoji,
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  format,
}: {
  emoji: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="toggle-row">
      <span style={{ fontSize: 20, width: 26, flex: 'none' }}>{emoji}</span>
      <span className="grow setting-label">{label}</span>
      <div className="stepper">
        <button
          onClick={() => {
            tap();
            onChange(clamp(value - step));
          }}
          disabled={value <= min}
        >
          −
        </button>
        <span className="value mono">{format ? format(value) : value}</span>
        <button
          onClick={() => {
            tap();
            onChange(clamp(value + step));
          }}
          disabled={value >= max}
        >
          +
        </button>
      </div>
    </div>
  );
}
