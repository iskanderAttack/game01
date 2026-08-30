import { useEffect } from 'react';
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

export default function App() {
  const screen = useApp((s) => s.screen);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    void StatusBar.setStyle({ style: Style.Dark });
    void StatusBar.setOverlaysWebView({ overlay: true });
  }, []);

  // Аппаратная кнопка «назад» на Android.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    void import('@capacitor/app').then(({ App: CapApp }) => {
      void CapApp.addListener('backButton', () => {
        const s = useApp.getState();
        if (s.screen === 'home') void CapApp.exitApp();
        else if (s.screen === 'game' || s.screen === 'results') s.go('home');
        else s.go('home');
      }).then((h) => {
        remove = () => void h.remove();
      });
    });
    return () => remove?.();
  }, []);

  return (
    <div className="app-shell">
      <div className="aurora" />
      <div className="grain" />
      <AnimatePresence mode="wait">
        {screen === 'home' && <HomeScreen key="home" />}
        {screen === 'modes' && <ModesScreen key="modes" />}
        {screen === 'setup' && <SetupScreen key="setup" />}
        {screen === 'game' && <GameScreen key="game" />}
        {screen === 'results' && <ResultsScreen key="results" />}
        {screen === 'academy' && <AcademyScreen key="academy" />}
        {screen === 'strategies' && <StrategiesScreen key="strategies" />}
        {screen === 'settings' && <SettingsScreen key="settings" />}
        {screen === 'net' && <NetScreen key="net" />}
      </AnimatePresence>
    </div>
  );
}
