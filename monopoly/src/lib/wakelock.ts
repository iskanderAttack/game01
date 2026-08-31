import { useEffect } from 'react';

type Sentinel = { released: boolean; release: () => Promise<void> };

/**
 * Держит экран включённым, пока идёт партия.
 *
 * Погасший экран замораживает WebView и роняет сокет — из-за этого игрок
 * выпадал из сетевой партии. Само переподключение теперь надёжное, но проще
 * не доводить до обрыва. Где API нет — просто ничего не происходит.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<Sentinel> };
    };
    if (!nav.wakeLock) return;

    let sentinel: Sentinel | null = null;
    let dropped = false;

    const acquire = async () => {
      if (dropped || document.hidden) return;
      try {
        sentinel = await nav.wakeLock!.request('screen');
      } catch {
        /* батарея на исходе или запрет системы — не беда */
      }
    };

    // Блокировку снимает сама система, когда экран уходит: берём заново.
    const onVisible = () => {
      if (!document.hidden) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      dropped = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => {});
    };
  }, [active]);
}
