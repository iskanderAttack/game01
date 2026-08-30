import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
import { useApp } from '../store/appStore';

/* ───────────────────────────── звук ───────────────────────────── */
/* Всё синтезируется на WebAudio — ни одного звукового файла в APK. */

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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

function tone({ freq, duration = 0.16, type = 'sine', gain = 0.12, delay = 0, sweepTo }: ToneOptions) {
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

/** Шум прибоя и взрывов: белый шум через полосовой фильтр. */
function noise({ duration = 0.3, gain = 0.16, freq = 900, q = 1, delay = 0, sweepTo }: {
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
  | 'place'
  | 'rotate'
  | 'splash'
  | 'hit'
  | 'sunk'
  | 'sonar'
  | 'mine'
  | 'win'
  | 'lose'
  | 'turn'
  | 'tick';

export function play(name: SoundName) {
  if (!useApp.getState().settings.sound) return;
  switch (name) {
    case 'tap':
      tone({ freq: 480, duration: 0.05, type: 'triangle', gain: 0.06 });
      break;
    case 'select':
      tone({ freq: 620, duration: 0.08, type: 'triangle', gain: 0.09 });
      tone({ freq: 930, duration: 0.08, type: 'sine', gain: 0.05, delay: 0.05 });
      break;
    case 'place':
      tone({ freq: 180, duration: 0.1, type: 'sine', gain: 0.11, sweepTo: 120 });
      noise({ duration: 0.12, gain: 0.06, freq: 400 });
      break;
    case 'rotate':
      tone({ freq: 420, duration: 0.07, type: 'square', gain: 0.05, sweepTo: 620 });
      break;
    case 'splash':
      // Всплеск: короткий шум с уходом частоты вниз.
      noise({ duration: 0.34, gain: 0.15, freq: 1500, sweepTo: 380, q: 0.8 });
      tone({ freq: 300, duration: 0.14, type: 'sine', gain: 0.05, sweepTo: 160, delay: 0.02 });
      break;
    case 'hit':
      noise({ duration: 0.32, gain: 0.22, freq: 320, sweepTo: 90, q: 0.6 });
      tone({ freq: 150, duration: 0.26, type: 'sawtooth', gain: 0.12, sweepTo: 55 });
      break;
    case 'sunk':
      noise({ duration: 0.6, gain: 0.26, freq: 260, sweepTo: 60, q: 0.5 });
      tone({ freq: 120, duration: 0.5, type: 'sawtooth', gain: 0.14, sweepTo: 40 });
      [196, 165, 131].forEach((f, i) =>
        tone({ freq: f, duration: 0.34, type: 'triangle', gain: 0.09, delay: 0.18 + i * 0.11 }),
      );
      break;
    case 'sonar':
      tone({ freq: 1180, duration: 0.5, type: 'sine', gain: 0.1, sweepTo: 880 });
      tone({ freq: 1180, duration: 0.4, type: 'sine', gain: 0.05, delay: 0.28, sweepTo: 900 });
      break;
    case 'mine':
      noise({ duration: 0.5, gain: 0.24, freq: 200, sweepTo: 70, q: 0.5 });
      tone({ freq: 90, duration: 0.42, type: 'square', gain: 0.1, sweepTo: 40 });
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
    case 'turn':
      tone({ freq: 760, duration: 0.14, type: 'triangle', gain: 0.08 });
      tone({ freq: 1140, duration: 0.18, type: 'sine', gain: 0.06, delay: 0.08 });
      break;
    case 'tick':
      tone({ freq: 1250, duration: 0.03, type: 'square', gain: 0.04 });
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
