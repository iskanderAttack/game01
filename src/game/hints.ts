import { getMode } from './modes';
import { partnerOf, coopRate } from './engine';
import { commonsScore, pairScore } from './payoffs';
import type { GameState, Move } from './types';

export type HintTone = 'info' | 'warn' | 'good' | 'danger';

export interface Hint {
  id: string;
  emoji: string;
  text: string;
  tone: HintTone;
  /** Чем выше, тем важнее показать. */
  priority: number;
}

const lastMove = (h: Move[]): Move | undefined => h[h.length - 1];

/** Подсказки для конкретного игрока перед его ходом. */
export function contextualHints(state: GameState, playerId: string): Hint[] {
  const hints: Hint[] = [];
  const me = state.players.find((p) => p.id === playerId);
  if (!me) return hints;
  const mode = getMode(state.settings.modeId);
  const { settings } = state;
  const roundsLeft = state.totalRounds - state.round;

  if (state.round === 0) {
    hints.push({
      id: 'first',
      emoji: '🌱',
      text: 'Первый ход задаёт тон всей партии. Почти все сильные стратегии начинают с доверия.',
      tone: 'info',
      priority: 60,
    });
  }

  if (settings.endingRule === 'fixed' && roundsLeft === 1) {
    hints.push({
      id: 'lastRound',
      emoji: '⏳',
      text: 'Последний раунд: отомстить за предательство уже никто не успеет. Все это понимают.',
      tone: 'danger',
      priority: 95,
    });
  } else if (settings.endingRule === 'unknown') {
    hints.push({
      id: 'unknownEnd',
      emoji: '🎯',
      text: 'Конец партии неизвестен. Пока игра может продолжиться, репутация дороже разового куша.',
      tone: 'info',
      priority: 30,
    });
  }

  if (settings.noise > 0) {
    hints.push({
      id: 'noise',
      emoji: '🌫️',
      text: `Ходы искажаются с вероятностью ${Math.round(settings.noise * 100)}%. Не спешите мстить за одну осечку — она могла быть случайной.`,
      tone: 'warn',
      priority: 50,
    });
  }

  // Что происходит лично со мной.
  const myTail = me.history.slice(-3);
  if (myTail.length === 3 && myTail.every((m) => m === 'D')) {
    hints.push({
      id: 'streakD',
      emoji: '🔥',
      text: 'Вы предали трижды подряд. Соперники это запомнили — дальше вас будут просто наказывать.',
      tone: 'danger',
      priority: 80,
    });
  }
  if (myTail.length === 3 && myTail.every((m) => m === 'C') && me.stats.betrayed >= 2) {
    hints.push({
      id: 'doormat',
      emoji: '🚪',
      text: 'Вас регулярно предают, а вы продолжаете молчать. Успешные стратегии — добрые, но не беззащитные.',
      tone: 'warn',
      priority: 78,
    });
  }

  if (mode.structure === 'pairs') {
    const oppId = partnerOf(state, playerId);
    const opp = state.players.find((p) => p.id === oppId);
    if (opp) {
      const oppLast = lastMove(opp.history);
      const rate = coopRate(opp);
      if (opp.history.length === 0) {
        hints.push({
          id: 'newPartner',
          emoji: '👋',
          text: `${opp.name} ещё ни разу не ходил(а). О нём пока ничего не известно.`,
          tone: 'info',
          priority: 40,
        });
      } else if (oppLast === 'D') {
        hints.push({
          id: 'oppDefected',
          emoji: '⚠️',
          text: `${opp.name} в прошлый раз выбрал(а) предательство. Зеркало ответило бы тем же.`,
          tone: 'warn',
          priority: 85,
        });
      } else if (rate > 0.75) {
        hints.push({
          id: 'oppKind',
          emoji: '🕊️',
          text: `${opp.name} сотрудничает в ${Math.round(rate * 100)}% ходов. Взаимное доверие здесь окупается.`,
          tone: 'good',
          priority: 70,
        });
      }
      const { R, T, S, P } = settings.payoff;
      hints.push({
        id: 'math',
        emoji: '🧮',
        text: `Расклад: оба молчите — по ${R}. Сдадите вы одни — ${T}, а напарник получит ${S}. Сдадите оба — по ${P}.`,
        tone: 'info',
        priority: 20,
      });
    }
  }

  if (mode.structure === 'commons') {
    const n = state.players.length;
    const all = commonsScore('C', n, n, settings.payoff, settings.commonsMultiplier);
    const freeRider = commonsScore('D', n - 1, n, settings.payoff, settings.commonsMultiplier);
    hints.push({
      id: 'commonsMath',
      emoji: '🧮',
      text: `Если вложатся все — по ${all} каждому. Если все, кроме вас, — вы получите ${freeRider}, но общий котёл обеднеет.`,
      tone: 'info',
      priority: 45,
    });
    const lastRes = state.results[state.results.length - 1];
    if (lastRes) {
      const ratio = lastRes.cooperators / n;
      if (ratio < 0.4) {
        hints.push({
          id: 'commonsCollapse',
          emoji: '📉',
          text: 'Котёл рушится: вкладываться перестали почти все. Кто-то должен первым восстановить доверие.',
          tone: 'danger',
          priority: 82,
        });
      } else if (ratio === 1) {
        hints.push({
          id: 'commonsPerfect',
          emoji: '✨',
          text: 'В прошлый раунд вложились все. Это лучший возможный исход — не ломайте его.',
          tone: 'good',
          priority: 75,
        });
      }
    }
  }

  if (mode.structure === 'roundRobin') {
    const others = state.players.length - 1;
    const maxCoop = pairScore('C', 'C', settings.payoff) * others;
    const maxBetray = pairScore('D', 'C', settings.payoff) * others;
    hints.push({
      id: 'rrMath',
      emoji: '🧮',
      text: `Ваш ход применится ко всем ${others} соперникам сразу: до ${maxCoop} за общее доверие, до ${maxBetray} за удачное предательство.`,
      tone: 'info',
      priority: 35,
    });
  }

  const leader = [...state.players].sort((a, b) => b.score - a.score)[0];
  if (leader && leader.id !== playerId && state.round > 2 && leader.score - me.score > settings.payoff.T * 2) {
    hints.push({
      id: 'behind',
      emoji: '🏃',
      text: `${leader.name} заметно впереди. Отыграться разовым предательством обычно не выходит — выигрывает стабильность.`,
      tone: 'warn',
      priority: 65,
    });
  }

  return hints.sort((a, b) => b.priority - a.priority);
}

/* ─────────────────────── справочник «Академия» ────────────────────────── */

export interface TheoryCard {
  id: string;
  emoji: string;
  title: string;
  text: string;
}

export const THEORY: TheoryCard[] = [
  {
    id: 'origin',
    emoji: '🏛️',
    title: 'Откуда взялась дилемма',
    text: 'В 1950 году Меррилл Флад и Мелвин Дрешер придумали задачу, а Альберт Такер придал ей форму истории о двух арестованных. Каждому предлагают сдать сообщника: молчат оба — оба отделаются лёгким наказанием; сдаст один — он выйдет на свободу, а второй сядет надолго; сдадут оба — сядут оба.',
  },
  {
    id: 'paradox',
    emoji: '🤯',
    title: 'В чём парадокс',
    text: 'Предательство выгоднее лично вам при любом ходе соперника — это доминирующая стратегия. Но если так рассуждают оба, оба получают меньше, чем если бы просто молчали. Рациональность каждого приводит к худшему результату для всех.',
  },
  {
    id: 'iterated',
    emoji: '🔁',
    title: 'Почему повторение всё меняет',
    text: 'В одном раунде предавать «правильно». Но когда раундов много и конец неизвестен, появляется тень будущего: сегодняшнее предательство оплачивается завтрашней местью. Именно поэтому сотрудничество способно возникнуть без всякого договора.',
  },
  {
    id: 'axelrod',
    emoji: '🏆',
    title: 'Турнир Аксельрода',
    text: 'В 1980 году Роберт Аксельрод собрал программы-стратегии и стравил их друг с другом. Победила самая короткая — «Зеркало» в четыре строки. Аксельрод вывел четыре признака сильной стратегии: быть добрым (не предавать первым), отвечать на предательство, быстро прощать и быть предсказуемым.',
  },
  {
    id: 'noise',
    emoji: '🌫️',
    title: 'Туман недопонимания',
    text: 'В реальности намерение и поступок расходятся: письмо не дошло, слово поняли не так. Стоит добавить шум — и жёсткое «Зеркало» проваливается в бесконечную месть. Выигрывают прощающие стратегии вроде «Добряка».',
  },
  {
    id: 'endgame',
    emoji: '⏳',
    title: 'Эффект последнего хода',
    text: 'Если все знают, что раунд последний, мстить будет некому — и все предают. Обратной индукцией это рассуждение расползается на всю партию. Лечится просто: сделайте конец непредсказуемым (режим «неизвестный финал»).',
  },
  {
    id: 'commons',
    emoji: '🌍',
    title: 'Трагедия общин',
    text: 'Дилемма на многих: общее пастбище, общий океан, общий климат. Каждому выгодно взять чуть больше, но если так поступят все — ресурс исчезнет. Элинор Остром получила Нобелевскую премию, показав, что сообщества умеют решать это сами — через правила, наблюдение и репутацию.',
  },
  {
    id: 'real',
    emoji: '🌐',
    title: 'Где это встречается',
    text: 'Гонка вооружений, ценовые войны, допинг в спорте, реклама конкурентов, уборка общей кухни, сокращение выбросов, вакцинация. Везде, где личная выгода тянет в одну сторону, а общая — в другую.',
  },
  {
    id: 'howto',
    emoji: '🧭',
    title: 'Как играть хорошо',
    text: 'Начинайте с доверия. Не предавайте первыми. Отвечайте на предательство — но ровно один раз. Прощайте быстро, особенно при шуме. Не завидуйте: цель — набрать много очков, а не обогнать соседа. Дилемма — не игра с нулевой суммой.',
  },
];
