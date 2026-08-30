/**
 * Каталог наших игр.
 *
 * Один и тот же файл лежит в каждой игре: каждая знает про остальных,
 * умеет проверить, установлена ли соседняя, и предложить её скачать.
 */

export interface GameEntry {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  /** Идентификатор приложения на Android. */
  packageId: string;
  /** Страница со всеми сборками. */
  downloadUrl: string;
}

/** Общая страница релизов: там лежат APK всех игр, подписанные названиями. */
export const RELEASES_URL = 'https://github.com/iskanderAttack/game01/releases';

export const GAMES: GameEntry[] = [
  {
    id: 'dilemma',
    name: 'Дилемма заключённого',
    emoji: '🤝',
    tagline: 'Игра о доверии, жадности и репутации. 2–16 человек, семь режимов.',
    packageId: 'com.dilemma.prisoners',
    downloadUrl: RELEASES_URL,
  },
  {
    id: 'seabattle',
    name: 'Морской бой',
    emoji: '⚓',
    tagline: 'От классики до штабной стратегии с радарами и торпедами. До восьми игроков.',
    packageId: 'com.dilemma.seabattle',
    downloadUrl: RELEASES_URL,
  },
];

/** Идентификатор игры, внутри которой мы сейчас находимся. */
export const SELF_ID = 'dilemma';

export function otherGames(): GameEntry[] {
  return GAMES.filter((g) => g.id !== SELF_ID);
}
