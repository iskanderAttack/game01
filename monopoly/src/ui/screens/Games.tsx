import { useEffect, useState } from 'react';
import { useApp } from '../../store/appStore';
import { GAMES, RELEASES_URL, SELF_ID, otherGames } from '../../games/catalog';
import { Apps, checkInstalled, hasNativeApps, openExternal } from '../../games/apps';
import { Screen, SectionTitle, TopBar } from '../components/Shell';
import { tap } from '../../lib/feedback';

export function GamesScreen() {
  const go = useApp((s) => s.go);
  const [installed, setInstalled] = useState<Record<string, boolean>>({});
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const map = await checkInstalled(otherGames().map((g) => g.packageId));
      if (!cancelled) {
        setInstalled(map);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const others = otherGames();
  const missing = others.filter((g) => !installed[g.packageId]);

  return (
    <Screen name="games">
      <TopBar title="Наши игры" subtitle="Одна компания, разные вечера" onBack={() => go('home')} />

      <div className="scroll">
        {!hasNativeApps() && (
          <div className="notice">
            В браузере нельзя узнать, что установлено на телефоне. В приложении на Android
            установленные игры открываются одной кнопкой.
          </div>
        )}

        {missing.length > 0 && !checking && (
          <div className="notice good">
            {missing.length === 1
              ? `«${missing[0].name}» ещё не стоит на этом телефоне.`
              : `Ещё не установлено игр: ${missing.length}.`}
          </div>
        )}

        <SectionTitle>Сейчас у вас открыта</SectionTitle>
        {GAMES.filter((g) => g.id === SELF_ID).map((g) => (
          <div key={g.id} className="game-promo installed">
            <span className="game-promo-emoji">{g.emoji}</span>
            <div className="grow">
              <div className="game-promo-name">{g.name}</div>
              <div className="game-promo-note">{g.tagline}</div>
            </div>
            <span className="chip on">вы здесь</span>
          </div>
        ))}

        <SectionTitle>Другие игры</SectionTitle>
        {others.map((g) => {
          const has = installed[g.packageId];
          return (
            <div key={g.id} className={`game-promo ${has ? 'installed' : ''}`}>
              <span className="game-promo-emoji">{g.emoji}</span>
              <div className="grow">
                <div className="game-promo-name">{g.name}</div>
                <div className="game-promo-note">{g.tagline}</div>
              </div>
              {has ? (
                <button
                  className="btn small"
                  onClick={() => {
                    tap('select');
                    void Apps.openApp({ packageId: g.packageId }).catch(() => openExternal(g.downloadUrl));
                  }}
                >
                  Открыть
                </button>
              ) : (
                <button
                  className="btn small primary"
                  onClick={() => {
                    tap('select');
                    void openExternal(g.downloadUrl);
                  }}
                >
                  Скачать
                </button>
              )}
            </div>
          );
        })}

        <div className="card">
          <span className="label">Как ставить</span>
          <p className="muted" style={{ marginTop: 8, fontSize: 13.5 }}>
            Кнопка «Скачать» открывает страницу со сборками. Найдите нужную игру, скачайте файл
            APK и откройте его — Android попросит разрешить установку из этого источника. Игры
            бесплатные, без рекламы и без сбора данных.
          </p>
          <button
            className="btn block"
            style={{ marginTop: 12 }}
            onClick={() => {
              tap();
              void openExternal(RELEASES_URL);
            }}
          >
            Открыть страницу со всеми сборками
          </button>
        </div>
      </div>
    </Screen>
  );
}
