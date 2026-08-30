import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../store/appStore';

/* ───────────────────────────── звук ───────────────────────────── */
/* Всё синтезируется на WebAudio — ни одного звукового файла в APK. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone({
  freq,
  duration = 0.16,
  type = 'sine',
  gain = 0.12,
  delay = 0,
  sweepTo,
}: {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const env = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), t0 + duration);
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(env).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

function noise({
  duration = 0.3,
  gain = 0.14,
  freq = 900,
  q = 1,
  delay = 0,
  sweepTo,
}: {
  duration?: number;
  gain?: number;
  freq?: number;
  q?: number;
  delay?: number;
  sweepTo?: number;
}) {
  const ac = audio();
  if (!ac) return;
  const t0 = ac.currentTime + delay;
  const frames = Math.floor(ac.sampleRate * duration);
  const buffer = ac.createBuffer(1, frames, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = ac.createBufferSource();
  src.buffer = buffer;
  const filter = ac.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(freq, t0);
  filter.Q.value = q;
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, sweepTo), t0 + duration);

  const env = ac.createGain();
  env.gain.setValueAtTime(0.0001, t0);
  env.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

  src.connect(filter).connect(env).connect(ac.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

export type SoundName =
  | 'tap'
  | 'select'
  | 'dice'
  | 'step'
  | 'cash'
  | 'pay'
  | 'buy'
  | 'build'
  | 'card'
  | 'jail'
  | 'gavel'
  | 'turn'
  | 'win'
  | 'lose'
  | 'error';

export function play(name: SoundName) {
  if (!useApp.getState().settings.sound) return;
  switch (name) {
    case 'tap':
      tone({ freq: 500, duration: 0.05, type: 'triangle', gain: 0.06 });
      break;
    case 'select':
      tone({ freq: 640, duration: 0.08, type: 'triangle', gain: 0.09 });
      tone({ freq: 960, duration: 0.08, type: 'sine', gain: 0.05, delay: 0.05 });
      break;
    case 'dice':
      // Стук кубиков по столу.
      [0, 0.07, 0.13, 0.2].forEach((d) =>
        noise({ duration: 0.06, gain: 0.13, freq: 2200 - d * 3000, q: 2, delay: d }),
      );
      break;
    case 'step':
      tone({ freq: 720, duration: 0.04, type: 'triangle', gain: 0.05 });
      break;
    case 'cash':
      // Приятный звон кассы.
      [880, 1320, 1760].forEach((f, i) =>
        tone({ freq: f, duration: 0.22, type: 'triangle', gain: 0.1, delay: i * 0.06 }),
      );
      break;
    case 'pay':
      tone({ freq: 420, duration: 0.2, type: 'sine', gain: 0.1, sweepTo: 180 });
      noise({ duration: 0.16, gain: 0.06, freq: 700 });
      break;
    case 'buy':
      tone({ freq: 523, duration: 0.16, type: 'triangle', gain: 0.11 });
      tone({ freq: 784, duration: 0.22, type: 'triangle', gain: 0.1, delay: 0.1 });
      tone({ freq: 1046, duration: 0.26, type: 'sine', gain: 0.08, delay: 0.2 });
      break;
    case 'build':
      // Удар молотка.
      noise({ duration: 0.14, gain: 0.18, freq: 900, sweepTo: 260, q: 1.2 });
      tone({ freq: 220, duration: 0.16, type: 'square', gain: 0.08, sweepTo: 110 });
      break;
    case 'card':
      noise({ duration: 0.18, gain: 0.09, freq: 3200, sweepTo: 1400, q: 1.5 });
      tone({ freq: 900, duration: 0.14, type: 'sine', gain: 0.06, delay: 0.08 });
      break;
    case 'jail':
      noise({ duration: 0.4, gain: 0.16, freq: 400, sweepTo: 130, q: 0.7 });
      tone({ freq: 160, duration: 0.36, type: 'square', gain: 0.09, sweepTo: 70 });
      break;
    case 'gavel':
      noise({ duration: 0.1, gain: 0.2, freq: 800, sweepTo: 240, q: 1.4 });
      noise({ duration: 0.1, gain: 0.18, freq: 800, sweepTo: 240, q: 1.4, delay: 0.14 });
      break;
    case 'turn':
      tone({ freq: 700, duration: 0.13, type: 'triangle', gain: 0.08 });
      tone({ freq: 1050, duration: 0.17, type: 'sine', gain: 0.06, delay: 0.08 });
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, duration: 0.36, type: 'triangle', gain: 0.11, delay: i * 0.1 }),
      );
      break;
    case 'lose':
      [392, 329.63, 261.63, 196].forEach((f, i) =>
        tone({ freq: f, duration: 0.34, type: 'sine', gain: 0.09, delay: i * 0.13 }),
      );
      break;
    case 'error':
      tone({ freq: 200, duration: 0.18, type: 'square', gain: 0.07, sweepTo: 140 });
      break;
  }
}

/* ──────────────────────────── вибрация ─────────────────────────── */

const native = () => Capacitor.isNativePlatform();

export function haptic(
  kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light',
) {
  if (!useApp.getState().settings.haptics) return;
  if (native()) {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning });
    else if (kind === 'error') void Haptics.notification({ type: NotificationType.Error });
    else
      void Haptics.impact({
        style:
          kind === 'heavy'
            ? ImpactStyle.Heavy
            : kind === 'medium'
              ? ImpactStyle.Medium
              : ImpactStyle.Light,
      });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const map = {
      light: 12,
      medium: 24,
      heavy: 46,
      success: [18, 40, 18],
      warning: [26, 50, 26],
      error: [60, 60, 60],
    };
    navigator.vibrate(map[kind] as number | number[]);
  }
}

/** Короткий отклик на нажатие: звук + вибрация. */
export function tap(sound: SoundName = 'tap') {
  play(sound);
  haptic('light');
}
