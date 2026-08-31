/**
 * Зверушки, которыми ходят по доске.
 *
 * Каждая фигурка — не картинка, а набор параметров: силуэт тела, форма ушей,
 * морда, хвост и палитра. Рисует их `Critter`, поэтому одежда и аксессуары
 * крепятся к одним и тем же точкам у всех зверей и надеваются на любого.
 */

export type EarShape = 'round' | 'pointy' | 'long' | 'tuft' | 'flat' | 'horn';
export type MuzzleShape = 'short' | 'wide' | 'beak' | 'long';
export type TailShape = 'bushy' | 'thin' | 'round' | 'none';

export interface Character {
  id: string;
  name: string;
  emoji: string;
  /** Основной цвет шерсти. */
  body: string;
  /** Тень на теле — нижняя часть градиента. */
  shade: string;
  /** Живот, морда и внутренняя часть ушей. */
  belly: string;
  ear: EarShape;
  muzzle: MuzzleShape;
  tail: TailShape;
  /** Цвет носа и подушечек. */
  nose: string;
  /** Фирменный цвет игрока по умолчанию. */
  accent: string;
}

export const CHARACTERS: Character[] = [
  {
    id: 'fox',
    name: 'Лис',
    emoji: '🦊',
    body: '#E8823C',
    shade: '#C4622A',
    belly: '#FCEBD8',
    ear: 'pointy',
    muzzle: 'long',
    tail: 'bushy',
    nose: '#3B2B22',
    accent: '#E8823C',
  },
  {
    id: 'bear',
    name: 'Медведь',
    emoji: '🐻',
    body: '#A4713F',
    shade: '#7E5326',
    belly: '#E8CFA8',
    ear: 'round',
    muzzle: 'wide',
    tail: 'round',
    nose: '#3B2B22',
    accent: '#C08A4E',
  },
  {
    id: 'panda',
    name: 'Панда',
    emoji: '🐼',
    body: '#F3F1EC',
    shade: '#CFCBC2',
    belly: '#FFFFFF',
    ear: 'round',
    muzzle: 'wide',
    tail: 'round',
    nose: '#2C2C2C',
    accent: '#9AA3B2',
  },
  {
    id: 'cat',
    name: 'Кот',
    emoji: '🐱',
    body: '#9BA6B8',
    shade: '#76808F',
    belly: '#EDF1F6',
    ear: 'pointy',
    muzzle: 'short',
    tail: 'thin',
    nose: '#E58A9B',
    accent: '#9BA6B8',
  },
  {
    id: 'hare',
    name: 'Заяц',
    emoji: '🐰',
    body: '#D8CFC4',
    shade: '#B0A597',
    belly: '#FBF7F1',
    ear: 'long',
    muzzle: 'short',
    tail: 'round',
    nose: '#E58A9B',
    accent: '#D8CFC4',
  },
  {
    id: 'penguin',
    name: 'Пингвин',
    emoji: '🐧',
    body: '#2E3A50',
    shade: '#1C2537',
    belly: '#F7F4EC',
    ear: 'flat',
    muzzle: 'beak',
    tail: 'none',
    nose: '#F0A83C',
    accent: '#5B7BA8',
  },
  {
    id: 'frog',
    name: 'Лягушка',
    emoji: '🐸',
    body: '#5FB25A',
    shade: '#3E8C3C',
    belly: '#E6F3D8',
    ear: 'flat',
    muzzle: 'wide',
    tail: 'none',
    nose: '#2F6B2E',
    accent: '#5FB25A',
  },
  {
    id: 'owl',
    name: 'Сова',
    emoji: '🦉',
    body: '#8A7256',
    shade: '#65523C',
    belly: '#E4D6BE',
    ear: 'tuft',
    muzzle: 'beak',
    tail: 'none',
    nose: '#E8A93C',
    accent: '#B99A6E',
  },
  {
    id: 'wolf',
    name: 'Волк',
    emoji: '🐺',
    body: '#6E7789',
    shade: '#4E5567',
    belly: '#DCE2EA',
    ear: 'pointy',
    muzzle: 'long',
    tail: 'bushy',
    nose: '#2C2C2C',
    accent: '#6E7789',
  },
  {
    id: 'unicorn',
    name: 'Единорог',
    emoji: '🦄',
    body: '#EFE2F5',
    shade: '#C9B3D8',
    belly: '#FFFFFF',
    ear: 'horn',
    muzzle: 'long',
    tail: 'thin',
    nose: '#D98BB4',
    accent: '#C08AE0',
  },
];

export function getCharacter(id: string | undefined): Character {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

/** Зверь по порядковому номеру — чтобы игроки в лобби не совпадали. */
export function characterFor(index: number): Character {
  return CHARACTERS[index % CHARACTERS.length];
}
