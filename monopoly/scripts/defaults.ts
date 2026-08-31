import type { GameSettings } from '../src/game/types';

/** Настройки по умолчанию — те же, что в приложении, но без зависимости от React. */
export const DEFAULT_SETTINGS: GameSettings = {
  modeId: 'classic',
  startMoney: 1500000,
  goSalary: 200000,
  goBonus: false,
  auctions: true,
  parkingPot: false,
  mortgages: true,
  tycoon: false,
  market: false,
  roundLimit: 0,
  evenBuild: true,
  houseSupply: 32,
  hotelSupply: 12,
  sound: false,
  haptics: false,
  botLevel: 'normal',
};
