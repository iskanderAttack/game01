import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useApp } from './store/appStore';
import './styles/global.css';
import './styles/game.css';

// Доступ к состоянию из консоли — только в режиме разработки.
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__app = useApp;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
