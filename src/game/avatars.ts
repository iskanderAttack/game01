export const AVATARS = [
  '🦊', '🐼', '🦉', '🐯', '🐸', '🐙', '🦄', '🐨',
  '🦁', '🐺', '🐧', '🦅', '🐢', '🦋', '🐝', '🦈',
  '👑', '🎩', '🕶️', '🎭', '🚀', '🍀', '⚡', '🌙',
];

export const COLORS = [
  '#7C5CFF', '#FF6B6B', '#2DD4BF', '#FFB020', '#F472B6', '#60A5FA',
  '#34D399', '#A78BFA', '#FB923C', '#22D3EE', '#F87171', '#4ADE80',
];

export const NAME_POOL = [
  'Барсук', 'Сова', 'Лис', 'Тень', 'Компас', 'Пилот', 'Ветер', 'Кактус',
  'Пингвин', 'Комета', 'Шериф', 'Мираж', 'Гром', 'Искра', 'Туман', 'Клевер',
];

export function avatarFor(index: number): { emoji: string; color: string } {
  return {
    emoji: AVATARS[index % AVATARS.length],
    color: COLORS[index % COLORS.length],
  };
}

export function randomName(taken: string[] = []): string {
  const free = NAME_POOL.filter((n) => !taken.includes(n));
  const pool = free.length ? free : NAME_POOL;
  return pool[Math.floor(Math.random() * pool.length)];
}
