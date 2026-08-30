/**
 * Деньги в рублях.
 *
 * Номиналы взяты из классической игры и умножены на тысячу — так суммы
 * звучат по-настоящему. Чтобы длинные числа не разваливали вёрстку,
 * миллионы показываем сокращённо.
 */

const NBSP = ' ';

/** 1 500 000 → «1,5 млн ₽», 600 000 → «600 000 ₽». */
export function money(value: number): string {
  const sign = value < 0 ? '−' : '';
  const abs = Math.abs(Math.round(value));

  if (abs >= 1_000_000) {
    const millions = abs / 1_000_000;
    const text = millions >= 10 ? millions.toFixed(1) : millions.toFixed(2);
    const trimmed = text.replace(/\.?0+$/, '').replace('.', ',');
    return `${sign}${trimmed}${NBSP}млн${NBSP}₽`;
  }

  return `${sign}${group(abs)}${NBSP}₽`;
}

/** Компактно для клетки на доске: 600 000 → «600к». */
export function moneyShort(value: number): string {
  const abs = Math.abs(Math.round(value));
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${(m >= 10 ? m.toFixed(0) : m.toFixed(1)).replace('.', ',').replace(/,0$/, '')}м`;
  }
  if (abs >= 1000) return `${Math.round(abs / 1000)}к`;
  return String(abs);
}

/** Со знаком — для всплывающих изменений баланса. */
export function moneyDelta(value: number): string {
  return `${value > 0 ? '+' : ''}${money(value)}`;
}

function group(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
}
