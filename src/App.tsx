/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Dices,
  Hash,
  Compass,
  Coins,
  Volume2,
  VolumeX,
  ArrowLeft,
  ChevronDown,
  Sparkles,
  RotateCcw,
  History,
  Check,
  Trophy,
  Gamepad2,
  Layers,
  Copy,
  Download,
  X,
  FileCode2,
  BarChart3,
} from 'lucide-react';

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

type GameModeId = 'home' | 'dice' | 'number' | 'wheel' | 'coin';

interface GameModeInfo {
  id: Exclude<GameModeId, 'home'>;
  numberLabel: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  badgeText: string;
  accentColor: string;
  playButtonText: string;
  animatingText: string;
}

interface HistoryEntry {
  id: string;
  label: string;
  subLabel?: string;
  isSpecial?: boolean;
  timestamp: string;
}

interface SavedAppData {
  historyByMode: Record<Exclude<GameModeId, 'home'>, HistoryEntry[]>;
  statsByMode: Record<Exclude<GameModeId, 'home'>, number>;
  minNumInput: string;
  maxNumInput: string;
  lastDie1: number;
  lastDie2: number;
  lastNumber: number;
  lastWheelWinner: number;
  lastCoinSide: 'king' | 'tails';
}

const STORAGE_KEY = 'arabic_randomizer_hub_data_v2';

const DEFAULT_SAVED_DATA: SavedAppData = {
  historyByMode: {
    dice: [
      { id: 'init-d1', label: '٦ + ٦ = ١٢', subLabel: 'دش الستة (٦ × ٦)', isSpecial: true, timestamp: '١٢:٠٠' },
      { id: 'init-d2', label: '٥ + ٤ = ٩', subLabel: 'المجموع ٩', isSpecial: false, timestamp: '١١:٥٨' },
    ],
    number: [
      { id: 'init-n1', label: '٧٧ (77)', subLabel: 'النطاق ١–١٠٠', isSpecial: false, timestamp: '١٢:٠٠' },
      { id: 'init-n2', label: '٤٢ (42)', subLabel: 'النطاق ١–١٠٠', isSpecial: false, timestamp: '١١:٥٥' },
    ],
    wheel: [
      { id: 'init-w1', label: 'رقم ٦ (6)', subLabel: 'ستة', isSpecial: true, timestamp: '١٢:٠٠' },
      { id: 'init-w2', label: 'رقم ٣ (3)', subLabel: 'ثلاثة', isSpecial: false, timestamp: '١١:٥٧' },
    ],
    coin: [
      { id: 'init-c1', label: 'مَلِك (قناع توت عنخ آمون)', subLabel: 'ملك', isSpecial: true, timestamp: '١٢:٠٠' },
      { id: 'init-c2', label: 'كِتَابَة (١ جنيه مصري)', subLabel: 'كتابة', isSpecial: false, timestamp: '١١:٥٦' },
    ],
  },
  statsByMode: {
    dice: 14,
    number: 23,
    wheel: 19,
    coin: 31,
  },
  minNumInput: '1',
  maxNumInput: '100',
  lastDie1: 6,
  lastDie2: 6,
  lastNumber: 77,
  lastWheelWinner: 6,
  lastCoinSide: 'king',
};

const GAME_MODES: GameModeInfo[] = [
  {
    id: 'dice',
    numberLabel: '01',
    title: 'رمي ٢ نرد عشوائي',
    shortTitle: 'رمي ٢ نرد',
    subtitle: 'نردان ثلاثيا الأبعاد مع حساب المجموع الكلي وكشف الدش المتطابق',
    badgeText: 'نرد مزدوج · ١ إلى ١٢',
    accentColor: 'from-amber-500 to-orange-600',
    playButtonText: 'العب الآن · ارمِ النردين',
    animatingText: 'جاري رمي النردين...',
  },
  {
    id: 'number',
    numberLabel: '02',
    title: 'اختيار رقم عشوائي',
    shortTitle: 'رقم عشوائي',
    subtitle: 'مولّد أرقام رقمي فائق السرعة مع تحكم كامل بالحد الأدنى والأقصى',
    badgeText: 'نطاق مخصص · قرعة ذكية',
    accentColor: 'from-cyan-500 to-blue-600',
    playButtonText: 'العب الآن · اسحب رقماً',
    animatingText: 'جاري فرز الأرقام...',
  },
  {
    id: 'wheel',
    numberLabel: '03',
    title: 'دائرة تلف بها أرقام من ١ إلى ٦',
    shortTitle: 'عجلة ١ إلى ٦',
    subtitle: 'عجلة حظ مقسمة إلى ٦ قطاعات ملونة بدوران فيزيائي سلس ومؤشر دقيق',
    badgeText: '٦ قطاعات · دوران فيزيائي',
    accentColor: 'from-emerald-500 to-teal-600',
    playButtonText: 'العب الآن · لفّ الدائرة',
    animatingText: 'الدائرة تدور الآن...',
  },
  {
    id: 'coin',
    numberLabel: '04',
    title: 'ملك وكتابة (الجنيه المصري)',
    shortTitle: 'ملك وكتابة',
    subtitle: 'عملة الجنيه المصري المعدني ثنائية المعدن بقناع توت عنخ آمون والكتابة الرسمية',
    badgeText: 'جنيه مصري · ملك أو كتابة',
    accentColor: 'from-yellow-500 to-amber-600',
    playButtonText: 'العب الآن · ارمِ العملة',
    animatingText: 'العملة في الهواء...',
  },
];

const ARABIC_DOUBLE_NAMES: Record<number, string> = {
  1: 'دش اليك (١ × ١)',
  2: 'دوبارة (٢ × ٢)',
  3: 'دوسة (٣ × ٣)',
  4: 'درجي (٤ × ٤)',
  5: 'دبش (٥ × ٥)',
  6: 'دش الستة (٦ × ٦)',
};

const WHEEL_SEGMENTS = [
  { num: 1, arabic: '١', color: '#f59e0b', darkColor: '#b45309', label: 'واحد' },
  { num: 2, arabic: '٢', color: '#06b6d4', darkColor: '#0e7490', label: 'اثنان' },
  { num: 3, arabic: '٣', color: '#10b981', darkColor: '#047857', label: 'ثلاثة' },
  { num: 4, arabic: '٤', color: '#f43f5e', darkColor: '#be123c', label: 'أربعة' },
  { num: 5, arabic: '٥', color: '#8b5cf6', darkColor: '#6d28d9', label: 'خمسة' },
  { num: 6, arabic: '٦', color: '#eab308', darkColor: '#a16207', label: 'ستة' },
];

const VERCEL_PACKAGE_JSON_SNIPPET = `{
  "name": "arabic-randomizer-gaming-hub",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "vite": "^6.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "tailwindcss": "^4.0.0",
    "typescript": "^5.7.2"
  }
}`;

const VERCEL_JSON_SNIPPET = `{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}`;

// ============================================================================
// CRYPTOGRAPHICALLY FAIR RANDOM GENERATOR & HAPTICS
// ============================================================================

function getCryptoRandomInt(min: number, max: number): number {
  const low = Math.ceil(Math.min(min, max));
  const high = Math.floor(Math.max(min, max));
  const range = high - low + 1;
  if (range <= 1) return low;

  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const maxUint32 = 0xffffffff;
    const limit = maxUint32 - (maxUint32 % range);
    const array = new Uint32Array(1);
    let randomVal = 0;
    do {
      window.crypto.getRandomValues(array);
      randomVal = array[0];
    } while (randomVal >= limit);
    return low + (randomVal % range);
  }
  return low + Math.floor(Math.random() * range);
}

function triggerHaptic(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignore on unsupported devices
  }
}

function toArabicDigits(n: number | string): string {
  const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(n).replace(/[0-9]/g, (d) => arabic[Number(d)]);
}

function loadSavedData(): SavedAppData {
  try {
    if (typeof window === 'undefined') return DEFAULT_SAVED_DATA;
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SAVED_DATA;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SAVED_DATA,
      ...parsed,
      historyByMode: {
        ...DEFAULT_SAVED_DATA.historyByMode,
        ...(parsed.historyByMode || {}),
      },
      statsByMode: {
        ...DEFAULT_SAVED_DATA.statsByMode,
        ...(parsed.statsByMode || {}),
      },
    };
  } catch {
    return DEFAULT_SAVED_DATA;
  }
}

// ============================================================================
// WEB AUDIO API SOUND SYNTHESIZER (ZERO EXTERNAL ASSETS)
// ============================================================================

class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  playClick() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.045);
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playDiceClack(delaySec = 0, pitchFactor = 1) {
    const ctx = this.getContext();
    if (!ctx) return;
    const start = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280 * pitchFactor, start);
    osc.frequency.exponentialRampToValueAtTime(95 * pitchFactor, start + 0.055);
    gain.gain.setValueAtTime(0.18, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.055);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + 0.06);
  }

  playDiceRollSequence() {
    const offsets = [0, 0.08, 0.17, 0.27, 0.38, 0.49, 0.58];
    offsets.forEach((t, i) => {
      this.playDiceClack(t, 0.85 + (i % 3) * 0.15);
    });
  }

  playDigitalTick(freq = 640) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.7, now + 0.03);
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.035);
  }

  playWheelPegTick(pitch = 1) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(720 * pitch, now);
    osc.frequency.exponentialRampToValueAtTime(210, now + 0.04);
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  playCoinMetallicClink() {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const freqs = [2480, 3720, 5120];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 0.45);
      gain.gain.setValueAtTime(0.09 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.46);
    });
  }

  playWinChime(isDoubleOrSpecial = false) {
    const ctx = this.getContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = isDoubleOrSpecial
      ? [523.25, 659.25, 783.99, 1046.5]
      : [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.36);
    });
  }
}

const soundFX = new WebAudioSynthesizer();

// ============================================================================
// CUSTOM SVG ARTWORK COMPONENTS
// ============================================================================

const Die3DCard: React.FC<{
  value: number;
  label: string;
  isRolling: boolean;
  variant: 1 | 2;
  isDouble: boolean;
}> = ({ value, label, isRolling, variant, isDouble }) => {
  const pipMap: Record<number, number[]> = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  const activeCells = pipMap[value] || [4];

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`relative w-32 h-32 sm:w-40 sm:h-40 rounded-3xl p-4 sm:p-5 select-none transition-shadow duration-300 ${
          isRolling ? (variant === 1 ? 'animate-dice-1' : 'animate-dice-2') : ''
        } ${
          isDouble && !isRolling
            ? 'bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-[0_14px_0_#b45309,0_22px_45px_rgba(245,158,11,0.45)] ring-2 ring-amber-400'
            : 'bg-gradient-to-br from-white via-slate-100 to-slate-200 shadow-[0_12px_0_#64748b,0_20px_38px_rgba(0,0,0,0.65)] ring-1 ring-white/80'
        }`}
      >
        <div className="absolute inset-1.5 rounded-2xl border border-white/70 pointer-events-none" />
        <div className="relative z-10 grid grid-cols-3 grid-rows-3 w-full h-full gap-2 sm:gap-2.5 place-items-center">
          {Array.from({ length: 9 }).map((_, idx) => {
            const hasPip = activeCells.includes(idx);
            const isCenterAce = value === 1 && idx === 4;
            return (
              <div key={idx} className="w-full h-full flex items-center justify-center">
                {hasPip && (
                  <span
                    className={`rounded-full transition-transform duration-200 ${
                      isCenterAce
                        ? 'w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-rose-500 to-red-700 shadow-[inset_0_2px_4px_rgba(0,0,0,0.45),0_1px_2px_rgba(255,255,255,0.8)]'
                        : isDouble && !isRolling
                        ? 'w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-amber-600 to-amber-900 shadow-[inset_0_2px_3px_rgba(0,0,0,0.5)]'
                        : 'w-5 h-5 sm:w-6 sm:h-6 bg-gradient-to-br from-slate-800 to-slate-950 shadow-[inset_0_2px_3px_rgba(0,0,0,0.6)]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
        <span>{label}</span>
        <span aria-hidden="true" className="text-slate-600">
          ·
        </span>
        <span className="font-mono-num font-bold text-white text-base">
          {isRolling ? '...' : `${toArabicDigits(value)} (${value})`}
        </span>
      </div>
    </div>
  );
};

const EgyptianOnePoundSVG: React.FC<{ side: 'king' | 'tails' }> = ({ side }) => {
  const uid = side === 'king' ? 'king' : 'tails';
  return (
    <svg
      viewBox="0 0 260 260"
      className="w-full h-full drop-shadow-[0_12px_25px_rgba(0,0,0,0.65)] select-none"
      aria-label={
        side === 'king'
          ? 'وجه العملة: ملك - قناع توت عنخ آمون'
          : 'ظهر العملة: كتابة - ١ جنيه مصري'
      }
    >
      <defs>
        <linearGradient id={`silverRing-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="28%" stopColor="#cbd5e1" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="80%" stopColor="#475569" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        <linearGradient id={`silverBevel-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        <radialGradient id={`goldCore-${uid}`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="30%" stopColor="#fde047" />
          <stop offset="68%" stopColor="#ca8a04" />
          <stop offset="92%" stopColor="#854d0e" />
          <stop offset="100%" stopColor="#713f12" />
        </radialGradient>

        <linearGradient id={`goldRelief-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="85%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>

      <circle
        cx="130"
        cy="130"
        r="126"
        fill={`url(#silverBevel-${uid})`}
        stroke="#64748b"
        strokeWidth="2"
      />
      <circle
        cx="130"
        cy="130"
        r="123"
        fill="none"
        stroke="#1e293b"
        strokeWidth="3"
        strokeDasharray="3 3"
        opacity="0.55"
      />
      <circle
        cx="130"
        cy="130"
        r="119"
        fill={`url(#silverRing-${uid})`}
        stroke="#e2e8f0"
        strokeWidth="1.2"
      />
      <circle
        cx="130"
        cy="130"
        r="111"
        fill="none"
        stroke="#334155"
        strokeWidth="1.5"
        strokeDasharray="2 5"
        opacity="0.65"
      />
      <circle cx="130" cy="130" r="84" fill="#475569" stroke="#1e293b" strokeWidth="2" />
      <circle
        cx="130"
        cy="130"
        r="81"
        fill={`url(#goldCore-${uid})`}
        stroke="#fef08a"
        strokeWidth="1.2"
      />
      <circle
        cx="130"
        cy="130"
        r="75"
        fill="none"
        stroke="#713f12"
        strokeWidth="1.2"
        strokeDasharray="4 3"
        opacity="0.6"
      />

      {side === 'king' ? (
        <g>
          <text
            x="130"
            y="29"
            textAnchor="middle"
            fill="#1e293b"
            fontSize="13"
            fontWeight="800"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ★ مَلِك · توت عنخ آمون ★
          </text>
          <text
            x="130"
            y="241"
            textAnchor="middle"
            fill="#1e293b"
            fontSize="11.5"
            fontWeight="700"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            العملة المصرية المعدنية
          </text>

          <circle cx="28" cy="130" r="4" fill="#334155" />
          <circle cx="232" cy="130" r="4" fill="#334155" />

          <g transform="translate(130, 128)">
            <path
              d="M -46,16 L -52,-8 C -52,-38 -30,-56 0,-56 C 30,-56 52,-38 52,-8 L 46,16 L 34,42 L -34,42 Z"
              fill={`url(#goldRelief-${uid})`}
              stroke="#713f12"
              strokeWidth="2.2"
            />
            <g stroke="#713f12" strokeWidth="1.8" opacity="0.75">
              <line x1="-47" y1="-22" x2="-24" y2="-22" />
              <line x1="24" y1="-22" x2="47" y2="-22" />
              <line x1="-50" y1="-10" x2="-25" y2="-10" />
              <line x1="25" y1="-10" x2="50" y2="-10" />
              <line x1="-48" y1="2" x2="-23" y2="2" />
              <line x1="23" y1="2" x2="48" y2="2" />
              <line x1="-45" y1="14" x2="-21" y2="14" />
              <line x1="21" y1="14" x2="45" y2="14" />
              <line x1="-39" y1="26" x2="-19" y2="26" />
              <line x1="19" y1="26" x2="39" y2="26" />
            </g>
            <path
              d="M -34,32 Q 0,48 34,32 L 28,45 Q 0,58 -28,45 Z"
              fill="#ca8a04"
              stroke="#713f12"
              strokeWidth="1.8"
            />
            <path
              d="M -23,-22 C -23,-36 23,-36 23,-22 L 21,8 C 21,23 11,32 0,32 C -11,32 -21,23 -21,8 Z"
              fill="#fef08a"
              stroke="#713f12"
              strokeWidth="2"
            />
            <path d="M -24,-22 Q 0,-27 24,-22" fill="none" stroke="#713f12" strokeWidth="2.5" />
            <circle cx="-6" cy="-35" r="5" fill="#b45309" stroke="#713f12" strokeWidth="1.5" />
            <circle cx="6" cy="-35" r="5" fill="#b45309" stroke="#713f12" strokeWidth="1.5" />
            <path d="M 0,-46 L -4,-30 L 4,-30 Z" fill="#fef08a" stroke="#713f12" strokeWidth="1.4" />
            <ellipse cx="-9" cy="-10" rx="5" ry="2.5" fill="#713f12" />
            <ellipse cx="9" cy="-10" rx="5" ry="2.5" fill="#713f12" />
            <path d="M -15,-14 Q -9,-17 -3,-14" fill="none" stroke="#713f12" strokeWidth="1.6" />
            <path d="M 3,-14 Q 9,-17 15,-14" fill="none" stroke="#713f12" strokeWidth="1.6" />
            <path d="M 0,-12 L -2.5,2 L 2.5,2" fill="none" stroke="#713f12" strokeWidth="1.6" />
            <path d="M -7,10 Q 0,14 7,10" fill="none" stroke="#713f12" strokeWidth="1.8" />
            <path
              d="M -5,30 L 5,30 L 4,56 Q 0,60 -4,56 Z"
              fill="#a16207"
              stroke="#713f12"
              strokeWidth="1.8"
            />
            <line x1="-4" y1="36" x2="4" y2="36" stroke="#fef08a" strokeWidth="1.2" />
            <line x1="-4" y1="42" x2="4" y2="42" stroke="#fef08a" strokeWidth="1.2" />
            <line x1="-4" y1="48" x2="4" y2="48" stroke="#fef08a" strokeWidth="1.2" />
          </g>
        </g>
      ) : (
        <g>
          <text
            x="130"
            y="29"
            textAnchor="middle"
            fill="#0f172a"
            fontSize="13.5"
            fontWeight="900"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            جمهورية مصر العربية
          </text>
          <text
            x="130"
            y="241"
            textAnchor="middle"
            fill="#1e293b"
            fontSize="11"
            fontWeight="800"
            letterSpacing="1.5"
            style={{ fontFamily: 'JetBrains Mono, sans-serif' }}
          >
            1 EGYPTIAN POUND
          </text>
          <text
            x="27"
            y="134"
            textAnchor="middle"
            fill="#0f172a"
            fontSize="11.5"
            fontWeight="800"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ٢٠٢٥ م
          </text>
          <text
            x="233"
            y="134"
            textAnchor="middle"
            fill="#0f172a"
            fontSize="11.5"
            fontWeight="800"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ١٤٤٦ هـ
          </text>
          <g
            transform="translate(130, 130)"
            opacity="0.28"
            stroke="#713f12"
            strokeWidth="1.5"
            fill="none"
          >
            <rect x="-46" y="-46" width="92" height="92" rx="6" />
            <rect x="-46" y="-46" width="92" height="92" rx="6" transform="rotate(45)" />
          </g>
          <text
            x="130"
            y="128"
            textAnchor="middle"
            fill="#422006"
            stroke="#fef08a"
            strokeWidth="1.2"
            fontSize="66"
            fontWeight="900"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            ١
          </text>
          <text
            x="130"
            y="166"
            textAnchor="middle"
            fill="#422006"
            fontSize="26"
            fontWeight="900"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            جنيه
          </text>
          <text
            x="130"
            y="188"
            textAnchor="middle"
            fill="#713f12"
            fontSize="11"
            fontWeight="800"
            style={{ fontFamily: 'Cairo, sans-serif' }}
          >
            كِتَابَة
          </text>
        </g>
      )}
    </svg>
  );
};

const SpinningWheelSVG: React.FC<{
  rotation: number;
  isSpinning: boolean;
  winningNum: number | null;
}> = ({ rotation, isSpinning, winningNum }) => {
  const cx = 160;
  const cy = 160;
  const radius = 142;

  const createSlicePath = (index: number) => {
    const centerAngleDeg = index * 60 - 90;
    const startAngleDeg = centerAngleDeg - 30;
    const endAngleDeg = centerAngleDeg + 30;
    const startRad = (startAngleDeg * Math.PI) / 180;
    const endRad = (endAngleDeg * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);

    return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 0 1 ${x2} ${y2} Z`;
  };

  return (
    <div className="relative w-72 h-72 sm:w-88 sm:h-88 flex items-center justify-center select-none">
      <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-emerald-500/20 via-amber-500/15 to-cyan-500/20 blur-xl pointer-events-none" />

      <div
        className={`absolute -top-4 left-1/2 -translate-x-1/2 z-30 transition-transform duration-150 ${
          isSpinning ? 'scale-110' : 'scale-100'
        }`}
      >
        <svg
          width="44"
          height="48"
          viewBox="0 0 44 48"
          className="drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)]"
        >
          <defs>
            <linearGradient id="pointerGold" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#b45309" />
            </linearGradient>
          </defs>
          <path
            d="M 22 44 L 6 12 C 4 7 8 2 14 2 L 30 2 C 36 2 40 7 38 12 Z"
            fill="url(#pointerGold)"
            stroke="#fffbeb"
            strokeWidth="2.5"
          />
          <circle cx="22" cy="12" r="4.5" fill="#78350f" />
        </svg>
      </div>

      <div
        className="w-full h-full rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.75)]"
        style={{
          transform: `rotate(${rotation}deg)`,
          transition: isSpinning
            ? 'transform 2500ms cubic-bezier(0.15, 0.85, 0.25, 1)'
            : 'none',
          willChange: 'transform',
        }}
      >
        <svg viewBox="0 0 320 320" className="w-full h-full">
          <defs>
            {WHEEL_SEGMENTS.map((seg, i) => (
              <linearGradient
                key={seg.num}
                id={`wheelGrad-${i}`}
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor={seg.color} />
                <stop offset="100%" stopColor={seg.darkColor} />
              </linearGradient>
            ))}
            <radialGradient id="wheelHubGold" cx="35%" cy="35%" r="65%">
              <stop offset="0%" stopColor="#fef08a" />
              <stop offset="55%" stopColor="#eab308" />
              <stop offset="100%" stopColor="#854d0e" />
            </radialGradient>
          </defs>

          <circle cx={cx} cy={cy} r="156" fill="#1e293b" stroke="#475569" strokeWidth="4" />
          <circle cx={cx} cy={cy} r="146" fill="#0f172a" stroke="#f59e0b" strokeWidth="2" />

          {WHEEL_SEGMENTS.map((seg, idx) => {
            const angleDeg = idx * 60;
            const isWinner = !isSpinning && winningNum === seg.num;
            return (
              <g key={seg.num}>
                <path
                  d={createSlicePath(idx)}
                  fill={`url(#wheelGrad-${idx})`}
                  stroke="#0f172a"
                  strokeWidth="3"
                  opacity={isWinner ? 1 : 0.94}
                />
                <g transform={`translate(${cx}, ${cy}) rotate(${angleDeg}) translate(0, -92)`}>
                  <text
                    x="0"
                    y="0"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="#ffffff"
                    fontSize="32"
                    fontWeight="900"
                    className="font-mono-num"
                    style={{
                      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.65))',
                    }}
                  >
                    {seg.num}
                  </text>
                  <text
                    x="0"
                    y="23"
                    textAnchor="middle"
                    dominantBaseline="central"
                    fill="rgba(255,255,255,0.9)"
                    fontSize="13"
                    fontWeight="700"
                    style={{ fontFamily: 'Cairo, sans-serif' }}
                  >
                    ({seg.arabic})
                  </text>
                </g>
              </g>
            );
          })}

          {Array.from({ length: 12 }).map((_, i) => {
            const pegAngle = ((i * 30 - 90) * Math.PI) / 180;
            const px = cx + 149 * Math.cos(pegAngle);
            const py = cy + 149 * Math.sin(pegAngle);
            return (
              <circle
                key={i}
                cx={px}
                cy={py}
                r="4"
                fill={i % 2 === 0 ? '#fef08a' : '#94a3b8'}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            );
          })}

          <circle cx={cx} cy={cy} r="30" fill="#0f172a" stroke="#475569" strokeWidth="3" />
          <circle
            cx={cx}
            cy={cy}
            r="22"
            fill="url(#wheelHubGold)"
            stroke="#fef9c3"
            strokeWidth="1.5"
          />
          <circle cx={cx} cy={cy} r="7" fill="#78350f" />
        </svg>
      </div>
    </div>
  );
};

// ============================================================================
// STANDALONE SINGLE-FILE HTML GENERATOR (100% ZERO-BUILD GITHUB/VERCEL FALLBACK)
// ============================================================================

function generateStandaloneIndexHtml(savedData: SavedAppData): string {
  const initialJson = JSON.stringify(savedData);
  return `<!doctype html>
<html lang="ar" dir="rtl" class="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>رفيق الألعاب العشوائي الاحترافي</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=JetBrains+Mono:wght@600;700;800&display=swap" rel="stylesheet" />
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Cairo', sans-serif; background-color: #0f172a; color: #f8fafc; }
    .font-mono-num { font-family: 'JetBrains Mono', 'Cairo', monospace; font-variant-numeric: tabular-nums; }
    @keyframes diceTumble {
      0% { transform: rotateX(0deg) rotateY(0deg) scale(1); }
      30% { transform: translateY(-24px) rotateX(180deg) rotateY(-120deg) scale(1.1); }
      70% { transform: translateY(-12px) rotateX(320deg) rotateY(220deg) scale(1.06); }
      100% { transform: rotateX(360deg) rotateY(360deg) scale(1); }
    }
    .animate-dice { animation: diceTumble 600ms cubic-bezier(0.22, 1, 0.36, 1) forwards; }
  </style>
</head>
<body class="min-h-screen bg-[#0f172a] text-slate-100 select-none overflow-x-hidden">
  <div id="app"></div>
  <script>
    // البيانات المحفوظة المبدئية
    const STORAGE_KEY = '${STORAGE_KEY}';
    const INITIAL_DATA = ${initialJson};
    let state = Object.assign({}, INITIAL_DATA, JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'));
    let activeMode = 'home';
    function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    function toAr(n) { return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[d]); }
    function rand(min, max) {
      const a = new Uint32Array(1); window.crypto.getRandomValues(a);
      return min + (a[0] % (max - min + 1));
    }
    function render() {
      const root = document.getElementById('app');
      if (activeMode === 'home') {
        root.innerHTML = \`
          <div class="max-w-5xl mx-auto px-5 py-10">
            <div class="text-center mb-8">
              <h1 class="text-3xl sm:text-5xl font-black text-white mb-3">رفيق الألعاب العشوائي الاحترافي</h1>
              <p class="text-slate-300">اختر اللعبة من القائمة المنسدلة أو البطاقات بالأسفل لفتحها بملء الشاشة</p>
            </div>
            <div class="max-w-md mx-auto mb-8">
              <select onchange="if(this.value) { activeMode = this.value; render(); }" class="w-full p-4 rounded-2xl bg-slate-900 border-2 border-amber-500 text-white font-bold text-lg cursor-pointer">
                <option value="">-- اختر اللعبة من القائمة المنسدلة --</option>
                <option value="dice">01. رمي ٢ نرد عشوائي</option>
                <option value="number">02. اختيار رقم عشوائي</option>
                <option value="wheel">03. دائرة تلف بها أرقام من ١ إلى ٦</option>
                <option value="coin">04. ملك وكتابة (الجنيه المصري المعدني)</option>
              </select>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button onclick="activeMode='dice';render()" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-amber-500 text-right cursor-pointer">
                <div class="text-amber-400 font-bold mb-1">01</div>
                <div class="text-lg font-extrabold text-white mb-1">رمي ٢ نرد عشوائي</div>
                <div class="text-xs text-slate-400">آخر نتيجة: \${state.historyByMode.dice[0]?.label || '٦ + ٦ = ١٢'}</div>
              </button>
              <button onclick="activeMode='number';render()" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-cyan-500 text-right cursor-pointer">
                <div class="text-cyan-400 font-bold mb-1">02</div>
                <div class="text-lg font-extrabold text-white mb-1">اختيار رقم عشوائي</div>
                <div class="text-xs text-slate-400">آخر نتيجة: \${state.historyByMode.number[0]?.label || '٧٧'}</div>
              </button>
              <button onclick="activeMode='wheel';render()" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-emerald-500 text-right cursor-pointer">
                <div class="text-emerald-400 font-bold mb-1">03</div>
                <div class="text-lg font-extrabold text-white mb-1">عجلة ١ إلى ٦</div>
                <div class="text-xs text-slate-400">آخر نتيجة: \${state.historyByMode.wheel[0]?.label || 'رقم ٦'}</div>
              </button>
              <button onclick="activeMode='coin';render()" class="p-6 rounded-2xl bg-slate-900 border border-slate-800 hover:border-yellow-500 text-right cursor-pointer">
                <div class="text-yellow-400 font-bold mb-1">04</div>
                <div class="text-lg font-extrabold text-white mb-1">ملك وكتابة (جنيه مصري)</div>
                <div class="text-xs text-slate-400">آخر نتيجة: \${state.historyByMode.coin[0]?.label || 'مَلِك'}</div>
              </button>
            </div>
          </div>\`;
      } else {
        const hist = (state.historyByMode[activeMode] || []).map(h => h.label).join(' · ');
        root.innerHTML = \`
          <div class="min-h-screen flex flex-col justify-between p-6">
            <div class="flex justify-between items-center">
              <div class="text-sm text-amber-400 font-bold">رفيق الألعاب العشوائي</div>
              <button onclick="activeMode='home';render()" class="fixed top-4 left-4 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-white font-bold text-sm cursor-pointer">الرجوع إلى الصفحة الرئيسية ←</button>
            </div>
            <div class="my-auto text-center">
              <div id="stage" class="text-5xl sm:text-7xl font-black text-amber-400 mb-6">\${
                activeMode === 'dice' ? toAr(state.lastDie1) + ' و ' + toAr(state.lastDie2) + ' (المجموع ' + toAr(state.lastDie1 + state.lastDie2) + ')' :
                activeMode === 'number' ? toAr(state.lastNumber) + ' (' + state.lastNumber + ')' :
                activeMode === 'wheel' ? 'رقم ' + toAr(state.lastWheelWinner) :
                (state.lastCoinSide === 'king' ? 'مَلِك (قناع توت عنخ آمون)' : 'كِتَابَة (١ جنيه مصري)')
              }</div>
              <button onclick="playNow()" class="px-10 py-4 rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-xl cursor-pointer shadow-lg">العب الآن</button>
            </div>
            <div class="max-w-xl mx-auto w-full p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-center text-slate-300">
              سجل آخر النتائج: \${hist}
            </div>
          </div>\`;
      }
    }
    window.playNow = function() {
      if (activeMode === 'dice') {
        state.lastDie1 = rand(1, 6); state.lastDie2 = rand(1, 6);
        const sum = state.lastDie1 + state.lastDie2;
        state.historyByMode.dice = [{ id: Date.now(), label: toAr(state.lastDie1) + '+' + toAr(state.lastDie2) + '=' + toAr(sum) }, ...state.historyByMode.dice].slice(0, 5);
      } else if (activeMode === 'number') {
        state.lastNumber = rand(1, 100);
        state.historyByMode.number = [{ id: Date.now(), label: toAr(state.lastNumber) + ' (' + state.lastNumber + ')' }, ...state.historyByMode.number].slice(0, 5);
      } else if (activeMode === 'wheel') {
        state.lastWheelWinner = rand(1, 6);
        state.historyByMode.wheel = [{ id: Date.now(), label: 'رقم ' + toAr(state.lastWheelWinner) }, ...state.historyByMode.wheel].slice(0, 5);
      } else if (activeMode === 'coin') {
        state.lastCoinSide = rand(0, 1) === 0 ? 'king' : 'tails';
        state.historyByMode.coin = [{ id: Date.now(), label: state.lastCoinSide === 'king' ? 'مَلِك' : 'كِتَابَة' }, ...state.historyByMode.coin].slice(0, 5);
      }
      save(); render();
    };
    render();
  </script>
</body>
</html>`;
}

// ============================================================================
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // Load persisted data immediately so data always shows on Vercel & GitHub
  const initialData = useRef<SavedAppData>(loadSavedData());

  const [activeMode, setActiveMode] = useState<GameModeId>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as GameModeId;
      if (['dice', 'number', 'wheel', 'coin'].includes(hash)) {
        return hash;
      }
    }
    return 'home';
  });

  const [isHomeDropdownOpen, setIsHomeDropdownOpen] = useState(false);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isDeployModalOpen, setIsDeployModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  // Persisted History & Stats per mode
  const [historyByMode, setHistoryByMode] = useState<
    Record<Exclude<GameModeId, 'home'>, HistoryEntry[]>
  >(initialData.current.historyByMode);

  const [statsByMode, setStatsByMode] = useState<Record<Exclude<GameModeId, 'home'>, number>>(
    initialData.current.statsByMode
  );

  // -------------------- Mode 1: Dual 3D Dice State --------------------
  const [die1, setDie1] = useState<number>(initialData.current.lastDie1);
  const [die2, setDie2] = useState<number>(initialData.current.lastDie2);
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [hasRolledDice, setHasRolledDice] = useState<boolean>(true);

  // -------------------- Mode 2: Random Number State --------------------
  const [minNumInput, setMinNumInput] = useState<string>(initialData.current.minNumInput);
  const [maxNumInput, setMaxNumInput] = useState<string>(initialData.current.maxNumInput);
  const [currentNumber, setCurrentNumber] = useState<number>(initialData.current.lastNumber);
  const [isNumberRolling, setIsNumberRolling] = useState<boolean>(false);
  const [hasGeneratedNumber, setHasGeneratedNumber] = useState<boolean>(true);

  // -------------------- Mode 3: Spinning Wheel 1-6 State --------------------
  const [wheelRotation, setWheelRotation] = useState<number>(() => {
    const w = initialData.current.lastWheelWinner || 6;
    return (360 - (w - 1) * 60) % 360;
  });
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);
  const [wheelWinner, setWheelWinner] = useState<number | null>(
    initialData.current.lastWheelWinner
  );

  // -------------------- Mode 4: Egyptian 1 Pound Coin Flip State --------------------
  const [coinSide, setCoinSide] = useState<'king' | 'tails'>(initialData.current.lastCoinSide);
  const [coinRotationY, setCoinRotationY] = useState<number>(
    initialData.current.lastCoinSide === 'king' ? 0 : 180
  );
  const [isCoinFlipping, setIsCoinFlipping] = useState<boolean>(false);
  const [hasFlippedCoin, setHasFlippedCoin] = useState<boolean>(true);

  // Sync all state to localStorage whenever anything changes
  useEffect(() => {
    try {
      const payload: SavedAppData = {
        historyByMode,
        statsByMode,
        minNumInput,
        maxNumInput,
        lastDie1: die1,
        lastDie2: die2,
        lastNumber: currentNumber,
        lastWheelWinner: wheelWinner || 6,
        lastCoinSide: coinSide,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    historyByMode,
    statsByMode,
    minNumInput,
    maxNumInput,
    die1,
    die2,
    currentNumber,
    wheelWinner,
    coinSide,
  ]);

  // Sync URL hash for GitHub Pages / Vercel direct navigation
  useEffect(() => {
    const onHashChange = () => {
      const h = window.location.hash.replace('#', '') as GameModeId;
      if (['dice', 'number', 'wheel', 'coin'].includes(h)) {
        setActiveMode(h);
      } else if (!h || h === 'home') {
        setActiveMode('home');
      }
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Refs for cleanup and outside-click detection
  const homeDropdownRef = useRef<HTMLDivElement>(null);
  const headerDropdownRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (homeDropdownRef.current && !homeDropdownRef.current.contains(e.target as Node)) {
        setIsHomeDropdownOpen(false);
      }
      if (headerDropdownRef.current && !headerDropdownRef.current.contains(e.target as Node)) {
        setIsHeaderDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const toggleMute = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    soundFX.isMuted = nextMuted;
    if (!nextMuted) {
      soundFX.playClick();
    }
  };

  const pushHistory = useCallback(
    (mode: Exclude<GameModeId, 'home'>, entry: Omit<HistoryEntry, 'id' | 'timestamp'>) => {
      const nowStr = new Date().toLocaleTimeString('ar-EG', {
        hour: '2-digit',
        minute: '2-digit',
      });
      setHistoryByMode((prev) => ({
        ...prev,
        [mode]: [
          {
            ...entry,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: nowStr,
          },
          ...prev[mode],
        ].slice(0, 5),
      }));
      setStatsByMode((prev) => ({
        ...prev,
        [mode]: (prev[mode] || 0) + 1,
      }));
    },
    []
  );

  const selectGameMode = (mode: GameModeId) => {
    soundFX.playClick();
    triggerHaptic(15);
    clearAllTimers();
    setIsDiceRolling(false);
    setIsNumberRolling(false);
    setIsWheelSpinning(false);
    setIsCoinFlipping(false);
    setIsHomeDropdownOpen(false);
    setIsHeaderDropdownOpen(false);
    setActiveMode(mode);
    try {
      window.location.hash = mode === 'home' ? '' : mode;
    } catch {
      // Ignore hash restrictions
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key);
      soundFX.playClick();
      window.setTimeout(() => setCopiedKey(null), 2000);
    });
  };

  const downloadStandaloneHtml = () => {
    soundFX.playClick();
    const htmlContent = generateStandaloneIndexHtml({
      historyByMode,
      statsByMode,
      minNumInput,
      maxNumInput,
      lastDie1: die1,
      lastDie2: die2,
      lastNumber: currentNumber,
      lastWheelWinner: wheelWinner || 6,
      lastCoinSide: coinSide,
    });
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'index.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // ============================================================================
  // GAME 1 HANDLER: DUAL 3D DICE ROLLER (600ms)
  // ============================================================================
  const handlePlayDice = () => {
    if (isDiceRolling) return;
    setIsDiceRolling(true);
    triggerHaptic([25, 40, 25]);
    soundFX.playDiceRollSequence();

    const intervalId = window.setInterval(() => {
      setDie1(getCryptoRandomInt(1, 6));
      setDie2(getCryptoRandomInt(1, 6));
    }, 85);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      const finalDie1 = getCryptoRandomInt(1, 6);
      const finalDie2 = getCryptoRandomInt(1, 6);
      const total = finalDie1 + finalDie2;
      const isDouble = finalDie1 === finalDie2;

      setDie1(finalDie1);
      setDie2(finalDie2);
      setIsDiceRolling(false);
      setHasRolledDice(true);

      soundFX.playWinChime(isDouble);
      triggerHaptic(isDouble ? [40, 50, 80] : 35);

      pushHistory('dice', {
        label: `${toArabicDigits(finalDie1)} + ${toArabicDigits(finalDie2)} = ${toArabicDigits(total)}`,
        subLabel: isDouble ? ARABIC_DOUBLE_NAMES[finalDie1] : `المجموع ${toArabicDigits(total)}`,
        isSpecial: isDouble,
      });
    }, 600);

    timersRef.current.push(timeoutId, intervalId);
  };

  // ============================================================================
  // GAME 2 HANDLER: SMART RANDOM NUMBER GENERATOR (700ms)
  // ============================================================================
  const handlePlayNumber = () => {
    if (isNumberRolling) return;

    let parsedMin = parseInt(minNumInput, 10);
    let parsedMax = parseInt(maxNumInput, 10);
    if (isNaN(parsedMin)) parsedMin = 1;
    if (isNaN(parsedMax)) parsedMax = 100;

    if (parsedMin > parsedMax) {
      const temp = parsedMin;
      parsedMin = parsedMax;
      parsedMax = temp;
      setMinNumInput(String(parsedMin));
      setMaxNumInput(String(parsedMax));
    }

    setIsNumberRolling(true);
    triggerHaptic(25);

    let step = 0;
    const intervalId = window.setInterval(() => {
      step += 1;
      setCurrentNumber(getCryptoRandomInt(parsedMin, parsedMax));
      soundFX.playDigitalTick(480 + (step % 6) * 65);
    }, 65);

    const timeoutId = window.setTimeout(() => {
      window.clearInterval(intervalId);
      const finalVal = getCryptoRandomInt(parsedMin, parsedMax);
      setCurrentNumber(finalVal);
      setIsNumberRolling(false);
      setHasGeneratedNumber(true);

      soundFX.playWinChime(false);
      triggerHaptic([35, 40, 50]);

      pushHistory('number', {
        label: `${toArabicDigits(finalVal)} (${finalVal})`,
        subLabel: `النطاق ${toArabicDigits(parsedMin)}–${toArabicDigits(parsedMax)}`,
      });
    }, 700);

    timersRef.current.push(timeoutId, intervalId);
  };

  // ============================================================================
  // GAME 3 HANDLER: SPINNING WHEEL 1 TO 6 (2500ms)
  // ============================================================================
  const handlePlayWheel = () => {
    if (isWheelSpinning) return;
    setIsWheelSpinning(true);
    triggerHaptic(30);

    const winningSegmentNum = getCryptoRandomInt(1, 6);
    const targetMod = (360 - (winningSegmentNum - 1) * 60) % 360;
    const jitter = getCryptoRandomInt(-14, 14);
    const desiredFinalMod = (targetMod + jitter + 360) % 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const delta = (desiredFinalMod - currentMod + 360) % 360;

    const extraFullSpins = getCryptoRandomInt(5, 7) * 360;
    const nextRotation = wheelRotation + extraFullSpins + delta;
    setWheelRotation(nextRotation);

    const tickScheduleMs = [
      90, 180, 270, 360, 460, 570, 690, 820, 960, 1120, 1300, 1500, 1730, 1990, 2270,
    ];
    tickScheduleMs.forEach((ms, i) => {
      const tid = window.setTimeout(() => {
        soundFX.playWheelPegTick(1.15 - i * 0.025);
      }, ms);
      timersRef.current.push(tid);
    });

    const endTimeoutId = window.setTimeout(() => {
      setWheelWinner(winningSegmentNum);
      setIsWheelSpinning(false);
      soundFX.playWinChime(winningSegmentNum === 6);
      triggerHaptic([45, 50, 75]);

      const segInfo = WHEEL_SEGMENTS[winningSegmentNum - 1];
      pushHistory('wheel', {
        label: `رقم ${segInfo.arabic} (${segInfo.num})`,
        subLabel: segInfo.label,
        isSpecial: winningSegmentNum === 6,
      });
    }, 2500);

    timersRef.current.push(endTimeoutId);
  };

  // ============================================================================
  // GAME 4 HANDLER: EGYPTIAN 1 POUND COIN FLIP (1450ms)
  // ============================================================================
  const handlePlayCoin = () => {
    if (isCoinFlipping) return;
    setIsCoinFlipping(true);
    triggerHaptic([30, 40, 25]);
    soundFX.playCoinMetallicClink();

    const outcomeBit = getCryptoRandomInt(0, 1);
    const nextSide: 'king' | 'tails' = outcomeBit === 0 ? 'king' : 'tails';

    const targetMod = nextSide === 'king' ? 0 : 180;
    const currentMod = ((coinRotationY % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;

    const nextRotY = coinRotationY + 2160 + delta;
    setCoinRotationY(nextRotY);

    const endTimeoutId = window.setTimeout(() => {
      setCoinSide(nextSide);
      setIsCoinFlipping(false);
      setHasFlippedCoin(true);
      soundFX.playCoinMetallicClink();
      soundFX.playWinChime(nextSide === 'king');
      triggerHaptic([50, 40, 70]);

      pushHistory('coin', {
        label: nextSide === 'king' ? 'مَلِك (قناع توت عنخ آمون)' : 'كِتَابَة (١ جنيه مصري)',
        subLabel: nextSide === 'king' ? 'ملك' : 'كتابة',
        isSpecial: nextSide === 'king',
      });
    }, 1450);

    timersRef.current.push(endTimeoutId);
  };

  const currentModeInfo = GAME_MODES.find((m) => m.id === activeMode);
  const currentHistory = activeMode !== 'home' ? historyByMode[activeMode] : [];
  const totalPlaysCount =
    statsByMode.dice + statsByMode.number + statsByMode.wheel + statsByMode.coin;

  const isCurrentlyAnimating =
    isDiceRolling || isNumberRolling || isWheelSpinning || isCoinFlipping;

  const triggerCurrentGamePlay = () => {
    if (activeMode === 'dice') handlePlayDice();
    else if (activeMode === 'number') handlePlayNumber();
    else if (activeMode === 'wheel') handlePlayWheel();
    else if (activeMode === 'coin') handlePlayCoin();
  };

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] w-full bg-[#0f172a] text-slate-100 flex flex-col justify-between relative overflow-x-hidden select-none"
    >
      {/* Subtle Ambient Background Lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-36 -right-36 w-96 h-96 rounded-full bg-amber-500/10 blur-3xl" />
        <div className="absolute top-1/3 -left-36 w-96 h-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -bottom-36 right-1/4 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      {/* =====================================================================
          VERCEL & GITHUB DEPLOYMENT FIX & EXPORT MODAL
         ===================================================================== */}
      {isDeployModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-slate-900 border border-slate-700 shadow-2xl p-6 text-right my-8">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <FileCode2 className="w-6 h-6 text-amber-400 shrink-0" />
                <h2 className="text-lg sm:text-xl font-black text-white">
                  حل مشكلة ظهور الموقع والبيانات على Vercel و GitHub
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setIsDeployModalOpen(false)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="py-4 space-y-5 text-sm text-slate-300 leading-relaxed max-h-[72vh] overflow-y-auto pl-1">
              {/* Solution 1: 1-Click Single HTML File */}
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/40">
                <div className="font-extrabold text-amber-300 text-base mb-1">
                  الحل الأسرع المضمون ١٠٠٪ (ملف index.html واحد شامل بجميع البيانات):
                </div>
                <p className="text-xs text-slate-300 mb-3">
                  إذا رفعت الملفات يدوياً على GitHub بدون مجلد <code className="font-mono-num text-amber-300">src/</code>، فلن يجد Vercel الملفات الفرعية. يمكنك تحميل ملف <code className="font-mono-num text-amber-300">index.html</code> الشامل بالأسفل ورفعه مباشرة على GitHub أو Vercel وسيعمل فوراً بجميع الألعاب والبيانات المحفوظة!
                </p>
                <button
                  type="button"
                  onClick={downloadStandaloneHtml}
                  className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-slate-950 font-black text-sm flex items-center justify-center gap-2 hover:from-amber-300 hover:to-orange-400 transition-all cursor-pointer shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  <span>تحميل ملف index.html الشامل (يعمل مباشرة على GitHub و Vercel)</span>
                </button>
              </div>

              {/* Solution 2: Fixed package.json for Vite build on Vercel */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-white">
                    ١. تحديث ملف <code className="font-mono-num text-cyan-400">package.json</code> على GitHub:
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(VERCEL_PACKAGE_JSON_SNIPPET, 'pkg')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'pkg' ? 'تم النسخ!' : 'نسخ package.json'}</span>
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  تم إصلاح أرقام إصدارات الحزم في المشروع لتتوافق ١٠٠٪ مع سيرفرات البناء في Vercel و GitHub Actions:
                </p>
                <pre
                  dir="ltr"
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-num text-emerald-300 overflow-x-auto text-left"
                >
                  {VERCEL_PACKAGE_JSON_SNIPPET}
                </pre>
              </div>

              {/* Solution 3: vercel.json */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-extrabold text-white">
                    ٢. ملف <code className="font-mono-num text-cyan-400">vercel.json</code> (تمت إضافته للمشروع):
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(VERCEL_JSON_SNIPPET, 'vercel')}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-amber-400 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedKey === 'vercel' ? 'تم النسخ!' : 'نسخ vercel.json'}</span>
                  </button>
                </div>
                <pre
                  dir="ltr"
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono-num text-cyan-300 overflow-x-auto text-left"
                >
                  {VERCEL_JSON_SNIPPET}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          VIEW 1: HOME VIEW (الصفحة الرئيسية)
         ===================================================================== */}
      {activeMode === 'home' ? (
        <div className="relative z-10 flex flex-col min-h-[100dvh]">
          {/* Strict 3-Zone Top Bar Contract */}
          <header className="w-full max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80">
            {/* Zone 1: Single text element wordmark */}
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                selectGameMode('home');
              }}
              className="text-lg sm:text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              عشوائيات الألعاب الاحترافية
            </a>

            {/* Zone 2: 4 concise single-line text navigation links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-semibold text-slate-300">
              {GAME_MODES.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => selectGameMode(mode.id)}
                  className="hover:text-amber-400 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  {mode.shortTitle}
                </button>
              ))}
            </nav>

            {/* Zone 3: 1 Primary Action */}
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={toggleMute}
                aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-bold text-slate-200 bg-slate-800/90 border border-slate-700 rounded-xl hover:bg-slate-700 hover:border-slate-600 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isMuted ? (
                  <>
                    <VolumeX className="w-4 h-4 text-rose-400" />
                    <span>الصوت مكتوم</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4 text-amber-400" />
                    <span>المؤثرات الصوتية</span>
                  </>
                )}
              </button>
            </div>
          </header>

          {/* Main Hero & Interactive Mode Selector */}
          <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-10 flex flex-col justify-center">
            <div className="text-center max-w-3xl mx-auto mb-7">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-600/20 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.25)] mb-4">
                <Gamepad2 className="w-8 h-8 text-amber-400" />
              </div>

              <h1
                className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-3"
                style={{ textWrap: 'balance' }}
              >
                رفيق الألعاب العشوائي المتكامل
              </h1>

              <p className="text-slate-300 text-base sm:text-lg leading-relaxed max-w-2xl mx-auto">
                اختر اللعبة المطلوبة من القائمة المنسدلة بالأسفل للانتقال فوراً إلى شاشة اللعب الكاملة مع حفظ تلقائي لجميع النتائج والبيانات.
              </p>
            </div>

            {/* PROMINENT HIGH-TECH DROPDOWN MENU (قائمة منسدلة احترافية) */}
            <div ref={homeDropdownRef} className="relative w-full max-w-xl mx-auto mb-8 z-30">
              <label className="block text-xs font-bold text-amber-400 mb-2 pr-1">
                اختر وضع اللعب من القائمة المنسدلة (تفتح اللعبة بملء الشاشة فوراً):
              </label>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setIsHomeDropdownOpen((prev) => !prev);
                }}
                aria-expanded={isHomeDropdownOpen}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 rounded-2xl bg-slate-900/95 backdrop-blur-md border-2 border-amber-500/60 hover:border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.2)] transition-all cursor-pointer group"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center shrink-0">
                    <Layers className="w-5 h-5 text-amber-400" />
                  </div>
                  <div className="text-right truncate">
                    <div className="text-base sm:text-lg font-extrabold text-white truncate">
                      اختر أداة القرعة أو اللعبة العشوائية...
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      رمي ٢ نرد · رقم عشوائي · عجلة ١-٦ · ملك وكتابة (جنيه مصري)
                    </div>
                  </div>
                </div>

                <ChevronDown
                  className={`w-6 h-6 text-amber-400 shrink-0 transition-transform duration-200 ${
                    isHomeDropdownOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isHomeDropdownOpen && (
                <div className="absolute right-0 left-0 mt-2.5 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-[0_25px_60px_rgba(0,0,0,0.85)] overflow-hidden divide-y divide-slate-800/80">
                  {GAME_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => selectGameMode(mode.id)}
                      className="w-full flex items-center justify-between gap-4 px-5 py-4 text-right hover:bg-slate-800/90 transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <span className="font-mono-num text-sm font-extrabold text-amber-400 shrink-0">
                          {mode.numberLabel}.
                        </span>
                        <div className="min-w-0">
                          <div className="text-base font-bold text-white group-hover:text-amber-300 transition-colors truncate">
                            {mode.title}
                          </div>
                          <div className="text-xs text-slate-400 truncate">{mode.subtitle}</div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-400 group-hover:translate-x-[-4px] transition-transform whitespace-nowrap shrink-0">
                        افتح اللعبة ←
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick-Select Visual Preview Cards Grid (4 Modes + Live Saved Data Preview) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
              {GAME_MODES.map((mode) => {
                const IconComponent =
                  mode.id === 'dice'
                    ? Dices
                    : mode.id === 'number'
                    ? Hash
                    : mode.id === 'wheel'
                    ? Compass
                    : Coins;

                const latestEntry = historyByMode[mode.id]?.[0];
                const modeCount = statsByMode[mode.id] || 0;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => selectGameMode(mode.id)}
                    className="group relative text-right rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 hover:border-amber-500/60 p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1 cursor-pointer"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-3 mb-4">
                        <div
                          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${mode.accentColor} flex items-center justify-center shadow-lg`}
                        >
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <span className="font-mono-num text-sm font-bold text-slate-500">
                          {mode.numberLabel}
                        </span>
                      </div>

                      <h2 className="text-lg font-extrabold text-white group-hover:text-amber-300 transition-colors mb-2">
                        {mode.title}
                      </h2>

                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-4">
                        {mode.subtitle}
                      </p>
                    </div>

                    <div className="space-y-2.5 pt-3 border-t border-slate-800/90">
                      {/* Saved Data / Latest Result Row */}
                      <div className="flex items-center justify-between text-xs text-slate-300">
                        <span className="text-slate-400">آخر نتيجة محفوظة:</span>
                        <span className="font-mono-num font-bold text-amber-300 truncate max-w-[130px]">
                          {latestEntry ? latestEntry.label : 'جاهز للعب'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>عدد الجولات: {toArabicDigits(modeCount)}</span>
                        <span className="font-bold text-amber-400 group-hover:underline whitespace-nowrap">
                          العب الآن ←
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Live Saved Data & Deployment Helper Bar */}
            <div className="w-full rounded-2xl bg-slate-900/75 border border-slate-800 px-5 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3 text-xs sm:text-sm text-slate-300">
                <BarChart3 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <span className="font-bold text-white">بيانات وسجلات الألعاب محفوظة تلقائياً: </span>
                  <span>
                    إجمالي الجولات المسجلة{' '}
                    <strong className="font-mono-num text-amber-400">
                      {toArabicDigits(totalPlaysCount)}
                    </strong>{' '}
                    جولة عبر الألعاب الأربع
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundFX.playClick();
                  setIsDeployModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-extrabold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <FileCode2 className="w-4 h-4" />
                <span>أدوات النشر السريع على Vercel و GitHub</span>
              </button>
            </div>
          </main>

          {/* Quiet Footer */}
          <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <span>رفيق الألعاب العشوائي الاحترافي · متوافق ١٠٠٪ مع Vercel و GitHub Pages</span>
            <span>مصمم للعمل بأقصى سرعة (60fps) على جميع الهواتف والأجهزة</span>
          </footer>
        </div>
      ) : (
        /* =====================================================================
            VIEW 2: FULL-SCREEN GAME MODE (واجهة اللعبة الكاملة)
           ===================================================================== */
        <div className="relative z-10 flex flex-col min-h-[100dvh] w-full justify-between">
          {/* Top Navigation Overlay with Strict Top-Left Back Button (`top-4 left-4`) */}
          <div className="w-full px-4 sm:px-6 pt-4 pb-2 flex items-center justify-between gap-3 relative z-30">
            {/* RIGHT SIDE (in RTL): Quick-Switch Mode Dropdown + Sound Mute Toggle */}
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? 'تشغيل الصوت' : 'كتم الصوت'}
                className="h-11 px-3.5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/90 hover:border-slate-500 text-slate-200 flex items-center gap-2 transition-colors cursor-pointer shrink-0"
              >
                {isMuted ? (
                  <VolumeX className="w-5 h-5 text-rose-400" />
                ) : (
                  <Volume2 className="w-5 h-5 text-amber-400" />
                )}
                <span className="hidden sm:inline text-xs font-bold whitespace-nowrap">
                  {isMuted ? 'صامت' : 'الصوت'}
                </span>
              </button>

              <div ref={headerDropdownRef} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    soundFX.playClick();
                    setIsHeaderDropdownOpen((prev) => !prev);
                  }}
                  className="h-11 px-3.5 sm:px-4 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/90 hover:border-amber-500/60 text-white flex items-center gap-2 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>{currentModeInfo?.title}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-amber-400 transition-transform ${
                      isHeaderDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isHeaderDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900/98 backdrop-blur-xl border border-slate-700 shadow-2xl overflow-hidden divide-y divide-slate-800 z-50">
                    {GAME_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => selectGameMode(m.id)}
                        className={`w-full px-4 py-3 text-right text-sm font-bold flex items-center justify-between transition-colors cursor-pointer ${
                          m.id === activeMode
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <span>{m.title}</span>
                        {m.id === activeMode && <Check className="w-4 h-4 text-amber-400" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* STRICT TOP-LEFT BACK BUTTON (`top-4 left-4` visual placement) */}
            <button
              type="button"
              onClick={() => selectGameMode('home')}
              className="fixed top-4 left-4 z-40 h-11 px-4 sm:px-5 rounded-xl bg-slate-900/90 backdrop-blur-md border border-slate-700/90 hover:border-amber-400/80 hover:bg-slate-800 text-white shadow-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <span className="text-xs sm:text-sm font-bold">الرجوع إلى الصفحة الرئيسية</span>
              <ArrowLeft className="w-4 h-4 text-amber-400 shrink-0" />
            </button>
          </div>

          {/* =================================================================
              CENTER STAGE: ACTIVE GAME VIEWPORT
             ================================================================= */}
          <main className="flex-1 w-full max-w-4xl mx-auto px-4 sm:px-6 py-2 flex flex-col items-center justify-center">
            <div className="text-center mb-4 sm:mb-6">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {currentModeInfo?.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 mt-1">
                {currentModeInfo?.subtitle}
              </p>
            </div>

            {/* -------------------- MODE 1: DUAL 3D DICE ROLLER -------------------- */}
            {activeMode === 'dice' && (
              <div className="w-full flex flex-col items-center">
                <div className="perspective-1000 my-4 sm:my-6 flex items-center justify-center gap-6 sm:gap-12">
                  <Die3DCard
                    value={die1}
                    label="النرد الأول"
                    isRolling={isDiceRolling}
                    variant={1}
                    isDouble={die1 === die2 && hasRolledDice}
                  />
                  <Die3DCard
                    value={die2}
                    label="النرد الثاني"
                    isRolling={isDiceRolling}
                    variant={2}
                    isDouble={die1 === die2 && hasRolledDice}
                  />
                </div>

                <div className="mt-4 flex flex-col items-center gap-2.5 min-h-[84px] justify-center">
                  <div className="px-6 py-3 rounded-2xl bg-slate-900/90 border border-slate-700/90 flex items-center gap-4 shadow-xl">
                    <span className="text-sm sm:text-base font-bold text-slate-300">
                      المجموع الكلي:
                    </span>
                    <span className="font-mono-num text-2xl sm:text-3xl font-black text-amber-400">
                      {isDiceRolling ? '...' : `${toArabicDigits(die1 + die2)} (${die1 + die2})`}
                    </span>
                  </div>

                  {!isDiceRolling && die1 === die2 && (
                    <div className="flex items-center gap-2 text-amber-300 font-extrabold text-sm sm:text-base animate-bounce">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      <span>دش / زوجي متطابق! · {ARABIC_DOUBLE_NAMES[die1]}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* -------------------- MODE 2: SMART RANDOM NUMBER GENERATOR -------------------- */}
            {activeMode === 'number' && (
              <div className="w-full max-w-xl flex flex-col items-center">
                <div className="w-full rounded-2xl bg-slate-900/85 border border-slate-800 p-4 sm:p-5 mb-5">
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label
                        htmlFor="min-num-input"
                        className="block text-xs font-bold text-slate-300 mb-1.5"
                      >
                        الحد الأدنى (Min)
                      </label>
                      <input
                        id="min-num-input"
                        type="number"
                        value={minNumInput}
                        disabled={isNumberRolling}
                        onChange={(e) => setMinNumInput(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none font-mono-num text-base font-bold text-white text-center"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="max-num-input"
                        className="block text-xs font-bold text-slate-300 mb-1.5"
                      >
                        الحد الأقصى (Max)
                      </label>
                      <input
                        id="max-num-input"
                        type="number"
                        value={maxNumInput}
                        disabled={isNumberRolling}
                        onChange={(e) => setMaxNumInput(e.target.value)}
                        className="w-full h-11 px-3.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-cyan-400 focus:outline-none font-mono-num text-base font-bold text-white text-center"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-400">نطاقات سريعة:</span>
                    <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800">
                      {[
                        { label: '١ - ١٠', min: '1', max: '10' },
                        { label: '١ - ٥٠', min: '1', max: '50' },
                        { label: '١ - ١٠٠', min: '1', max: '100' },
                        { label: '١ - ١٠٠٠', min: '1', max: '1000' },
                      ].map((preset) => {
                        const isActive =
                          minNumInput === preset.min && maxNumInput === preset.max;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            disabled={isNumberRolling}
                            onClick={() => {
                              soundFX.playClick();
                              setMinNumInput(preset.min);
                              setMaxNumInput(preset.max);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                              isActive
                                ? 'bg-cyan-500 text-slate-950 shadow-sm'
                                : 'text-slate-300 hover:text-white hover:bg-slate-800'
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div
                  className={`relative w-full py-8 sm:py-10 px-6 rounded-3xl bg-slate-900/95 border-2 transition-all duration-300 flex flex-col items-center justify-center shadow-2xl ${
                    isNumberRolling
                      ? 'border-cyan-400/80 shadow-[0_0_45px_rgba(6,182,212,0.3)] scale-[1.02]'
                      : hasGeneratedNumber
                      ? 'border-amber-400/80 shadow-[0_0_40px_rgba(245,158,11,0.25)]'
                      : 'border-slate-800'
                  }`}
                >
                  <span className="text-xs font-bold text-slate-400 mb-2">
                    {isNumberRolling ? 'جاري السحب العشوائي...' : 'الرقم الفائز هو'}
                  </span>

                  <div
                    className={`font-mono-num text-6xl sm:text-8xl font-black tracking-tight transition-transform duration-200 ${
                      isNumberRolling ? 'text-cyan-300 scale-105' : 'text-white'
                    }`}
                  >
                    {currentNumber}
                  </div>

                  <div className="mt-3 text-lg sm:text-xl font-extrabold text-amber-400">
                    ({toArabicDigits(currentNumber)})
                  </div>
                </div>
              </div>
            )}

            {/* -------------------- MODE 3: SPINNING WHEEL 1 TO 6 -------------------- */}
            {activeMode === 'wheel' && (
              <div className="w-full flex flex-col items-center">
                <div className="my-2">
                  <SpinningWheelSVG
                    rotation={wheelRotation}
                    isSpinning={isWheelSpinning}
                    winningNum={wheelWinner}
                  />
                </div>

                <div className="mt-4 min-h-[68px] flex items-center justify-center">
                  {isWheelSpinning ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-slate-900/90 border border-slate-700 text-sm font-bold text-emerald-300">
                      العجلة تدور... انتظر توقف المؤشر الذهبي
                    </div>
                  ) : wheelWinner !== null ? (
                    <div className="px-6 py-3 rounded-2xl bg-slate-900/95 border-2 border-emerald-500/70 shadow-[0_0_30px_rgba(16,185,129,0.25)] flex items-center gap-3">
                      <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                      <span className="text-sm sm:text-base font-bold text-slate-200">
                        توقفت الدائرة عند الرقم:
                      </span>
                      <span className="font-mono-num text-2xl sm:text-3xl font-black text-emerald-400">
                        {toArabicDigits(wheelWinner)} ({wheelWinner})
                      </span>
                    </div>
                  ) : null}
                </div>
              </div>
            )}

            {/* -------------------- MODE 4: EGYPTIAN 1 POUND COIN FLIP -------------------- */}
            {activeMode === 'coin' && (
              <div className="w-full flex flex-col items-center">
                <div className="relative my-3 sm:my-5 flex flex-col items-center justify-center">
                  <div
                    className={`w-52 h-52 sm:w-64 sm:h-64 perspective-1000 ${
                      isCoinFlipping ? 'animate-coin-arc' : ''
                    }`}
                  >
                    <div
                      className="relative w-full h-full preserve-3d"
                      style={{
                        transform: `rotateY(${coinRotationY}deg)`,
                        transition: isCoinFlipping
                          ? 'transform 1450ms cubic-bezier(0.22, 1, 0.36, 1)'
                          : 'transform 300ms ease-out',
                        willChange: 'transform',
                      }}
                    >
                      <div className="absolute inset-0 w-full h-full backface-hidden">
                        <EgyptianOnePoundSVG side="king" />
                      </div>
                      <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                        <EgyptianOnePoundSVG side="tails" />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`w-36 h-5 rounded-full bg-black/65 blur-md mt-4 ${
                      isCoinFlipping ? 'animate-coin-shadow' : 'opacity-55'
                    }`}
                  />
                </div>

                <div className="mt-2 min-h-[68px] flex items-center justify-center">
                  {isCoinFlipping ? (
                    <div className="px-5 py-2.5 rounded-2xl bg-slate-900/90 border border-amber-500/40 text-sm font-bold text-amber-300">
                      الجنيه المصري يدور في الهواء...
                    </div>
                  ) : (
                    <div className="px-6 py-3 rounded-2xl bg-slate-900/95 border-2 border-amber-500/70 shadow-[0_0_30px_rgba(245,158,11,0.25)] flex items-center gap-3">
                      <span className="text-sm sm:text-base font-bold text-slate-300">
                        {hasFlippedCoin ? 'النتيجة النهائية:' : 'الوجه الظاهر حالياً:'}
                      </span>
                      <span className="text-xl sm:text-2xl font-black text-amber-400">
                        {coinSide === 'king'
                          ? 'مَلِك (قناع توت عنخ آمون)'
                          : 'كِتَابَة (١ جنيه مصري)'}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>

          {/* =================================================================
              BOTTOM ACTION ZONE: PLAY BUTTON (زر العب) & LAST 5 HISTORY LOG
             ================================================================= */}
          <footer className="w-full max-w-2xl mx-auto px-4 sm:px-6 pb-5 pt-2 flex flex-col items-center gap-3.5 z-20">
            <button
              type="button"
              disabled={isCurrentlyAnimating}
              onClick={triggerCurrentGamePlay}
              className={`w-full sm:w-96 h-14 sm:h-16 rounded-2xl font-black text-lg sm:text-xl text-slate-950 shadow-2xl flex items-center justify-center gap-3 transition-all duration-150 cursor-pointer whitespace-nowrap ${
                isCurrentlyAnimating
                  ? 'bg-slate-700 text-slate-300 cursor-not-allowed scale-[0.99]'
                  : 'bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 active:scale-95 shadow-[0_10px_35px_rgba(245,158,11,0.4)]'
              }`}
            >
              <Sparkles className={`w-6 h-6 ${isCurrentlyAnimating ? 'animate-spin' : ''}`} />
              <span>
                {isCurrentlyAnimating
                  ? currentModeInfo?.animatingText
                  : currentModeInfo?.playButtonText || 'العب الآن'}
              </span>
            </button>

            <div className="w-full rounded-xl bg-slate-900/80 border border-slate-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-bold shrink-0">
                <History className="w-4 h-4 text-amber-400" />
                <span>سجل آخر ٥ نتائج محفوظة:</span>
              </div>

              {currentHistory.length === 0 ? (
                <span className="text-slate-500">
                  لا توجد نتائج مسجلة بعد — اضغط «العب الآن» للبدء
                </span>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {currentHistory.map((item, idx) => (
                    <React.Fragment key={item.id}>
                      {idx > 0 && (
                        <span aria-hidden="true" className="text-slate-600 font-bold">
                          ·
                        </span>
                      )}
                      <span
                        className={`font-mono-num font-bold ${
                          idx === 0
                            ? item.isSpecial
                              ? 'text-amber-300 underline decoration-amber-400/60'
                              : 'text-white'
                            : 'text-slate-400'
                        }`}
                      >
                        {item.label}
                      </span>
                    </React.Fragment>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      soundFX.playClick();
                      setHistoryByMode((prev) => ({ ...prev, [activeMode]: [] }));
                    }}
                    title="مسح السجل"
                    className="mr-2 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer inline-flex items-center gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>مسح</span>
                  </button>
                </div>
              )}
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}
