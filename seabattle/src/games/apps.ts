import { registerPlugin, Capacitor } from '@capacitor/core';

export interface AppsPlugin {
  /** Установлено ли приложение с таким идентификатором. */
  isInstalled(options: { packageId: string }): Promise<{ installed: boolean }>;
  /** Запустить установленное приложение. */
  openApp(options: { packageId: string }): Promise<void>;
  /** Открыть ссылку во внешнем браузере. */
  openUrl(options: { url: string }): Promise<void>;
}

class AppsWeb implements AppsPlugin {
  // В браузере узнать про установленные приложения нельзя — считаем, что их нет.
  isInstalled() {
    return Promise.resolve({ installed: false });
  }
  openApp() {
    return Promise.reject(new Error('Доступно только в приложении на Android'));
  }
  openUrl({ url }: { url: string }) {
    window.open(url, '_blank', 'noopener');
    return Promise.resolve();
  }
}

export const Apps = registerPlugin<AppsPlugin>('Apps', { web: () => new AppsWeb() });

export const hasNativeApps = () => Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Apps');

/** Проверяет установку сразу нескольких игр. */
export async function checkInstalled(packageIds: string[]): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {};
  for (const packageId of packageIds) {
    try {
      const { installed } = await Apps.isInstalled({ packageId });
      out[packageId] = installed;
    } catch {
      out[packageId] = false;
    }
  }
  return out;
}

export async function openExternal(url: string) {
  try {
    await Apps.openUrl({ url });
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
