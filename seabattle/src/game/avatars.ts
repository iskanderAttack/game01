export const AVATAR_EMOJI = [
  '⚓',
  '🦈',
  '🐙',
  '🦑',
  '🐬',
  '🦞',
  '🐋',
  '🦭',
  '🏴‍☠️',
  '🧭',
  '🐊',
  '🦀',
  '🐢',
  '🦩',
  '🐧',
  '🦉',
];

export const AVATAR_COLORS = [
  '#38BDF8',
  '#FB7185',
  '#34D399',
  '#FBBF24',
  '#A78BFA',
  '#F472B6',
  '#2DD4BF',
  '#FB923C',
];

export function avatarFor(index: number) {
  return {
    emoji: AVATAR_EMOJI[index % AVATAR_EMOJI.length],
    color: AVATAR_COLORS[index % AVATAR_COLORS.length],
  };
}
