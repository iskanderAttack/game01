import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../store/appStore';

/* ───────────────────────────── звук ───────────────────────────── */
/* Синтез на WebAudio — ни одного файла в APK. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface ToneOptions {
  freq: number;
  duration?: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweepTo?: number;
}

function tone({ freq, duration = 0.16, type = 'sine', gain = 0.14, delay = 0, sweepTo }: ToneOptions) {
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

export type SoundName =
  | 'tap'
  | 'select'
  | 'flip'
  | 'coop'
  | 'defect'
  | 'reveal'
  | 'win'
  | 'lose'
  | 'event'
  | 'tick';

export function play(name: SoundName) {
  if (!useApp.getState().settings.sound) return;
  switch (name) {
    case 'tap':
      tone({ freq: 520, duration: 0.05, type: 'triangle', gain: 0.07 });
      break;
    case 'select':
      tone({ freq: 660, duration: 0.09, type: 'triangle', gain: 0.1 });
      tone({ freq: 990, duration: 0.09, type: 'sine', gain: 0.06, delay: 0.05 });
      break;
    case 'flip':
      tone({ freq: 340, duration: 0.11, type: 'square', gain: 0.05, sweepTo: 720 });
      break;
    case 'coop':
      [523.25, 659.25, 783.99].forEach((f, i) =>
        tone({ freq: f, duration: 0.22, type: 'sine', gain: 0.1, delay: i * 0.06 }),
      );
      break;
    case 'defect':
      tone({ freq: 220, duration: 0.28, type: 'sawtooth', gain: 0.09, sweepTo: 90 });
      break;
    case 'reveal':
      tone({ freq: 880, duration: 0.14, type: 'sine', gain: 0.08, sweepTo: 1320 });
      break;
    case 'win':
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone({ freq: f, duration: 0.34, type: 'triangle', gain: 0.11, delay: i * 0.1 }),
      );
      break;
    case 'lose':
      [392, 329.63, 261.63].forEach((f, i) =>
        tone({ freq: f, duration: 0.3, type: 'sine', gain: 0.09, delay: i * 0.12 }),
      );
      break;
    case 'event':
      tone({ freq: 740, duration: 0.18, type: 'triangle', gain: 0.09 });
      tone({ freq: 1110, duration: 0.22, type: 'sine', gain: 0.07, delay: 0.09 });
      break;
    case 'tick':
      tone({ freq: 1200, duration: 0.03, type: 'square', gain: 0.045 });
      break;
  }
}

/* ──────────────────────────── вибрация ─────────────────────────── */

const native = () => Capacitor.isNativePlatform();

export function haptic(kind: 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error' = 'light') {
  if (!useApp.getState().settings.haptics) return;
  if (native()) {
    if (kind === 'success') void Haptics.notification({ type: NotificationType.Success });
    else if (kind === 'warning') void Haptics.notification({ type: NotificationType.Warning });
    else if (kind === 'error') void Haptics.notification({ type: NotificationType.Error });
    else
      void Haptics.impact({
        style:
          kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light,
      });
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    const map = { light: 12, medium: 24, heavy: 42, success: [18, 40, 18], warning: [26, 50, 26], error: [50, 60, 50] };
    navigator.vibrate(map[kind] as number | number[]);
  }
}

/** Короткий отклик на нажатие: звук + вибрация. */
export function tap(sound: SoundName = 'tap') {
  play(sound);
  haptic('light');
}
