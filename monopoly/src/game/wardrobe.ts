/**
 * Гардероб фигурок.
 *
 * Одна и та же вещь существует в четырёх ступенях статуса: бейсболка растёт
 * до короны, сумка — до золотого кейса. Точки крепления у всех зверей общие,
 * поэтому любая вещь надевается на любую фигурку.
 *
 * На правила игры гардероб не влияет вообще: это только внешний вид.
 */

export type Slot = 'head' | 'eyes' | 'neck' | 'torso' | 'hand';

export interface WardrobeItem {
  id: string;
  slot: Slot;
  name: string;
  /** 1 — обычная вещь, 4 — легендарная. */
  tier: 1 | 2 | 3 | 4;
  price: number;
  /** Чем вещь хороша — короткая подпись в бутике. */
  note: string;
}

const K = 1000;

/** Цена ступени. Легендарное по карману только к концу большой партии. */
const TIER_PRICE: Record<1 | 2 | 3 | 4, number> = {
  1: 80 * K,
  2: 250 * K,
  3: 600 * K,
  4: 1500 * K,
};

export const TIER_NAME: Record<1 | 2 | 3 | 4, string> = {
  1: 'обычная',
  2: 'статусная',
  3: 'люксовая',
  4: 'легендарная',
};

const item = (
  id: string,
  slot: Slot,
  name: string,
  tier: 1 | 2 | 3 | 4,
  note: string,
): WardrobeItem => ({ id, slot, name, tier, price: TIER_PRICE[tier], note });

export const WARDROBE: WardrobeItem[] = [
  item('cap', 'head', 'Бейсболка', 1, 'С неё начинают все'),
  item('hat', 'head', 'Шляпа', 2, 'Уже похоже на человека при деньгах'),
  item('tophat', 'head', 'Цилиндр', 3, 'Классика жанра'),
  item('crown', 'head', 'Корона', 4, 'Спорить с владельцем бесполезно'),

  item('glasses', 'eyes', 'Очки', 1, 'Для вдумчивых сделок'),
  item('shades', 'eyes', 'Солнечные очки', 2, 'Ставку по лицу не прочитать'),
  item('aviators', 'eyes', 'Авиаторы', 3, 'Золотая оправа'),
  item('monocle', 'eyes', 'Монокль', 4, 'Смотрит сверху вниз по определению'),

  item('scarf', 'neck', 'Шарф', 1, 'Тепло и просто'),
  item('tie', 'neck', 'Галстук', 2, 'Переговорный минимум'),
  item('bowtie', 'neck', 'Бабочка', 3, 'Вечер перестаёт быть томным'),
  item('medal', 'neck', 'Орден', 4, 'За выдающиеся заслуги перед банком'),

  item('vest', 'torso', 'Жилет', 1, 'Рабочая одежда'),
  item('shirt', 'torso', 'Рубашка', 2, 'Опрятно и по делу'),
  item('suit', 'torso', 'Костюм', 3, 'В таком не отказывают'),
  item('fur', 'torso', 'Шуба', 4, 'Отопление больше не нужно'),

  item('bag', 'hand', 'Сумка', 1, 'Куда-то надо складывать наличные'),
  item('briefcase', 'hand', 'Портфель', 2, 'Документы всегда с собой'),
  item('diplomat', 'hand', 'Дипломат', 3, 'Кодовый замок'),
  item('goldcase', 'hand', 'Золотой кейс', 4, 'Содержимое обсуждению не подлежит'),
];

export const SLOT_NAME: Record<Slot, string> = {
  head: 'Голова',
  eyes: 'Глаза',
  neck: 'Шея',
  torso: 'Одежда',
  hand: 'В руке',
};

export const SLOT_ORDER: Slot[] = ['head', 'eyes', 'neck', 'torso', 'hand'];

/** Что надето: слот → id вещи. Пустой слот — вещи нет. */
export type Outfit = Partial<Record<Slot, string>>;

export function getItem(id: string | undefined): WardrobeItem | null {
  if (!id) return null;
  return WARDROBE.find((i) => i.id === id) ?? null;
}

export function itemsInSlot(slot: Slot): WardrobeItem[] {
  return WARDROBE.filter((i) => i.slot === slot);
}

/** Суммарный «уровень шика» — по нему бутик хвалит игрока. */
export function outfitTier(outfit: Outfit): number {
  return SLOT_ORDER.reduce((sum, slot) => sum + (getItem(outfit[slot])?.tier ?? 0), 0);
}
