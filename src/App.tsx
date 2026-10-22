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

// ============================================================================
// WEB AUDIO API SOUND SYNTHESIZER (ZERO EXTERNAL ASSETS)
// ============================================================================

class WebAudioSynthesizer {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private getContext(): AudioContext | null {
    if (this.isMuted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
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
    // Bimetallic dual-harmonic ring (silver + brass frequencies)
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
    const notes = isDoubleOrSpecial ? [523.25, 659.25, 783.99, 1046.5] : [523.25, 659.25, 783.99];
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

/**
 * Crisp 3D-Styled Die Component with Recessed Pips & Specular Bevel
 */
const Die3DCard: React.FC<{
  value: number;
  label: string;
  isRolling: boolean;
  variant: 1 | 2;
  isDouble: boolean;
}> = ({ value, label, isRolling, variant, isDouble }) => {
  // Standard 3x3 grid coordinates for dice pips (1 to 6)
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
          isRolling
            ? variant === 1
              ? 'animate-dice-1'
              : 'animate-dice-2'
            : ''
        } ${
          isDouble && !isRolling
            ? 'bg-gradient-to-br from-amber-50 via-white to-amber-100 shadow-[0_14px_0_#b45309,0_22px_45px_rgba(245,158,11,0.45)] ring-2 ring-amber-400'
            : 'bg-gradient-to-br from-white via-slate-100 to-slate-200 shadow-[0_12px_0_#64748b,0_20px_38px_rgba(0,0,0,0.65)] ring-1 ring-white/80'
        }`}
      >
        {/* Top inner bevel highlight */}
        <div className="absolute inset-1.5 rounded-2xl border border-white/70 pointer-events-none" />

        {/* 3x3 Pip Grid */}
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

      {/* Die Subtitle readout */}
      <div className="flex items-center gap-2 text-sm text-slate-300 font-medium">
        <span>{label}</span>
        <span aria-hidden="true" className="text-slate-600">·</span>
        <span className="font-mono-num font-bold text-white text-base">
          {isRolling ? '...' : `${toArabicDigits(value)} (${value})`}
        </span>
      </div>
    </div>
  );
};

/**
 * Authentic Egyptian 1 Pound Bimetallic Coin (ملك وكتابة)
 * Side A: Golden Mask of Tutankhamun (ملك)
 * Side B: Arab Republic of Egypt - 1 Pound Calligraphy (كتابة)
 */
const EgyptianOnePoundSVG: React.FC<{ side: 'king' | 'tails' }> = ({ side }) => {
  const uid = side === 'king' ? 'king' : 'tails';
  return (
    <svg
      viewBox="0 0 260 260"
      className="w-full h-full drop-shadow-[0_12px_25px_rgba(0,0,0,0.65)] select-none"
      aria-label={side === 'king' ? 'وجه العملة: ملك - قناع توت عنخ آمون' : 'ظهر العملة: كتابة - ١ جنيه مصري'}
    >
      <defs>
        {/* Outer Silver-Nickel Ring Gradient */}
        <linearGradient id={`silverRing-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f1f5f9" />
          <stop offset="28%" stopColor="#cbd5e1" />
          <stop offset="55%" stopColor="#94a3b8" />
          <stop offset="80%" stopColor="#475569" />
          <stop offset="100%" stopColor="#cbd5e1" />
        </linearGradient>

        {/* Inner Silver Bevel */}
        <linearGradient id={`silverBevel-${uid}`} x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="50%" stopColor="#e2e8f0" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>

        {/* Inner Gold-Brass Core Gradient */}
        <radialGradient id={`goldCore-${uid}`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor="#fef9c3" />
          <stop offset="30%" stopColor="#fde047" />
          <stop offset="68%" stopColor="#ca8a04" />
          <stop offset="92%" stopColor="#854d0e" />
          <stop offset="100%" stopColor="#713f12" />
        </radialGradient>

        {/* Raised Gold Relief Gradient */}
        <linearGradient id={`goldRelief-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="45%" stopColor="#eab308" />
          <stop offset="85%" stopColor="#a16207" />
          <stop offset="100%" stopColor="#fde047" />
        </linearGradient>
      </defs>

      {/* Outer Milled Edge (Reeded Rim) */}
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

      {/* Main Outer Silver Ring */}
      <circle
        cx="130"
        cy="130"
        r="119"
        fill={`url(#silverRing-${uid})`}
        stroke="#e2e8f0"
        strokeWidth="1.2"
      />

      {/* Decorative Pharaonic / Bead Ring on Silver Border */}
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

      {/* Bimetallic Seam Between Silver Outer Ring and Brass Inner Core */}
      <circle
        cx="130"
        cy="130"
        r="84"
        fill="#475569"
        stroke="#1e293b"
        strokeWidth="2"
      />

      {/* Inner Gold/Brass Core */}
      <circle
        cx="130"
        cy="130"
        r="81"
        fill={`url(#goldCore-${uid})`}
        stroke="#fef08a"
        strokeWidth="1.2"
      />

      {/* Inner Core Ornate Ring */}
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
        /* ==================== SIDE A: ملك (KING TUTANKHAMUN MASK) ==================== */
        <g>
          {/* Outer Silver Ring Texts */}
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

          {/* Left & Right Pharaonic Lotus Stars on Silver Ring */}
          <circle cx="28" cy="130" r="4" fill="#334155" />
          <circle cx="232" cy="130" r="4" fill="#334155" />

          {/* Stylized Golden Mask of Tutankhamun in Center */}
          <g transform="translate(130, 128)">
            {/* Nemes Headdress Outer Silhouette */}
            <path
              d="M -46,16 L -52,-8 C -52,-38 -30,-56 0,-56 C 30,-56 52,-38 52,-8 L 46,16 L 34,42 L -34,42 Z"
              fill={`url(#goldRelief-${uid})`}
              stroke="#713f12"
              strokeWidth="2.2"
            />

            {/* Nemes Horizontal Stripes (Left & Right Flaps) */}
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

            {/* Broad Pharaonic Usekh Collar */}
            <path
              d="M -34,32 Q 0,48 34,32 L 28,45 Q 0,58 -28,45 Z"
              fill="#ca8a04"
              stroke="#713f12"
              strokeWidth="1.8"
            />

            {/* Royal Face Shield */}
            <path
              d="M -23,-22 C -23,-36 23,-36 23,-22 L 21,8 C 21,23 11,32 0,32 C -11,32 -21,23 -21,8 Z"
              fill="#fef08a"
              stroke="#713f12"
              strokeWidth="2"
            />

            {/* Forehead Headband & Uraeus (Cobra & Vulture Emblem) */}
            <path d="M -24,-22 Q 0,-27 24,-22" fill="none" stroke="#713f12" strokeWidth="2.5" />
            <circle cx="-6" cy="-35" r="5" fill="#b45309" stroke="#713f12" strokeWidth="1.5" />
            <circle cx="6" cy="-35" r="5" fill="#b45309" stroke="#713f12" strokeWidth="1.5" />
            <path d="M 0,-46 L -4,-30 L 4,-30 Z" fill="#fef08a" stroke="#713f12" strokeWidth="1.4" />

            {/* Pharaoh Eyes & Kohl Lines */}
            <ellipse cx="-9" cy="-10" rx="5" ry="2.5" fill="#713f12" />
            <ellipse cx="9" cy="-10" rx="5" ry="2.5" fill="#713f12" />
            <path d="M -15,-14 Q -9,-17 -3,-14" fill="none" stroke="#713f12" strokeWidth="1.6" />
            <path d="M 3,-14 Q 9,-17 15,-14" fill="none" stroke="#713f12" strokeWidth="1.6" />

            {/* Nose & Serene Royal Lips */}
            <path d="M 0,-12 L -2.5,2 L 2.5,2" fill="none" stroke="#713f12" strokeWidth="1.6" />
            <path d="M -7,10 Q 0,14 7,10" fill="none" stroke="#713f12" strokeWidth="1.8" />

            {/* Ceremonial Braided False Beard */}
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
        /* ==================== SIDE B: كتابة (JUMHURIYAT MISR AL-ARABIYAH - 1 POUND) ==================== */
        <g>
          {/* Top Silver Ring Inscription: جمهورية مصر العربية */}
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

          {/* Bottom Silver Ring Inscription: ONE EGYPTIAN POUND */}
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

          {/* Hijri & Gregorian Year Stamps on Silver Ring Sides */}
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

          {/* Subtle Arabesque Geometric Star in Gold Core */}
          <g transform="translate(130, 130)" opacity="0.28" stroke="#713f12" strokeWidth="1.5" fill="none">
            <rect x="-46" y="-46" width="92" height="92" rx="6" />
            <rect x="-46" y="-46" width="92" height="92" rx="6" transform="rotate(45)" />
          </g>

          {/* Prominent Arabic Numeral ١ (1) and جنيه (Pound) in Gold Center */}
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

/**
 * Custom-Crafted 6-Segment Spinning Wheel SVG (Numbers 1 to 6)
 */
const SpinningWheelSVG: React.FC<{
  rotation: number;
  isSpinning: boolean;
  winningNum: number | null;
}> = ({ rotation, isSpinning, winningNum }) => {
  const cx = 160;
  const cy = 160;
  const radius = 142;

  // Helper to build a 60-degree SVG pie slice centered at `index * 60` degrees clockwise from 12 o'clock (-90deg)
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
      {/* Ambient Outer Glow */}
      <div className="absolute inset-2 rounded-full bg-gradient-to-tr from-emerald-500/20 via-amber-500/15 to-cyan-500/20 blur-xl pointer-events-none" />

      {/* Fixed Top Golden/Neon Pointer Arrow at 12 o'clock */}
      <div
        className={`absolute -top-4 left-1/2 -translate-x-1/2 z-30 transition-transform duration-150 ${
          isSpinning ? 'scale-110' : 'scale-100'
        }`}
      >
        <svg width="44" height="48" viewBox="0 0 44 48" className="drop-shadow-[0_6px_12px_rgba(0,0,0,0.75)]">
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

      {/* Rotating Wheel Container */}
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

          {/* Outer Metallic Rim */}
          <circle
            cx={cx}
            cy={cy}
            r="156"
            fill="#1e293b"
            stroke="#475569"
            strokeWidth="4"
          />
          <circle
            cx={cx}
            cy={cy}
            r="146"
            fill="#0f172a"
            stroke="#f59e0b"
            strokeWidth="2"
          />

          {/* 6 Radial Colored Segments */}
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
                {/* Segment Number Label */}
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

          {/* Rim Pegs / Studs on Segment Boundaries */}
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

          {/* Center Golden Hub */}
          <circle
            cx={cx}
            cy={cy}
            r="30"
            fill="#0f172a"
            stroke="#475569"
            strokeWidth="3"
          />
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
// MAIN APPLICATION COMPONENT
// ============================================================================

export default function App() {
  // Navigation & Dropdown state
  const [activeMode, setActiveMode] = useState<GameModeId>('home');
  const [isHomeDropdownOpen, setIsHomeDropdownOpen] = useState(false);
  const [isHeaderDropdownOpen, setIsHeaderDropdownOpen] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Per-game History Log (Last 5 rolls per mode)
  const [historyByMode, setHistoryByMode] = useState<Record<Exclude<GameModeId, 'home'>, HistoryEntry[]>>({
    dice: [],
    number: [],
    wheel: [],
    coin: [],
  });

  // -------------------- Mode 1: Dual 3D Dice State --------------------
  const [die1, setDie1] = useState<number>(6);
  const [die2, setDie2] = useState<number>(6);
  const [isDiceRolling, setIsDiceRolling] = useState<boolean>(false);
  const [hasRolledDice, setHasRolledDice] = useState<boolean>(false);

  // -------------------- Mode 2: Random Number State --------------------
  const [minNumInput, setMinNumInput] = useState<string>('1');
  const [maxNumInput, setMaxNumInput] = useState<string>('100');
  const [currentNumber, setCurrentNumber] = useState<number>(77);
  const [isNumberRolling, setIsNumberRolling] = useState<boolean>(false);
  const [hasGeneratedNumber, setHasGeneratedNumber] = useState<boolean>(false);

  // -------------------- Mode 3: Spinning Wheel 1-6 State --------------------
  const [wheelRotation, setWheelRotation] = useState<number>(0);
  const [isWheelSpinning, setIsWheelSpinning] = useState<boolean>(false);
  const [wheelWinner, setWheelWinner] = useState<number | null>(null);

  // -------------------- Mode 4: Egyptian 1 Pound Coin Flip State --------------------
  const [coinSide, setCoinSide] = useState<'king' | 'tails'>('king');
  const [coinRotationY, setCoinRotationY] = useState<number>(0);
  const [isCoinFlipping, setIsCoinFlipping] = useState<boolean>(false);
  const [hasFlippedCoin, setHasFlippedCoin] = useState<boolean>(false);

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

  // Close custom dropdowns when clicking outside
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
        second: '2-digit',
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
  };

  // ============================================================================
  // GAME 1 HANDLER: DUAL 3D DICE ROLLER (600ms)
  // ============================================================================
  const handlePlayDice = () => {
    if (isDiceRolling) return;
    setIsDiceRolling(true);
    triggerHaptic([25, 40, 25]);
    soundFX.playDiceRollSequence();

    // Rapid intermediate face shuffling during 600ms tumble
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
    // Segment `winningSegmentNum` is at `(winningSegmentNum - 1) * 60` deg clockwise from top.
    // To align it under the top pointer (0 deg), final rotation mod 360 must equal `(360 - (winningSegmentNum - 1) * 60) % 360`.
    const targetMod = (360 - (winningSegmentNum - 1) * 60) % 360;
    const jitter = getCryptoRandomInt(-14, 14);
    const desiredFinalMod = (targetMod + jitter + 360) % 360;
    const currentMod = ((wheelRotation % 360) + 360) % 360;
    const delta = (desiredFinalMod - currentMod + 360) % 360;

    // Guarantee at least 5 full spins (1800deg) + random extra spin
    const extraFullSpins = getCryptoRandomInt(5, 7) * 360;
    const nextRotation = wheelRotation + extraFullSpins + delta;
    setWheelRotation(nextRotation);

    // Schedule decelerating peg tick sounds over 2.4 seconds
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

    // Cryptographically fair 0 or 1: 0 => 'king' (ملك), 1 => 'tails' (كتابة)
    const outcomeBit = getCryptoRandomInt(0, 1);
    const nextSide: 'king' | 'tails' = outcomeBit === 0 ? 'king' : 'tails';

    // Side 'king' corresponds to 0deg mod 360; 'tails' corresponds to 180deg mod 360
    const targetMod = nextSide === 'king' ? 0 : 180;
    const currentMod = ((coinRotationY % 360) + 360) % 360;
    const delta = (targetMod - currentMod + 360) % 360;

    // Minimum 6 full 3D flips (2160deg) + delta
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
          VIEW 1: HOME VIEW (الصفحة الرئيسية)
         ===================================================================== */}
      {activeMode === 'home' ? (
        <div className="relative z-10 flex flex-col min-h-[100dvh]">
          {/* Strict 3-Zone Top Bar Contract */}
          <header className="w-full max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-4 border-b border-slate-800/80">
            {/* Zone 1: Single text element wordmark */}
            <a
              href="#top"
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

            {/* Zone 3: 1 Primary Action (Sound Toggle) */}
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
          <main className="flex-1 w-full max-w-6xl mx-auto px-5 sm:px-8 py-8 sm:py-12 flex flex-col justify-center">
            <div className="text-center max-w-3xl mx-auto mb-8 sm:mb-10">
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
                اختر اللعبة المطلوبة من القائمة المنسدلة بالأسفل للانتقال فوراً إلى شاشة اللعب الكاملة بنظام قرعة عادل ودقيق ١٠٠٪.
              </p>
            </div>

            {/* PROMINENT HIGH-TECH DROPDOWN MENU (قائمة منسدلة احترافية) */}
            <div ref={homeDropdownRef} className="relative w-full max-w-xl mx-auto mb-10 z-30">
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

              {/* Dropdown Menu Items */}
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

            {/* Quick-Select Visual Preview Cards Grid (4 Modes) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {GAME_MODES.map((mode) => {
                const IconComponent =
                  mode.id === 'dice'
                    ? Dices
                    : mode.id === 'number'
                    ? Hash
                    : mode.id === 'wheel'
                    ? Compass
                    : Coins;

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

                      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
                        {mode.subtitle}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-800/90 flex items-center justify-between text-xs text-slate-400">
                      <span>{mode.badgeText}</span>
                      <span className="font-bold text-amber-400 group-hover:underline whitespace-nowrap">
                        العب الآن ←
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </main>

          {/* Quiet Footer */}
          <footer className="w-full max-w-7xl mx-auto px-6 py-4 border-t border-slate-800/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-400">
            <span>رفيق الألعاب العشوائي الاحترافي · نتائج عشوائية عادلة ومضمونة</span>
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
              {/* Sound Mute/Unmute Button */}
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

              {/* Quick Mode Switcher Dropdown */}
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
            {/* Game Title Header */}
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
                {/* 3D Dice Arena */}
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

                {/* Output Display: Total Sum & Double (دش) Indicator */}
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
                {/* Min / Max Controls & Quick Presets */}
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

                  {/* Interactive Preset Filter Buttons */}
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

                {/* Massive Digital Cyber-Counter Display */}
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

                {/* Celebratory Winning Number Readout */}
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
                  ) : (
                    <div className="text-xs sm:text-sm text-slate-400">
                      اضغط على «العب الآن» لتدوير العجلة السداسية
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* -------------------- MODE 4: EGYPTIAN 1 POUND COIN FLIP -------------------- */}
            {activeMode === 'coin' && (
              <div className="w-full flex flex-col items-center">
                {/* 3D Bimetallic Coin Arena */}
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
                      {/* Front Face: ملك (King Tutankhamun) */}
                      <div className="absolute inset-0 w-full h-full backface-hidden">
                        <EgyptianOnePoundSVG side="king" />
                      </div>

                      {/* Back Face: كتابة (1 Egyptian Pound Text) */}
                      <div className="absolute inset-0 w-full h-full backface-hidden rotate-y-180">
                        <EgyptianOnePoundSVG side="tails" />
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Floor Shadow */}
                  <div
                    className={`w-36 h-5 rounded-full bg-black/65 blur-md mt-4 ${
                      isCoinFlipping ? 'animate-coin-shadow' : 'opacity-55'
                    }`}
                  />
                </div>

                {/* Result Announcement Banner */}
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
            {/* Large Glowing Tactile Action Button (زر العب) */}
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

            {/* History Log Bar (سجل النتائج الأخيرة - آخر ٥ نتائج) */}
            <div className="w-full rounded-xl bg-slate-900/80 border border-slate-800/90 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 text-slate-400 font-bold shrink-0">
                <History className="w-4 h-4 text-amber-400" />
                <span>سجل آخر ٥ نتائج:</span>
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
