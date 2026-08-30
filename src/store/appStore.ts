import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  applyRound,
  createGame,
  fillBotMoves,
  makePlayer,
  randomSeed,
  resolveRound,
} from '../game/engine';
import { evaluateAchievements } from '../game/achievements';
import { getMode } from '../game/modes';
import { getPreset } from '../game/payoffs';
import { avatarFor, randomName } from '../game/avatars';
import { getStrategy, pickRoster } from '../game/strategies';
import type { GameModeId, GameSettings, GameState, Move, Player, RoundResult } from '../game/types';

export type Screen =
  | 'home'
  | 'modes'
  | 'setup'
  | 'game'
  | 'results'
  | 'academy'
  | 'strategies'
  | 'settings'
  | 'net';

export type NetRole = 'local' | 'host' | 'client';

export const DEFAULT_SETTINGS: GameSettings = {
  modeId: 'duel',
  payoffId: 'classic',
  payoff: getPreset('classic').payoff,
  rounds: 10,
  endingRule: 'unknown',
  endChance: 0.15,
  noise: 0,
  timer: 0,
  hints: true,
  events: false,
  anonymous: false,
  commonsMultiplier: 2,
  sound: true,
  haptics: true,
  revealSpeed: 1,
};

export interface Profile {
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
  reveal: RoundResult | null;
  netRole: NetRole;
  /** id игрока, которым управляет это устройство (сетевой режим). */
  localPlayerId: string | null;
  seenIntro: boolean;

  go: (screen: Screen) => void;
  back: () => void;
  setSettings: (patch: Partial<GameSettings>) => void;
  setPayoffPreset: (id: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  chooseMode: (id: GameModeId) => void;

  addHuman: (name?: string) => void;
  addBot: (strategyId?: string) => void;
  removePlayer: (id: string) => void;
  updatePlayer: (id: string, patch: Partial<Player>) => void;
  shufflePlayers: () => void;
  ensureMinimumPlayers: () => void;

  startGame: () => void;
  beginRound: () => void;
  submitMove: (playerId: string, move: Move) => void;
  resolveNow: () => void;
  toScoreboard: () => void;
  nextRound: () => void;
  restart: () => void;
  quitGame: () => void;

  setNetRole: (role: NetRole, localPlayerId?: string | null) => void;
  applyRemoteState: (game: GameState, reveal: RoundResult | null) => void;
  markIntroSeen: () => void;
}

let counter = 0;
const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

function defaultDraft(): Player[] {
  return [];
}

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      previousScreen: 'home',
      settings: { ...DEFAULT_SETTINGS },
      profile: { name: 'Игрок', emoji: '🦊', color: '#7C5CFF' },
      draft: defaultDraft(),
      game: null,
      reveal: null,
      netRole: 'local',
      localPlayerId: null,
      seenIntro: false,

      go: (screen) => set((s) => ({ screen, previousScreen: s.screen })),
      back: () => set((s) => ({ screen: s.previousScreen, previousScreen: 'home' })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setPayoffPreset: (id) => {
        const preset = getPreset(id);
        set((s) => ({ settings: { ...s.settings, payoffId: preset.id, payoff: preset.payoff } }));
      },

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      chooseMode: (id) => {
        const mode = getMode(id);
        const defaults = mode.defaults;
        set((s) => {
          const next: GameSettings = { ...s.settings, ...defaults, modeId: id };
          if (defaults.payoffId) next.payoff = getPreset(defaults.payoffId).payoff;
          return { settings: next, screen: 'setup', previousScreen: 'modes' };
        });
        get().ensureMinimumPlayers();
      },

      addHuman: (name) => {
        const { draft, profile } = get();
        const idx = draft.length;
        const av = avatarFor(idx);
        const isFirst = draft.length === 0;
        set({
          draft: [
            ...draft,
            makePlayer({
              id: newId(),
              name: name ?? (isFirst ? profile.name : randomName(draft.map((p) => p.name))),
              emoji: isFirst ? profile.emoji : av.emoji,
              color: isFirst ? profile.color : av.color,
              isBot: false,
            }),
          ],
        });
      },

      addBot: (strategyId) => {
        const { draft } = get();
        const used = draft.filter((p) => p.isBot).map((p) => p.strategyId!);
        const sid = strategyId ?? pickRoster('normal', used.length + 1)[used.length];
        const strat = getStrategy(sid);
        const av = avatarFor(draft.length);
        set({
          draft: [
            ...draft,
            makePlayer({
              id: newId(),
              name: strat.name,
              emoji: strat.emoji,
              color: av.color,
              isBot: true,
              strategyId: strat.id,
            }),
          ],
        });
      },

      removePlayer: (id) => set((s) => ({ draft: s.draft.filter((p) => p.id !== id) })),

      updatePlayer: (id, patch) =>
        set((s) => ({ draft: s.draft.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),

      shufflePlayers: () =>
        set((s) => {
          const arr = [...s.draft];
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
          }
          return { draft: arr };
        }),

      ensureMinimumPlayers: () => {
        const { draft, settings } = get();
        const mode = getMode(settings.modeId);
        if (draft.length === 0) {
          get().addHuman();
          if (mode.id === 'solo') {
            for (let i = 0; i < mode.suggestedBots; i++) get().addBot();
          } else {
            const humans = Math.max(mode.minPlayers - mode.suggestedBots, 2);
            for (let i = 1; i < humans; i++) get().addHuman();
            for (let i = 0; i < mode.suggestedBots; i++) get().addBot();
          }
        }
        // Добираем до минимума режима.
        while (get().draft.length < mode.minPlayers) {
          if (mode.id === 'solo') get().addBot();
          else get().addHuman();
        }
        while (get().draft.length > mode.maxPlayers) {
          const arr = get().draft;
          get().removePlayer(arr[arr.length - 1].id);
        }
      },

      startGame: () => {
        const { draft, settings } = get();
        const game = createGame(settings, draft, randomSeed());
        set({ game, reveal: null, screen: 'game' });
      },

      beginRound: () =>
        set((s) => (s.game ? { game: { ...s.game, phase: 'collecting', pending: {}, turnIndex: 0 } } : {})),

      submitMove: (playerId, move) => {
        const { game } = get();
        if (!game) return;
        const pending = { ...game.pending, [playerId]: move };
        const humans = game.players.filter((p) => !p.isBot);
        const nextIndex = humans.findIndex((p) => !pending[p.id] && !p.remote);
        set({ game: { ...game, pending, turnIndex: Math.max(0, nextIndex) } });
        const everyoneReady = humans.every((p) => pending[p.id]);
        if (everyoneReady && get().netRole !== 'client') {
          setTimeout(() => get().resolveNow(), 120);
        }
      },

      resolveNow: () => {
        const { game } = get();
        if (!game || game.phase === 'reveal') return;
        const pending = fillBotMoves(game);
        const result = resolveRound({ ...game, pending }, pending);
        set({ game: { ...game, pending, phase: 'reveal' }, reveal: result });
      },

      toScoreboard: () => {
        const { game, reveal } = get();
        if (!game || !reveal) return;
        const next = applyRound(game, reveal);
        if (next.phase === 'finished') {
          const earned = evaluateAchievements(next);
          next.players = next.players.map((p) => ({ ...p, achievements: earned[p.id] ?? [] }));
          set({ game: next, screen: 'results' });
        } else {
          set({ game: next });
        }
      },

      nextRound: () =>
        set((s) =>
          s.game
            ? { game: { ...s.game, phase: 'collecting', pending: {}, turnIndex: 0 }, reveal: null }
            : {},
        ),

      restart: () => {
        const { game, settings } = get();
        if (!game) return;
        set({ game: createGame(settings, game.players, randomSeed()), reveal: null, screen: 'game' });
      },

      quitGame: () => set({ game: null, reveal: null, screen: 'home' }),

      setNetRole: (role, localPlayerId = null) => set({ netRole: role, localPlayerId }),

      applyRemoteState: (game, reveal) =>
        set({
          game,
          reveal,
          // Хост уже досчитал партию — клиенту нужно сразу показать итоги.
          screen: !game ? 'home' : game.phase === 'finished' ? 'results' : 'game',
        }),

      markIntroSeen: () => set({ seenIntro: true }),
    }),
    {
      name: 'pd-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        profile: s.profile,
        seenIntro: s.seenIntro,
      }),
    },
  ),
);

/** Игрок, который сейчас должен сходить на этом устройстве. */
export function currentTurnPlayer(game: GameState | null, netRole: NetRole, localPlayerId: string | null) {
  if (!game) return null;
  if (netRole === 'client' || netRole === 'host') {
    const me = game.players.find((p) => p.id === localPlayerId);
    return me && !game.pending[me.id] ? me : null;
  }
  const humans = game.players.filter((p) => !p.isBot && !p.remote);
  return humans.find((p) => !game.pending[p.id]) ?? null;
}
