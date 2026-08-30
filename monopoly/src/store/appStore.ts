import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { botAction, botTradeReply } from '../game/bots';
import { applyAction, createGame, makePlayer, type Action } from '../game/engine';
import { getMode, type ModeId } from '../game/modes';
import type { GameSettings, GameState, Player } from '../game/types';

export type Screen = 'home' | 'modes' | 'setup' | 'game' | 'results' | 'academy' | 'settings' | 'net' | 'games';
export type NetRole = 'local' | 'host' | 'client';

const K = 1000;

export const DEFAULT_SETTINGS: GameSettings = {
  modeId: 'classic',
  startMoney: 1500 * K,
  goSalary: 200 * K,
  goBonus: false,
  auctions: true,
  parkingPot: false,
  mortgages: true,
  tycoon: false,
  roundLimit: 0,
  evenBuild: true,
  houseSupply: 32,
  hotelSupply: 12,
  sound: true,
  haptics: true,
  botLevel: 'normal',
};

const PALETTE = ['#D4A24C', '#38BDF8', '#FB7185', '#34D399', '#A78BFA', '#F472B6'];
const EMOJI = ['🎩', '🚗', '🐕', '🚢', '👞', '🧵', '🦆', '🏎️', '🐈', '⛵'];

interface Profile {
  name: string;
  emoji: string;
  color: string;
}

interface AppState {
  screen: Screen;
  previousScreen: Screen;
  settings: GameSettings;
  profile: Profile;
  draft: Player[];
  game: GameState | null;
  netRole: NetRole;
  localPlayerId: string | null;
  seenIntro: boolean;

  go: (screen: Screen) => void;
  back: () => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  setMode: (id: ModeId) => void;
  setProfile: (patch: Partial<Profile>) => void;

  addHuman: (name?: string) => void;
  addBot: () => void;
  removePlayer: (id: string) => void;
  resetDraft: () => void;

  startGame: () => void;
  /** Применяет действие: локально через движок, у клиента — отправкой хосту. */
  dispatch: (playerId: string, action: Action) => string | null;
  /** Применяет действие на стороне хозяина партии (движок). */
  applyLocal: (playerId: string, action: Action) => string | null;
  applyRemoteState: (game: GameState | null) => void;
  setNetRole: (role: NetRole, playerId: string | null) => void;
  quitGame: () => void;
  markIntroSeen: () => void;
  /** Ошибка последнего действия — показывается в интерфейсе. */
  error: string | null;
  setError: (text: string | null) => void;
}

let counter = 0;
const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

function rosterPlayer(name: string, index: number, isBot: boolean, level: GameSettings['botLevel']): Player {
  return makePlayer({
    id: newId(),
    name,
    emoji: EMOJI[index % EMOJI.length],
    color: PALETTE[index % PALETTE.length],
    isBot,
    botLevel: isBot ? level : undefined,
  });
}

let botTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      previousScreen: 'home',
      settings: { ...DEFAULT_SETTINGS },
      profile: { name: 'Игрок', emoji: '🎩', color: '#D4A24C' },
      draft: [],
      game: null,
      netRole: 'local',
      localPlayerId: null,
      seenIntro: false,
      error: null,

      go: (screen) => set((s) => ({ screen, previousScreen: s.screen })),
      back: () => set((s) => ({ screen: s.previousScreen, previousScreen: 'home' })),
      setError: (text) => set({ error: text }),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setMode: (id) =>
        set((s) => ({ settings: { ...s.settings, modeId: id, ...getMode(id).defaults } })),

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      addHuman: (name) => {
        const { draft, settings, profile } = get();
        const index = draft.length;
        const label = name ?? (index === 0 ? profile.name : `Игрок ${index + 1}`);
        set({ draft: [...draft, rosterPlayer(label, index, false, settings.botLevel)] });
      },

      addBot: () => {
        const { draft, settings } = get();
        const n = draft.filter((p) => p.isBot).length + 1;
        set({ draft: [...draft, rosterPlayer(`Бот ${n}`, draft.length, true, settings.botLevel)] });
      },

      removePlayer: (id) => set((s) => ({ draft: s.draft.filter((p) => p.id !== id) })),
      resetDraft: () => set({ draft: [] }),

      startGame: () => {
        const { draft, settings, profile, netRole, localPlayerId } = get();
        const roster = draft.length > 0 ? draft : [rosterPlayer(profile.name, 0, false, settings.botLevel)];
        const game = createGame(settings, roster);
        const localId = netRole === 'local' ? roster.find((p) => !p.isBot)?.id ?? null : localPlayerId;
        set({ game, draft: roster, screen: 'game', localPlayerId: localId, error: null });
        scheduleBot(get, set);
      },

      dispatch: (playerId, action) => {
        const { netRole } = get();
        if (netRole === 'client') {
          // Отправкой занимается мостик — он знает про сокет.
          return null;
        }
        return get().applyLocal(playerId, action);
      },

      applyLocal: (playerId, action) => {
        const { game } = get();
        if (!game) return 'Партия не идёт';
        const result = applyAction(game, playerId, action);
        if (result.error) {
          set({ error: result.error });
          return result.error;
        }
        set({ game: result.state, error: null });
        if (result.state.stage === 'over') {
          if (botTimer) clearTimeout(botTimer);
          botTimer = null;
          set({ screen: 'results' });
          return null;
        }
        scheduleBot(get, set);
        return null;
      },

      applyRemoteState: (game) =>
        set({
          game,
          screen: !game ? 'home' : game.stage === 'over' ? 'results' : 'game',
        }),

      setNetRole: (role, playerId) => set({ netRole: role, localPlayerId: playerId }),

      quitGame: () => {
        if (botTimer) clearTimeout(botTimer);
        botTimer = null;
        set({ game: null, screen: 'home', error: null });
      },

      markIntroSeen: () => set({ seenIntro: true }),
    }),
    {
      name: 'monopoly-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings, profile: s.profile, seenIntro: s.seenIntro }),
    },
  ),
);

/* ─────────────────────────── ходы ботов ─────────────────────────── */

type Get = () => AppState;
type Set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;

/**
 * Кто из ботов должен сейчас действовать: участник торгов, адресат
 * предложения обмена или тот, чей ход.
 */
function botToAct(game: GameState): string | null {
  if (game.stage === 'auction' && game.auction) {
    const bidder = game.players.find((p) => p.id === game.auction!.turnId);
    return bidder?.isBot ? bidder.id : null;
  }

  // Предложение обмена ждёт ответа вне очереди хода.
  for (const offer of game.trades) {
    const to = game.players.find((p) => p.id === offer.toId);
    if (to?.isBot && !to.bankrupt) return to.id;
  }

  const current = game.players[game.turnIndex];
  return current?.isBot && !current.bankrupt ? current.id : null;
}

function scheduleBot(get: Get, set: Set) {
  if (botTimer) clearTimeout(botTimer);
  botTimer = null;

  const { game, netRole } = get();
  if (!game || game.stage === 'over' || netRole === 'client') return;

  const botId = botToAct(game);
  if (!botId) return;

  botTimer = setTimeout(() => {
    const state = get().game;
    if (!state || state.stage === 'over') return;
    const id = botToAct(state);
    if (!id) return;

    // Сначала отвечаем на обмен, если он адресован этому боту.
    const reply = botTradeReply(state, id);
    if (reply) {
      get().applyLocal(id, reply);
      return;
    }

    const action = botAction(state, id);
    if (!action) {
      // Бот не придумал хода — просто завершаем, чтобы партия не встала.
      if (state.stage === 'end') get().applyLocal(id, { t: 'endTurn' });
      return;
    }
    get().applyLocal(id, action);
  }, 900);
}

/* ─────────────────────────── селекторы ─────────────────────────── */

/** Игрок, за которого играет это устройство. */
export function useMe(): Player | null {
  const game = useApp((s) => s.game);
  const localPlayerId = useApp((s) => s.localPlayerId);
  const netRole = useApp((s) => s.netRole);

  return useMemo(() => {
    if (!game) return null;
    if (netRole === 'local') {
      // На одном устройстве «я» — тот, чей сейчас ход.
      return game.players[game.turnIndex] ?? null;
    }
    return game.players.find((p) => p.id === localPlayerId) ?? null;
  }, [game, localPlayerId, netRole]);
}

/** Может ли это устройство сейчас действовать за игрока. */
export function useCanAct(): boolean {
  const game = useApp((s) => s.game);
  const me = useMe();
  const netRole = useApp((s) => s.netRole);

  return useMemo(() => {
    if (!game || !me || me.bankrupt) return false;
    if (game.stage === 'auction' && game.auction) {
      return netRole === 'local' ? !game.players.find((p) => p.id === game.auction!.turnId)?.isBot : game.auction.turnId === me.id;
    }
    const current = game.players[game.turnIndex];
    if (!current || current.isBot) return false;
    return netRole === 'local' ? true : current.id === me.id;
  }, [game, me, netRole]);
}

/** Игрок, который сейчас действует (в торгах — тот, чья ставка). */
export function useActor(): Player | null {
  const game = useApp((s) => s.game);
  return useMemo(() => {
    if (!game) return null;
    if (game.stage === 'auction' && game.auction) {
      return game.players.find((p) => p.id === game.auction!.turnId) ?? null;
    }
    return game.players[game.turnIndex] ?? null;
  }, [game]);
}
