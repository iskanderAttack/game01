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
import { SettingsScreen } from './ui/screens/Settings';
import { NetScreen } from './ui/screens/Net';
import { GamesScreen } from './ui/screens/Games';
import { SafeMotion } from './ui/components/Shell';
import { ErrorBoundary } from './ui/components/ErrorBoundary';
import { diag } from './lib/diag';

/** Сколько ждём появления нового экрана, прежде чем счесть переход зависшим. */
const TRANSITION_GRACE_MS = 1200;

export default function App() {
  const screen = useApp((s) => s.screen);
  const go = useApp((s) => s.go);
  const [safeMotion, setSafeMotion] = useState(false);

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
   * (энергосбережение, разделённый экран, шторка уведомлений). Тогда переход
   * не завершается никогда — игрок видит чёрный экран, хотя сокет жив.
   */
  useEffect(() => {
    if (safeMotion) return;
    const timer = setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-screen="${screen}"]`);
      if (!el) {
        diag('переход завис', `экран «${screen}» не появился`);
        setSafeMotion(true);
        return;
      }
      if (parseFloat(getComputedStyle(el).opacity) < 0.9) {
        diag('переход завис', `экран «${screen}» остался прозрачным`);
        setSafeMotion(true);
      }
    }, TRANSITION_GRACE_MS);
    return () => clearTimeout(timer);
  }, [screen, safeMotion]);

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
      {screen === 'settings' && <SettingsScreen key="settings" />}
      {screen === 'net' && <NetScreen key="net" />}
      {screen === 'games' && <GamesScreen key="games" />}
    </>
  );

  return (
    <SafeMotion.Provider value={safeMotion}>
      <div className={`app-shell ${safeMotion ? 'safe-motion' : ''}`}>
        <div className="table-bg" />
        <div className="felt" />
        <ErrorBoundary onReset={() => go('home')}>
          {safeMotion ? screens : <AnimatePresence mode="wait">{screens}</AnimatePresence>}
        </ErrorBoundary>
      </div>
    </SafeMotion.Provider>
  );
}
