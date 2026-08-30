import { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { useApp } from './store/appStore';
import { HomeScreen } from './ui/screens/Home';
import { ModesScreen } from './ui/screens/Modes';
import { SetupScreen } from './ui/screens/Setup';
import { GameScreen } from './ui/screens/Game';
import { ResultsScreen } from './ui/screens/Results';
import { AcademyScreen } from './ui/screens/Academy';
import { StrategiesScreen } from './ui/screens/Strategies';
import { SettingsScreen } from './ui/screens/Settings';
import { NetScreen } from './ui/screens/Net';
import { GamesScreen } from './ui/screens/Games';
import { SafeMotion } from './ui/components/Shell';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { diag } from './lib/diag';

/** Сколько ждём появления нового экрана, прежде чем счесть переход зависшим. */
const TRANSITION_GRACE_MS = 1200;

/** Фазы раунда, у которых есть своя панель в разметке. */
const TRACKED_PHASES = ['briefing', 'collecting', 'scoreboard'];

export default function App() {
  const screen = useApp((s) => s.screen);
  const go = useApp((s) => s.go);
  const phase = useApp((s) => (s.screen === 'game' ? (s.game?.phase ?? null) : null));
  const hasReveal = useApp((s) => s.reveal !== null);
  const [safeMotion, setSafeMotion] = useState(false);

  // Фаза, появление которой имеет смысл проверять.
  const trackedPhase =
    phase && (TRACKED_PHASES.includes(phase) || (phase === 'reveal' && hasReveal)) ? phase : null;

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setOverlaysWebView({ overlay: true });
  }, []);

  useEffect(() => {
    diag('экран', screen);
  }, [screen]);

  /*
   * Сторож переходов между экранами.
   *
   * AnimatePresence с mode="wait" монтирует новый экран только после того,
   * как доиграет анимация ухода старого, а она живёт на requestAnimationFrame.
   * Android-WebView может перестать выдавать кадры, оставаясь «видимым»
   * (энергосбережение MIUI/HyperOS, разделённый экран, шторка уведомлений).
   * Тогда переход не завершается никогда — игрок видит чёрный экран,
   * хотя сокет жив и хост считает его в игре.
   *
   * Если через TRANSITION_GRACE_MS нужного экрана нет в DOM или он остался
   * прозрачным, навсегда переходим на отрисовку без анимаций.
   */
  useEffect(() => {
    if (safeMotion) return;

    const stuck = (what: string, why: string) => {
      diag('переход завис', `${what} ${why}`);
      setSafeMotion(true);
    };

    const timer = setTimeout(() => {
      const screenEl = document.querySelector<HTMLElement>(`[data-screen="${screen}"]`);
      if (!screenEl) return stuck(`экран «${screen}»`, 'не появился');
      if (parseFloat(getComputedStyle(screenEl).opacity) < 0.9) {
        return stuck(`экран «${screen}»`, 'остался прозрачным');
      }

      if (!trackedPhase) return;
      const phaseEl = document.querySelector<HTMLElement>(`[data-phase="${trackedPhase}"]`);
      if (!phaseEl) return stuck(`фаза «${trackedPhase}»`, 'не появилась');
      if (parseFloat(getComputedStyle(phaseEl).opacity) < 0.9) {
        stuck(`фаза «${trackedPhase}»`, 'осталась прозрачной');
      }
    }, TRANSITION_GRACE_MS);

    return () => clearTimeout(timer);
  }, [screen, trackedPhase, safeMotion]);

  // Аппаратная кнопка «назад» на Android.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) => {
      void CapApp.addListener('backButton', () => {
        const s = useApp.getState();
        if (s.screen === 'home') void CapApp.exitApp();
        else s.go('home');
      }).then((h) => {
        remove = () => void h.remove();
      });
    });
    return () => remove?.();
  }, []);

  const screens = (
    <>
      {screen === 'home' && <HomeScreen key="home" />}
      {screen === 'modes' && <ModesScreen key="modes" />}
      {screen === 'setup' && <SetupScreen key="setup" />}
      {screen === 'game' && <GameScreen key="game" />}
      {screen === 'results' && <ResultsScreen key="results" />}
      {screen === 'academy' && <AcademyScreen key="academy" />}
      {screen === 'strategies' && <StrategiesScreen key="strategies" />}
      {screen === 'settings' && <SettingsScreen key="settings" />}
      {screen === 'net' && <NetScreen key="net" />}
      {screen === 'games' && <GamesScreen key="games" />}
    </>
  );

  return (
    <SafeMotion.Provider value={safeMotion}>
      <div className={`app-shell ${safeMotion ? 'safe-motion' : ''}`}>
        <div className="aurora" />
        <div className="grain" />
        <ErrorBoundary onReset={() => go('home')}>
          {safeMotion ? screens : <AnimatePresence mode="wait">{screens}</AnimatePresence>}
        </ErrorBoundary>
      </div>
    </SafeMotion.Provider>
  );
}
