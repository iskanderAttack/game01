import type { ReactNode } from 'react';
import { tap } from '../../lib/feedback';

export function Toggle({
  label,
  hint,
  value,
  onChange,
  emoji,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  emoji?: string;
}) {
  return (
    <button
      className="setting-row"
      onClick={() => {
        tap('select');
        onChange(!value);
      }}
    >
      {emoji && <span className="setting-emoji">{emoji}</span>}
      <span className="grow" style={{ textAlign: 'left' }}>
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <span className={`switch ${value ? 'on' : ''}`}>
        <i />
      </span>
    </button>
  );
}

export function Stepper({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
  emoji,
  format,
}: {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (v: number) => void;
  emoji?: string;
  format?: (v: number) => string;
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v * 100) / 100));
  return (
    <div className="setting-row static">
      {emoji && <span className="setting-emoji">{emoji}</span>}
      <span className="grow">
        <span className="setting-label">{label}</span>
        {hint && <span className="setting-hint">{hint}</span>}
      </span>
      <div className="stepper">
        <button
          onClick={() => {
            tap();
            onChange(clamp(value - step));
          }}
          disabled={value <= min}
          aria-label="Меньше"
        >
          −
        </button>
        <span className="mono stepper-value">{format ? format(value) : `${value}${suffix ?? ''}`}</span>
        <button
          onClick={() => {
            tap();
            onChange(clamp(value + step));
          }}
          disabled={value >= max}
          aria-label="Больше"
        >
          +
        </button>
      </div>
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  emoji?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={o.value === value ? 'on' : ''}
          onClick={() => {
            tap('select');
            onChange(o.value);
          }}
        >
          {o.emoji && <span style={{ marginRight: 6 }}>{o.emoji}</span>}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function StatTile({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="stat-tile">
      <div className="stat-value mono" style={accent ? { color: accent } : undefined}>
        {value}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
