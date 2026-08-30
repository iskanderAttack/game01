const K = 1000;

export type CardEffect =
  /** Получить у банка (плюс) или заплатить банку (минус). */
  | { t: 'money'; amount: number }
  | { t: 'moveTo'; tile: number; collectGo: boolean }
  | { t: 'moveBy'; steps: number }
  | { t: 'jail' }
  | { t: 'jailCard' }
  /** До ближайшего вокзала; аренда платится вдвойне. */
  | { t: 'nearestRail' }
  /** До ближайшей коммунальной службы; аренда ×10 от броска. */
  | { t: 'nearestUtility' }
  /** Ремонт: столько-то за каждый дом и за каждый отель. */
  | { t: 'repairs'; perHouse: number; perHotel: number }
  | { t: 'payEach'; amount: number }
  | { t: 'collectEach'; amount: number };

export interface Card {
  id: string;
  deck: 'chance' | 'chest';
  emoji: string;
  text: string;
  effect: CardEffect;
}

export const CHANCE: Card[] = [
  { id: 'ch1', deck: 'chance', emoji: '🏁', text: 'Отправляйтесь на «Старт» и получите выплату.', effect: { t: 'moveTo', tile: 0, collectGo: true } },
  { id: 'ch2', deck: 'chance', emoji: '🏛️', text: 'Вас ждут на Дворцовой площади. Отправляйтесь туда.', effect: { t: 'moveTo', tile: 24, collectGo: true } },
  { id: 'ch3', deck: 'chance', emoji: '🚶', text: 'Прогулка по улице Пушкина. Отправляйтесь туда.', effect: { t: 'moveTo', tile: 11, collectGo: true } },
  { id: 'ch4', deck: 'chance', emoji: '💡', text: 'Аварийный вызов: двигайтесь к ближайшей коммунальной службе. Аренда — десятикратный бросок.', effect: { t: 'nearestUtility' } },
  { id: 'ch5', deck: 'chance', emoji: '🚂', text: 'Срочная поездка: двигайтесь к ближайшему вокзалу. Аренда платится вдвойне.', effect: { t: 'nearestRail' } },
  { id: 'ch6', deck: 'chance', emoji: '💰', text: 'Банк выплачивает вам дивиденды.', effect: { t: 'money', amount: 50 * K } },
  { id: 'ch7', deck: 'chance', emoji: '🔑', text: 'Освобождение из тюрьмы. Сохраните эту карточку.', effect: { t: 'jailCard' } },
  { id: 'ch8', deck: 'chance', emoji: '↩️', text: 'Вернитесь на три клетки назад.', effect: { t: 'moveBy', steps: -3 } },
  { id: 'ch9', deck: 'chance', emoji: '🚔', text: 'Отправляйтесь в тюрьму. Без выплаты за «Старт».', effect: { t: 'jail' } },
  { id: 'ch10', deck: 'chance', emoji: '🔧', text: 'Капитальный ремонт: 25 тысяч за дом и 100 тысяч за отель.', effect: { t: 'repairs', perHouse: 25 * K, perHotel: 100 * K } },
  { id: 'ch11', deck: 'chance', emoji: '🚦', text: 'Штраф за превышение скорости.', effect: { t: 'money', amount: -15 * K } },
  { id: 'ch12', deck: 'chance', emoji: '🚉', text: 'Отправляйтесь на Ленинградский вокзал.', effect: { t: 'moveTo', tile: 5, collectGo: true } },
  { id: 'ch13', deck: 'chance', emoji: '⭐', text: 'Вас пригласили на Красную площадь. Отправляйтесь туда.', effect: { t: 'moveTo', tile: 39, collectGo: true } },
  { id: 'ch14', deck: 'chance', emoji: '🎩', text: 'Вас выбрали председателем правления. Заплатите каждому игроку.', effect: { t: 'payEach', amount: 50 * K } },
  { id: 'ch15', deck: 'chance', emoji: '🏦', text: 'Ваш строительный кредит погашен. Получите выплату.', effect: { t: 'money', amount: 150 * K } },
  { id: 'ch16', deck: 'chance', emoji: '🎫', text: 'Выигрыш в лотерею.', effect: { t: 'money', amount: 100 * K } },
];

export const CHEST: Card[] = [
  { id: 'cc1', deck: 'chest', emoji: '🏁', text: 'Отправляйтесь на «Старт» и получите выплату.', effect: { t: 'moveTo', tile: 0, collectGo: true } },
  { id: 'cc2', deck: 'chest', emoji: '🏦', text: 'Ошибка банка в вашу пользу. Получите деньги.', effect: { t: 'money', amount: 200 * K } },
  { id: 'cc3', deck: 'chest', emoji: '🩺', text: 'Счёт от врача. Заплатите банку.', effect: { t: 'money', amount: -50 * K } },
  { id: 'cc4', deck: 'chest', emoji: '📈', text: 'Продажа акций принесла прибыль.', effect: { t: 'money', amount: 50 * K } },
  { id: 'cc5', deck: 'chest', emoji: '🔑', text: 'Освобождение из тюрьмы. Сохраните эту карточку.', effect: { t: 'jailCard' } },
  { id: 'cc6', deck: 'chest', emoji: '🚔', text: 'Отправляйтесь в тюрьму. Без выплаты за «Старт».', effect: { t: 'jail' } },
  { id: 'cc7', deck: 'chest', emoji: '🏖️', text: 'Отпускной фонд закрыт. Получите деньги.', effect: { t: 'money', amount: 100 * K } },
  { id: 'cc8', deck: 'chest', emoji: '🧾', text: 'Возврат подоходного налога.', effect: { t: 'money', amount: 20 * K } },
  { id: 'cc9', deck: 'chest', emoji: '🎂', text: 'У вас день рождения! Получите подарок с каждого игрока.', effect: { t: 'collectEach', amount: 10 * K } },
  { id: 'cc10', deck: 'chest', emoji: '📜', text: 'Страховка выплачена. Получите деньги.', effect: { t: 'money', amount: 100 * K } },
  { id: 'cc11', deck: 'chest', emoji: '🏥', text: 'Оплата больницы.', effect: { t: 'money', amount: -100 * K } },
  { id: 'cc12', deck: 'chest', emoji: '🎓', text: 'Оплата обучения.', effect: { t: 'money', amount: -50 * K } },
  { id: 'cc13', deck: 'chest', emoji: '💼', text: 'Гонорар за консультацию.', effect: { t: 'money', amount: 25 * K } },
  { id: 'cc14', deck: 'chest', emoji: '🛠️', text: 'Ремонт улиц: 40 тысяч за дом и 115 тысяч за отель.', effect: { t: 'repairs', perHouse: 40 * K, perHotel: 115 * K } },
  { id: 'cc15', deck: 'chest', emoji: '🏆', text: 'Второе место на городском конкурсе. Получите приз.', effect: { t: 'money', amount: 10 * K } },
  { id: 'cc16', deck: 'chest', emoji: '📦', text: 'Вы получили наследство.', effect: { t: 'money', amount: 100 * K } },
];

const ALL = new Map<string, Card>([...CHANCE, ...CHEST].map((c) => [c.id, c]));

export function getCard(id: string): Card | undefined {
  return ALL.get(id);
}
