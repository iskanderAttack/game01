import { characterFor } from './characters';

export const AVATAR_EMOJI = [
  '🎩',
  '🚗',
  '🐕',
  '🚢',
  '👞',
  '🧵',
  '🦆',
  '🏎️',
  '🐈',
  '⛵',
  '🎪',
  '🏰',
  '🧭',
  '🎺',
  '🪗',
  '🛵',
];

export const AVATAR_COLORS = [
  '#D4A24C',
  '#38BDF8',
  '#FB7185',
  '#34D399',
  '#A78BFA',
  '#F472B6',
  '#2DD4BF',
  '#FB923C',
];

export function avatarFor(index: number) {
  const critter = characterFor(index);
  return {
    emoji: critter.emoji,
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
    character: critter.id,
  };
}
