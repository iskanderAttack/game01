import { useMemo } from 'react';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { autoPlace, canPlace, emptyBoard, makeShip, rotated } from '../game/board';
import { botAction } from '../game/bots';
import { randomSeed } from '../game/coords';
import {
  advanceTurn,
  createGame,
  everyoneReady,
  fire,
  makePlayer,
  startBattle,
  useAbility,
  viewFor,
  type AbilityParams,
  type ClientView,
} from '../game/engine';
import { getFleet } from '../game/fleet';
import { getMode, type ModeId } from '../game/modes';
import type { GameSettings, GameState, Orientation, Player, Ship } from '../game/types';

export type Screen =
  | 'home'
  | 'modes'
  | 'setup'
  | 'placement'
  | 'game'
  | 'results'
  | 'academy'
  | 'settings'
  | 'net'
  | 'games';

export type NetRole = 'local' | 'host' | 'client';

export const DEFAULT_SETTINGS: GameSettings = {
  modeId: 'classic',
  boardSize: 10,
  fleetId: 'classic',
  allowTouching: false,
  extraTurnOnHit: true,
  timer: 0,
  hints: true,
  abilities: false,
  confirmShot: true,
  sound: true,
  haptics: true,
  botLevel: 'normal',
};

const PALETTE = ['#38BDF8', '#FB7185', '#34D399', '#FBBF24', '#A78BFA', '#F472B6', '#2DD4BF', '#FB923C'];
const EMOJI = ['⚓', '🦈', '🐙', '🦑', '🐬', '🦞', '🐋', '🦭', '🏴‍☠️', '🧭'];

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
  /** Персональный вид, присланный хостом (для клиента). */
  remoteView: ClientView | null;
  netRole: NetRole;
  localPlayerId: string | null;
  seenIntro: boolean;
  /** Лучший результат в режиме «Охота»: минимум выстрелов. */
  huntRecord: number | null;
  /** Строки журнала боя. */
  feed: string[];

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
  /** Игрок, который сейчас расставляет флот или ходит. */
  autoPlaceFor: (playerId: string) => void;
  placeShip: (playerId: string, size: number, x: number, y: number, dir: Orientation) => boolean;
  moveShip: (playerId: string, shipId: string, x: number, y: number) => boolean;
  rotateShip: (playerId: string, shipId: string) => boolean;
  removeShip: (playerId: string, shipId: string) => void;
  clearBoard: (playerId: string) => void;
  setReady: (playerId: string) => void;
  tryStartBattle: () => void;
  afterRemoteMove: () => void;

  selectTarget: (targetId: string) => void;
  shoot: (x: number, y: number) => void;
  castAbility: (abilityId: string, params: AbilityParams) => string | null;
  quitGame: () => void;
  applyRemoteView: (view: ClientView | null) => void;
  setNetRole: (role: NetRole, playerId: string | null) => void;
  markIntroSeen: () => void;
  pushFeed: (lines: string[]) => void;
}

let counter = 0;
const newId = () => `p${Date.now().toString(36)}${(counter++).toString(36)}`;

function makeRosterPlayer(name: string, index: number, isBot: boolean, level: GameSettings['botLevel']) {
  return makePlayer({
    id: newId(),
    name,
    emoji: EMOJI[index % EMOJI.length],
    color: PALETTE[index % PALETTE.length],
    isBot,
    botLevel: isBot ? level : undefined,
  });
}

/** Таймер хода бота, чтобы его залпы не выглядели мгновенными. */
let botTimer: ReturnType<typeof setTimeout> | null = null;

export const useApp = create<AppState>()(
  persist(
    (set, get) => ({
      screen: 'home',
      previousScreen: 'home',
      settings: { ...DEFAULT_SETTINGS },
      profile: { name: 'Капитан', emoji: '⚓', color: '#38BDF8' },
      draft: [],
      game: null,
      remoteView: null,
      netRole: 'local',
      localPlayerId: null,
      seenIntro: false,
      huntRecord: null,
      feed: [],

      go: (screen) => set((s) => ({ screen, previousScreen: s.screen })),
      back: () => set((s) => ({ screen: s.previousScreen, previousScreen: 'home' })),

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      setMode: (id) => {
        const mode = getMode(id);
        set((s) => {
          const settings = { ...s.settings, modeId: id, ...mode.defaults };
          const fleet = getFleet(settings.fleetId);
          // Поле не должно быть меньше, чем нужно самому длинному кораблю.
          settings.boardSize = Math.max(settings.boardSize, Math.max(...fleet.sizes) + 1);
          return { settings };
        });
      },

      setProfile: (patch) => set((s) => ({ profile: { ...s.profile, ...patch } })),

      addHuman: (name) => {
        const { draft, settings } = get();
        const index = draft.length;
        const label = name ?? (index === 0 ? get().profile.name : `Игрок ${index + 1}`);
        set({ draft: [...draft, makeRosterPlayer(label, index, false, settings.botLevel)] });
      },

      addBot: () => {
        const { draft, settings } = get();
        const index = draft.length;
        const botNumber = draft.filter((p) => p.isBot).length + 1;
        set({
          draft: [...draft, makeRosterPlayer(`Бот ${botNumber}`, index, true, settings.botLevel)],
        });
      },

      removePlayer: (id) => set((s) => ({ draft: s.draft.filter((p) => p.id !== id) })),
      resetDraft: () => set({ draft: [] }),

      startGame: () => {
        const { draft, settings, netRole, profile } = get();
        const mode = getMode(settings.modeId);

        let roster = draft;
        if (roster.length === 0) {
          roster = [makeRosterPlayer(profile.name, 0, false, settings.botLevel)];
        }
        // Командный режим: расставляем игроков по двум эскадрам.
        if (mode.teams) {
          roster = roster.map((p, i) => ({ ...p, team: i % 2 }));
        } else {
          roster = roster.map((p) => ({ ...p, team: undefined }));
        }

        const game = createGame(settings, roster, randomSeed());
        const localId = netRole === 'local' ? roster.find((p) => !p.isBot)?.id ?? null : get().localPlayerId;

        set({
          game,
          draft: roster,
          screen: 'placement',
          localPlayerId: localId,
          feed: [],
          remoteView: null,
        });
      },

      autoPlaceFor: (playerId) => {
        const { game } = get();
        if (!game) return;
        const fleet = getFleet(game.settings.fleetId);
        const ships = autoPlace(game.settings.boardSize, fleet.sizes, game.settings.allowTouching);
        if (!ships) return;
        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId ? { ...p, board: { ...p.board, ships } } : p,
            ),
          },
        });
      },

      placeShip: (playerId, size, x, y, dir) => {
        const { game } = get();
        if (!game) return false;
        const player = game.players.find((p) => p.id === playerId);
        if (!player) return false;

        const ship = makeShip(size, x, y, dir);
        if (!canPlace(player.board, ship, game.settings.allowTouching)) return false;

        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId ? { ...p, board: { ...p.board, ships: [...p.board.ships, ship] } } : p,
            ),
          },
        });
        return true;
      },

      moveShip: (playerId, shipId, x, y) => {
        const { game } = get();
        if (!game) return false;
        const player = game.players.find((p) => p.id === playerId);
        const ship = player?.board.ships.find((s) => s.id === shipId);
        if (!player || !ship) return false;

        const moved: Ship = { ...ship, x, y };
        if (!canPlace(player.board, moved, game.settings.allowTouching)) return false;

        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId
                ? { ...p, board: { ...p.board, ships: p.board.ships.map((s) => (s.id === shipId ? moved : s)) } }
                : p,
            ),
          },
        });
        return true;
      },

      rotateShip: (playerId, shipId) => {
        const { game } = get();
        if (!game) return false;
        const player = game.players.find((p) => p.id === playerId);
        const ship = player?.board.ships.find((s) => s.id === shipId);
        if (!player || !ship) return false;

        const turned = rotated(ship);
        if (!canPlace(player.board, turned, game.settings.allowTouching)) return false;

        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId
                ? { ...p, board: { ...p.board, ships: p.board.ships.map((s) => (s.id === shipId ? turned : s)) } }
                : p,
            ),
          },
        });
        return true;
      },

      removeShip: (playerId, shipId) => {
        const { game } = get();
        if (!game) return;
        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId
                ? { ...p, board: { ...p.board, ships: p.board.ships.filter((s) => s.id !== shipId) } }
                : p,
            ),
          },
        });
      },

      clearBoard: (playerId) => {
        const { game } = get();
        if (!game) return;
        set({
          game: {
            ...game,
            players: game.players.map((p) =>
              p.id === playerId ? { ...p, board: emptyBoard(game.settings.boardSize) } : p,
            ),
          },
        });
      },

      setReady: (playerId) => {
        const { game } = get();
        if (!game) return;
        const fleet = getFleet(game.settings.fleetId);
        const player = game.players.find((p) => p.id === playerId);
        if (!player || player.board.ships.length !== fleet.sizes.length) return;

        const withReady: GameState = {
          ...game,
          players: game.players.map((p) => (p.id === playerId ? { ...p, ready: true } : p)),
        };

        set({ game: withReady });
        get().tryStartBattle();
      },

      tryStartBattle: () => {
        const { game } = get();
        if (!game || game.phase !== 'placement' || !everyoneReady(game)) return;
        set({ game: startBattle(game), screen: 'game', feed: ['🚩 Бой начался'] });
        scheduleBot(get, set);
      },

      afterRemoteMove: () => afterMove(get, set),

      selectTarget: (targetId) => {
        const { game } = get();
        if (!game) return;
        set({ game: { ...game, targetId } });
      },

      shoot: (x, y) => {
        const { game, netRole } = get();
        if (!game || game.phase !== 'playing') return;
        const shooter = game.players[game.turnIndex];
        const targetId = game.targetId;
        if (!shooter || !targetId) return;
        if (netRole === 'client') return;

        const result = fire(game, shooter.id, targetId, x, y);
        if (!result) return;

        const nextState = result.extraTurn ? result.state : advanceTurn(result.state);
        set({ game: nextState });
        get().pushFeed(result.messages);
        afterMove(get, set);
      },

      castAbility: (abilityId, params) => {
        const { game, netRole } = get();
        if (!game || game.phase !== 'playing') return 'Партия не идёт';
        if (netRole === 'client') return null;
        const actor = game.players[game.turnIndex];
        if (!actor) return 'Нет активного игрока';

        const result = useAbility(game, actor.id, abilityId, params);
        if (result.error) return result.error;

        const nextState = result.extraTurn ? result.state : advanceTurn(result.state);
        set({ game: nextState });
        get().pushFeed(result.messages);
        afterMove(get, set);
        return null;
      },

      quitGame: () => {
        if (botTimer) clearTimeout(botTimer);
        botTimer = null;
        set({ game: null, remoteView: null, screen: 'home', feed: [] });
      },

      applyRemoteView: (view) =>
        set({
          remoteView: view,
          screen: !view ? 'home' : view.phase === 'finished' ? 'results' : view.phase === 'placement' ? 'placement' : 'game',
        }),

      setNetRole: (role, playerId) => set({ netRole: role, localPlayerId: playerId }),
      markIntroSeen: () => set({ seenIntro: true }),

      pushFeed: (lines) =>
        set((s) => ({ feed: [...lines.filter(Boolean), ...s.feed].slice(0, 40) })),
    }),
    {
      name: 'sea-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        settings: s.settings,
        profile: s.profile,
        seenIntro: s.seenIntro,
        huntRecord: s.huntRecord,
      }),
    },
  ),
);

/* ───────────────────────── ходы ботов и финал ───────────────────────── */

type Get = () => AppState;
type Set = (patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) => void;

function afterMove(get: Get, set: Set) {
  const { game } = get();
  if (!game) return;

  if (game.phase === 'finished') {
    if (botTimer) clearTimeout(botTimer);
    botTimer = null;
    const mode = getMode(game.settings.modeId);
    // «Охота»: фиксируем рекорд по числу выстрелов.
    if (mode.id === 'hunt') {
      const human = game.players.find((p) => !p.isBot);
      const record = get().huntRecord;
      if (human && game.winnerIds.includes(human.id)) {
        if (record === null || human.stats.shots < record) set({ huntRecord: human.stats.shots });
      }
    }
    set({ screen: 'results' });
    return;
  }

  scheduleBot(get, set);
}

function scheduleBot(get: Get, set: Set) {
  if (botTimer) clearTimeout(botTimer);
  botTimer = null;

  const { game, netRole } = get();
  if (!game || game.phase !== 'playing' || netRole === 'client') return;

  const actor = game.players[game.turnIndex];
  if (!actor?.isBot) return;

  botTimer = setTimeout(() => {
    const state = get().game;
    if (!state || state.phase !== 'playing') return;
    const bot = state.players[state.turnIndex];
    if (!bot?.isBot) return;

    const action = botAction(state, bot.id);
    if (!action) {
      set({ game: advanceTurn(state) });
      scheduleBot(get, set);
      return;
    }

    if (action.kind === 'ability' && action.abilityId) {
      const result = useAbility(state, bot.id, action.abilityId, {
        targetId: action.targetId,
        x: action.x,
        y: action.y,
        axis: action.axis,
        index: action.index,
      });
      if (!result.error) {
        set({ game: result.extraTurn ? result.state : advanceTurn(result.state) });
        get().pushFeed(result.messages);
        afterMove(get, set);
        return;
      }
    }

    if (action.x === undefined || action.y === undefined) {
      set({ game: advanceTurn(state) });
      scheduleBot(get, set);
      return;
    }

    const result = fire(state, bot.id, action.targetId, action.x, action.y);
    if (!result) {
      set({ game: advanceTurn(state) });
      scheduleBot(get, set);
      return;
    }

    set({ game: result.extraTurn ? result.state : advanceTurn(result.state) });
    get().pushFeed(result.messages);
    afterMove(get, set);
  }, 780);
}

/* ───────────────────────────── селекторы ───────────────────────────── */

/** Кто сейчас должен что-то делать на этом устройстве. */
export function activePlayer(state: AppState): Player | null {
  const { game, netRole, localPlayerId } = state;
  if (!game) return null;
  if (netRole === 'client') return null;

  if (game.phase === 'placement') {
    // По очереди расставляют все люди на этом устройстве.
    return game.players.find((p) => !p.isBot && !p.remote && !p.ready) ?? null;
  }

  const current = game.players[game.turnIndex] ?? null;
  if (netRole === 'host' && current && current.id !== localPlayerId && !current.isBot) return null;
  return current;
}

/**
 * Хук активного игрока.
 *
 * Селектор возвращает объект прямо из состояния, поэтому ссылка стабильна
 * и лишних перерисовок не будет.
 */
export function useActivePlayer(): Player | null {
  const game = useApp((s) => s.game);
  const netRole = useApp((s) => s.netRole);
  const localPlayerId = useApp((s) => s.localPlayerId);
  return useMemo(
    () => activePlayer({ game, netRole, localPlayerId } as AppState),
    [game, netRole, localPlayerId],
  );
}

/**
 * Единый персональный вид для интерфейса — и для сети, и для игры
 * на одном устройстве.
 *
 * viewFor каждый раз собирает новый объект, поэтому передавать его
 * прямо в useApp нельзя: zustand счёл бы состояние изменившимся на
 * каждой проверке и загнал бы React в бесконечную перерисовку.
 */
export function useCurrentView(): ClientView | null {
  const game = useApp((s) => s.game);
  const remoteView = useApp((s) => s.remoteView);
  const netRole = useApp((s) => s.netRole);
  const localPlayerId = useApp((s) => s.localPlayerId);

  return useMemo(() => {
    if (netRole === 'client') return remoteView;
    if (!game) return null;

    const state = { game, netRole, localPlayerId } as AppState;

    let who: string | null;
    if (game.phase === 'placement') {
      who = activePlayer(state)?.id ?? localPlayerId;
    } else if (game.phase === 'finished' || netRole === 'host') {
      who = localPlayerId;
    } else {
      // Во время хода бота нельзя показывать его глазами: иначе на экране
      // окажется чужая расстановка. Остаёмся на своём игроке.
      const current = game.players[game.turnIndex];
      who = current && !current.isBot && !current.remote ? current.id : localPlayerId;
    }

    return who ? viewFor(game, who) : null;
  }, [game, remoteView, netRole, localPlayerId]);
}

/** Нужна ли ширма «передайте телефон» между ходами. */
export function useNeedsHandoff(): boolean {
  const game = useApp((s) => s.game);
  const netRole = useApp((s) => s.netRole);
  if (netRole !== 'local' || !game) return false;
  return game.players.filter((p) => !p.isBot && !p.remote).length > 1;
}
