import { memo, useId } from 'react';
import { getCharacter, type Character } from '../../game/characters';
import { getItem, type Outfit } from '../../game/wardrobe';

/**
 * Фигурка-зверушка.
 *
 * Рисуется слоями: хвост → тело → одежда → голова → уши → морда → глаза →
 * очки → шея → головной убор → предмет в руке. Точки крепления одинаковы у
 * всех зверей, поэтому любая вещь надевается на любую фигурку.
 *
 * Объём даётся не трёхмерной сценой, а честной графикой: градиент по телу,
 * блик сверху, тень снизу и мягкий контур. На слабом телефоне это столь же
 * дёшево, как обычная картинка.
 */

export type CritterMood = 'idle' | 'happy' | 'sad' | 'walk';

const W = 100;
const H = 132;

export const Critter = memo(function Critter({
  characterId,
  outfit = {},
  size = 64,
  /** Сдвиг фазы покачивания: у каждого игрока своё дыхание. */
  phase = 0,
  mood = 'idle',
  animate = true,
  accent,
  className = '',
}: {
  characterId?: string;
  outfit?: Outfit;
  size?: number;
  phase?: number;
  mood?: CritterMood;
  animate?: boolean;
  accent?: string;
  className?: string;
}) {
  const c = getCharacter(characterId);
  const uid = useId().replace(/:/g, '');
  const cloth = accent ?? c.accent;

  const delay = `${(-phase * 0.37).toFixed(2)}s`;
  const anim = animate ? 'critter-alive' : '';

  return (
    <svg
      className={`critter ${anim} mood-${mood} ${className}`}
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={(size * H) / W}
      style={{ ['--critter-delay' as string]: delay }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`body-${uid}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={lighten(c.body, 0.18)} />
          <stop offset="55%" stopColor={c.body} />
          <stop offset="100%" stopColor={c.shade} />
        </linearGradient>
        <linearGradient id={`head-${uid}`} x1="0.25" y1="0" x2="0.75" y2="1">
          <stop offset="0%" stopColor={lighten(c.body, 0.26)} />
          <stop offset="60%" stopColor={c.body} />
          <stop offset="100%" stopColor={c.shade} />
        </linearGradient>
        <linearGradient id={`cloth-${uid}`} x1="0.3" y1="0" x2="0.7" y2="1">
          <stop offset="0%" stopColor={lighten(cloth, 0.22)} />
          <stop offset="100%" stopColor={darken(cloth, 0.24)} />
        </linearGradient>
        <radialGradient id={`gloss-${uid}`} cx="0.32" cy="0.22" r="0.55">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Тень под ногами — она же «прижимает» фигурку к клетке. */}
      <ellipse className="critter-shadow" cx="50" cy="127" rx="27" ry="6.5" />

      <g className="critter-sway" style={{ animationDelay: delay }}>
        <Tail c={c} uid={uid} />

        {/* Тело */}
        <path
          d="M50 58c17 0 27 13 28 30 1 15-3 30-6 36-2 4-9 5-22 5s-20-1-22-5c-3-6-7-21-6-36 1-17 11-30 28-30z"
          fill={`url(#body-${uid})`}
        />
        <ellipse cx="50" cy="102" rx="17" ry="21" fill={c.belly} opacity="0.85" />

        <Torso itemId={outfit.torso} uid={uid} c={c} />

        {/* Лапы */}
        <ellipse cx="36" cy="124" rx="10" ry="5.5" fill={c.shade} />
        <ellipse cx="64" cy="124" rx="10" ry="5.5" fill={c.shade} />

        <Neck itemId={outfit.neck} c={c} />
        <Hand itemId={outfit.hand} />

        <g className="critter-head" style={{ animationDelay: delay }}>
          <Ears c={c} />
          <circle cx="50" cy="41" r="27" fill={`url(#head-${uid})`} />
          <circle cx="50" cy="41" r="27" fill={`url(#gloss-${uid})`} />
          <Muzzle c={c} />
          <Eyes delay={delay} />
          <Eyewear itemId={outfit.eyes} />
          <Headwear itemId={outfit.head} />
        </g>
      </g>
    </svg>
  );
});

/* ───────────────────────────── части тела ───────────────────────────── */

function Ears({ c }: { c: Character }) {
  const inner = c.belly;
  switch (c.ear) {
    case 'round':
      return (
        <g>
          <circle cx="28" cy="22" r="11" fill={c.shade} />
          <circle cx="72" cy="22" r="11" fill={c.shade} />
          <circle cx="28" cy="22" r="5.5" fill={inner} />
          <circle cx="72" cy="22" r="5.5" fill={inner} />
        </g>
      );
    case 'pointy':
      return (
        <g>
          <path d="M31 26 26 2l19 14z" fill={c.shade} />
          <path d="M69 26 74 2 55 16z" fill={c.shade} />
          <path d="M32 22 30 9l10 8z" fill={inner} />
          <path d="M68 22 70 9 60 17z" fill={inner} />
        </g>
      );
    case 'long':
      return (
        <g>
          <ellipse cx="36" cy="10" rx="7.5" ry="20" fill={c.shade} transform="rotate(-9 36 10)" />
          <ellipse cx="64" cy="10" rx="7.5" ry="20" fill={c.shade} transform="rotate(9 64 10)" />
          <ellipse cx="36" cy="12" rx="3.6" ry="13" fill={inner} transform="rotate(-9 36 12)" />
          <ellipse cx="64" cy="12" rx="3.6" ry="13" fill={inner} transform="rotate(9 64 12)" />
        </g>
      );
    case 'tuft':
      return (
        <g>
          <path d="M33 20 30 4l14 11z" fill={c.shade} />
          <path d="M67 20 70 4 56 15z" fill={c.shade} />
        </g>
      );
    case 'horn':
      return (
        <g>
          <circle cx="30" cy="24" r="8" fill={c.shade} />
          <circle cx="70" cy="24" r="8" fill={c.shade} />
          <path d="M50 16 45 20l5 -19 5 19z" fill="#F2C75C" />
          <path d="M46 12h8M45.5 16h9" stroke="#D6A63C" strokeWidth="1.4" />
        </g>
      );
    default:
      return (
        <g>
          <circle cx="30" cy="26" r="6" fill={c.shade} />
          <circle cx="70" cy="26" r="6" fill={c.shade} />
        </g>
      );
  }
}

function Muzzle({ c }: { c: Character }) {
  if (c.muzzle === 'beak') {
    return (
      <g>
        <path d="M50 44 60 52 50 60 40 52z" fill={c.nose} />
        <path d="M50 52 60 52 50 60z" fill={darken(c.nose, 0.2)} />
      </g>
    );
  }

  const rx = c.muzzle === 'long' ? 15 : c.muzzle === 'wide' ? 18 : 13;
  const ry = c.muzzle === 'long' ? 13 : 10;
  const cy = c.muzzle === 'long' ? 54 : 52;

  return (
    <g>
      <ellipse cx="50" cy={cy} rx={rx} ry={ry} fill={c.belly} />
      <ellipse cx="50" cy={cy - 4} rx="4.6" ry="3.4" fill={c.nose} />
      <path
        d={`M50 ${cy - 1}v4M50 ${cy + 3}q-4 3-7 0M50 ${cy + 3}q4 3 7 0`}
        stroke={c.nose}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
    </g>
  );
}

function Eyes({ delay }: { delay: string }) {
  return (
    <g className="critter-eyes" style={{ animationDelay: delay }}>
      <ellipse cx="40" cy="38" rx="4.4" ry="5.2" fill="#20242E" />
      <ellipse cx="60" cy="38" rx="4.4" ry="5.2" fill="#20242E" />
      <circle cx="41.6" cy="36" r="1.7" fill="#fff" />
      <circle cx="61.6" cy="36" r="1.7" fill="#fff" />
    </g>
  );
}

function Tail({ c, uid }: { c: Character; uid: string }) {
  if (c.tail === 'none') return null;
  return (
    <g className="critter-tail">
      {c.tail === 'bushy' && (
        <>
          <path
            d="M24 96c-14-2-20-14-16-25 3-9 12-12 16-6 4 7 2 14 4 20z"
            fill={c.shade}
          />
          <path d="M13 76c-2 6-1 12 4 16 2-6 1-12-4-16z" fill={c.belly} opacity="0.8" />
        </>
      )}
      {c.tail === 'thin' && (
        <path
          d="M25 100c-12 0-18-8-16-18"
          stroke={c.shade}
          strokeWidth="7"
          strokeLinecap="round"
          fill="none"
        />
      )}
      {c.tail === 'round' && <circle cx="23" cy="96" r="9" fill={c.shade} />}
      <ellipse cx="0" cy="0" rx="0" ry="0" fill={`url(#body-${uid})`} />
    </g>
  );
}

/* ───────────────────────────── гардероб ───────────────────────────── */

function Torso({ itemId, uid, c }: { itemId?: string; uid: string; c: Character }) {
  const it = getItem(itemId);
  if (!it) return null;
  const fill = `url(#cloth-${uid})`;

  switch (it.id) {
    case 'vest':
      return (
        <g>
          <path d="M34 78c4 22 4 34 3 44h-6c-3-14-4-30-2-44z" fill={fill} />
          <path d="M66 78c-4 22-4 34-3 44h6c3-14 4-30 2-44z" fill={fill} />
        </g>
      );
    case 'shirt':
      return (
        <g>
          <path d="M33 78c-2 16-2 32 0 44h34c2-12 2-28 0-44z" fill="#F3F1EA" />
          <path d="M50 78 43 86l7 6 7-6z" fill={c.belly} />
        </g>
      );
    case 'suit':
      return (
        <g>
          <path d="M33 78c-2 16-2 32 0 44h34c2-12 2-28 0-44z" fill="#242B3C" />
          <path d="M44 78c2 10 4 16 6 22 2-6 4-12 6-22z" fill="#F3F1EA" />
          <path d="M33 78c4 12 8 20 10 26l-4 18h-6c-2-14-2-30 0-44z" fill={fill} />
        </g>
      );
    case 'fur':
      return (
        <g>
          <path d="M30 76c-3 18-3 34-1 48h42c2-14 2-30-1-48z" fill="#4A3B57" />
          <path
            d="M30 76q6 5 10 0 6 5 10 0 6 5 10 0 6 5 10 0"
            stroke="#7C6790"
            strokeWidth="4"
            fill="none"
          />
        </g>
      );
    default:
      return null;
  }
}

function Neck({ itemId, c }: { itemId?: string; c: Character }) {
  const it = getItem(itemId);
  if (!it) return null;

  switch (it.id) {
    case 'scarf':
      return (
        <g>
          <path d="M32 68q18 9 36 0v9q-18 8-36 0z" fill="#C2453F" />
          <path d="M60 74l5 18-7 2-3-18z" fill="#A83833" />
        </g>
      );
    case 'tie':
      return (
        <g>
          <path d="M45 70h10l-2 6h-6z" fill="#2B3446" />
          <path d="M47 77h6l3 18-6 6-6-6z" fill="#B4443E" />
        </g>
      );
    case 'bowtie':
      return (
        <g>
          <path d="M50 74 38 68v14z" fill="#1E2433" />
          <path d="M50 74 62 68v14z" fill="#1E2433" />
          <rect x="46" y="70" width="8" height="8" rx="2.4" fill="#39435C" />
        </g>
      );
    case 'medal':
      return (
        <g>
          <path d="M43 68 50 88 57 68" stroke="#C2453F" strokeWidth="5" fill="none" />
          <circle cx="50" cy="93" r="8.5" fill="#F0C674" stroke="#C9974A" strokeWidth="1.5" />
          <path d="M50 87.5l1.8 3.7 4 .6-2.9 2.8.7 4-3.6-1.9-3.6 1.9.7-4-2.9-2.8 4-.6z" fill="#8A6520" />
        </g>
      );
    default:
      return null;
  }
}

function Eyewear({ itemId }: { itemId?: string }) {
  const it = getItem(itemId);
  if (!it) return null;

  switch (it.id) {
    case 'glasses':
      return (
        <g fill="none" stroke="#2C3346" strokeWidth="2.2">
          <circle cx="40" cy="38" r="8.5" fill="#DCE6F2" fillOpacity="0.35" />
          <circle cx="60" cy="38" r="8.5" fill="#DCE6F2" fillOpacity="0.35" />
          <path d="M48.5 38h3M31.5 36l-6-2M68.5 36l6-2" />
        </g>
      );
    case 'shades':
      return (
        <g>
          <rect x="30" y="31" width="18" height="13" rx="4" fill="#1C2130" />
          <rect x="52" y="31" width="18" height="13" rx="4" fill="#1C2130" />
          <path d="M48 36h4M30 34l-5-2M70 34l5-2" stroke="#1C2130" strokeWidth="2.4" fill="none" />
        </g>
      );
    case 'aviators':
      return (
        <g>
          <path d="M31 32h16q1 12-8 12t-8-12z" fill="#3A4256" stroke="#F0C674" strokeWidth="2" />
          <path d="M53 32h16q0 12-8 12t-8-12z" fill="#3A4256" stroke="#F0C674" strokeWidth="2" />
          <path d="M47 34h6M31 32l-6-2M69 32l6-2" stroke="#F0C674" strokeWidth="2" fill="none" />
        </g>
      );
    case 'monocle':
      return (
        <g>
          <circle cx="60" cy="38" r="10" fill="#DCE6F2" fillOpacity="0.4" stroke="#F0C674" strokeWidth="2.4" />
          <path d="M60 48q2 12 -6 16" stroke="#F0C674" strokeWidth="1.6" fill="none" />
        </g>
      );
    default:
      return null;
  }
}

function Headwear({ itemId }: { itemId?: string }) {
  const it = getItem(itemId);
  if (!it) return null;

  switch (it.id) {
    case 'cap':
      return (
        <g>
          <path d="M28 22q22-16 44 0v4H28z" fill="#C2453F" />
          <path d="M72 22q10 1 13 6-9 3-13 1z" fill="#A83833" />
        </g>
      );
    case 'hat':
      return (
        <g>
          <ellipse cx="50" cy="24" rx="30" ry="7" fill="#4A3B2E" />
          <path d="M35 24q1-18 15-18t15 18z" fill="#5C4A38" />
          <path d="M35 21h30v4H35z" fill="#2F2419" />
        </g>
      );
    case 'tophat':
      return (
        <g>
          <ellipse cx="50" cy="22" rx="30" ry="7" fill="#1C2130" />
          <rect x="36" y="-8" width="28" height="30" rx="2" fill="#252C3E" />
          <rect x="36" y="14" width="28" height="6" fill="#C2453F" />
        </g>
      );
    case 'crown':
      return (
        <g>
          <path d="M30 22 27 2l11 8 12-12 12 12 11-8-3 20z" fill="#F0C674" stroke="#C9974A" strokeWidth="1.4" />
          <circle cx="50" cy="10" r="3" fill="#C2453F" />
          <circle cx="36" cy="14" r="2.2" fill="#4E9BD8" />
          <circle cx="64" cy="14" r="2.2" fill="#4E9BD8" />
        </g>
      );
    default:
      return null;
  }
}

function Hand({ itemId }: { itemId?: string }) {
  const it = getItem(itemId);
  if (!it) return null;

  const body: Record<string, { fill: string; trim: string }> = {
    bag: { fill: '#8A6A4E', trim: '#6A4F38' },
    briefcase: { fill: '#4A3325', trim: '#2F2016' },
    diplomat: { fill: '#20263A', trim: '#39435C' },
    goldcase: { fill: '#F0C674', trim: '#C9974A' },
  };
  const skin = body[it.id] ?? body.bag;

  return (
    <g className="critter-hand">
      <rect x="70" y="94" width="24" height="18" rx="3" fill={skin.fill} />
      <rect x="70" y="99" width="24" height="3" fill={skin.trim} />
      <path d="M78 94v-5h8v5" stroke={skin.trim} strokeWidth="2.4" fill="none" />
      {it.id === 'goldcase' && <circle cx="82" cy="106" r="2.4" fill="#8A6520" />}
    </g>
  );
}

/* ───────────────────────────── цвет ───────────────────────────── */

function mix(hex: string, target: number, amount: number): string {
  const m = /^#?([\da-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.round(v + (target - v) * amount),
  );
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

const lighten = (hex: string, amount: number) => mix(hex, 255, amount);
const darken = (hex: string, amount: number) => mix(hex, 0, amount);
