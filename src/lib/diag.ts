/**
 * Кольцевой журнал последних событий.
 * Нужен, чтобы после сбоя на чужом телефоне можно было понять,
 * что происходило, не подключая устройство к компьютеру.
 */
const MAX = 50;

export interface DiagEntry {
  at: number;
  tag: string;
  info?: string;
}

const entries: DiagEntry[] = [];
const listeners = new Set<() => void>();

export function diag(tag: string, info?: string) {
  entries.push({ at: Date.now(), tag, info });
  if (entries.length > MAX) entries.shift();
  listeners.forEach((l) => l());
}

export function diagEntries(): DiagEntry[] {
  return entries;
}

export function subscribeDiag(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function diagText(): string {
  const ua = navigator.userAgent;
  const head = `Дилемма заключённого · журнал\n${new Date().toISOString()}\n${ua}\n\n`;
  return (
    head +
    entries
      .map((e) => {
        const t = new Date(e.at).toLocaleTimeString('ru-RU');
        return `${t}  ${e.tag}${e.info ? ' — ' + e.info : ''}`;
      })
      .join('\n')
  );
}

// Ловим то, что не поймал ErrorBoundary: ошибки вне отрисовки.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => diag('ошибка', e.message));
  window.addEventListener('unhandledrejection', (e) =>
    diag('обещание отклонено', String((e as PromiseRejectionEvent).reason).slice(0, 160)),
  );
}
