import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { netWorth, ranking } from '../game/engine';
import type { GameState } from '../game/types';

export interface HistoryPlayer {
  name: string;
  emoji: string;
  place: number;
  netWorth: number;
  isBot: boolean;
  isMe: boolean;
  won: boolean;
}

export interface HistoryEntry {
  /** Ключ партии — он же защита от повторной записи. */
  id: string;
  at: number;
  modeId: string;
  rounds: number;
  players: HistoryPlayer[];
}

interface HistoryStore {
  entries: HistoryEntry[];
  /** Записывает завершённую партию. Повторный вызов той же партии ничего не делает. */
  record: (game: GameState, myId: string | null) => void;
  clear: () => void;
}

const LIMIT = 50;

export const useHistory = create<HistoryStore>()(
  persist(
    (set, get) => ({
      entries: [],

      record: (game, myId) => {
        if (game.stage !== 'over') return;
        const id = `g${game.seed}`;
        if (get().entries.some((e) => e.id === id)) return;

        const table = ranking(game);
        const entry: HistoryEntry = {
          id,
          at: Date.now(),
          modeId: game.settings.modeId,
          rounds: game.round,
          players: table.map((p, i) => ({
            name: p.name,
            emoji: p.emoji,
            place: i + 1,
            netWorth: netWorth(game, p.id),
            isBot: p.isBot,
            isMe: p.id === myId,
            won: game.winnerIds.includes(p.id),
          })),
        };

        set({ entries: [entry, ...get().entries].slice(0, LIMIT) });
      },

      clear: () => set({ entries: [] }),
    }),
    {
      name: 'monopoly-history',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export interface HistorySummary {
  games: number;
  wins: number;
  best: number;
  favouriteMode: string | null;
}

/** Личный итог по всем сохранённым партиям. */
export function summarize(entries: HistoryEntry[]): HistorySummary {
  let games = 0;
  let wins = 0;
  let best = 0;
  const modes = new Map<string, number>();

  for (const entry of entries) {
    const me = entry.players.find((p) => p.isMe);
    if (!me) continue;
    games += 1;
    if (me.won) wins += 1;
    if (me.netWorth > best) best = me.netWorth;
    modes.set(entry.modeId, (modes.get(entry.modeId) ?? 0) + 1);
  }

  let favouriteMode: string | null = null;
  let top = 0;
  for (const [mode, count] of modes) {
    if (count > top) {
      top = count;
      favouriteMode = mode;
    }
  }

  return { games, wins, best, favouriteMode };
}
