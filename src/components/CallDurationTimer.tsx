import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Clock, Plus, Timer } from 'lucide-react';

export type CallTimeLimitSeconds = number | null;

const CALL_LIMIT_PRESETS: Array<{ label: string; seconds: CallTimeLimitSeconds }> = [
  { label: '15m', seconds: 15 * 60 },
  { label: '30m', seconds: 30 * 60 },
  { label: '60m', seconds: 60 * 60 },
  { label: 'No limit', seconds: null },
];

export function formatCallClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) {
    return `${String(hrs).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

interface CallDurationTimerProps {
  elapsedSec: number;
  limitSec: CallTimeLimitSeconds;
  onChangeLimit: (nextLimit: CallTimeLimitSeconds) => void;
  onExtendFiveMin: () => void;
  isConnected: boolean;
}

export const CallDurationTimer: React.FC<CallDurationTimerProps> = ({
  elapsedSec,
  limitSec,
  onChangeLimit,
  onExtendFiveMin,
  isConnected,
}) => {
  const lastAlertStageRef = useRef<'normal' | 'warning' | 'critical' | 'exceeded'>('normal');

  const remainingSec = limitSec !== null ? Math.max(0, limitSec - elapsedSec) : null;
  const warningThresholdSec = limitSec !== null ? Math.min(300, Math.max(60, Math.floor(limitSec * 0.2))) : 0;

  let stage: 'normal' | 'warning' | 'critical' | 'exceeded' = 'normal';
  if (limitSec !== null && remainingSec !== null) {
    if (remainingSec <= 0) {
      stage = 'exceeded';
    } else if (remainingSec <= 60) {
      stage = 'critical';
    } else if (remainingSec <= warningThresholdSec) {
      stage = 'warning';
    }
  }

  // Play a gentle single chime when entering critical or exceeded stage
  useEffect(() => {
    if (!isConnected) {
      lastAlertStageRef.current = 'normal';
      return;
    }
    const prev = lastAlertStageRef.current;
    lastAlertStageRef.current = stage;
    if ((stage === 'critical' && prev !== 'critical') || (stage === 'exceeded' && prev !== 'exceeded')) {
      try {
        const AudioCtx =
          window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = new AudioCtx();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(stage === 'exceeded' ? 660 : 520, now);
        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.3);
        window.setTimeout(() => {
          ctx.close().catch(() => {});
        }, 450);
      } catch {
        // Ignore audio playback errors if browser audio is locked
      }
    }
  }, [stage, isConnected]);

  const progressPct =
    limitSec !== null && limitSec > 0 ? Math.min(100, Math.max(0, (elapsedSec / limitSec) * 100)) : 0;

  const cycleLimitPreset = () => {
    const currentIdx = CALL_LIMIT_PRESETS.findIndex((p) => p.seconds === limitSec);
    const nextPreset = CALL_LIMIT_PRESETS[(currentIdx + 1) % CALL_LIMIT_PRESETS.length];
    onChangeLimit(nextPreset.seconds);
  };

  const currentLimitLabel =
    limitSec === null
      ? 'No limit'
      : `${Math.round(limitSec / 60)}m limit`;

  if (!isConnected) return null;

  const containerTone =
    stage === 'exceeded' || stage === 'critical'
      ? 'bg-rose-950/92 border-rose-400/90 text-rose-50 shadow-rose-950/60'
      : stage === 'warning'
      ? 'bg-amber-950/90 border-amber-400/85 text-amber-50 shadow-amber-950/50'
      : 'bg-slate-950/88 border-emerald-400/60 text-white shadow-black/50';

  const clockColor =
    stage === 'exceeded' || stage === 'critical'
      ? 'text-rose-100'
      : stage === 'warning'
      ? 'text-amber-200'
      : 'text-emerald-300';

  const progressBarFill =
    stage === 'exceeded' || stage === 'critical'
      ? 'fill-rose-400'
      : stage === 'warning'
      ? 'fill-amber-400'
      : 'fill-emerald-400';

  return (
    <div
      role="timer"
      aria-live={stage === 'normal' ? 'off' : 'polite'}
      className={`pointer-events-auto relative overflow-hidden rounded-2xl border backdrop-blur-md shadow-2xl transition-colors duration-200 ${containerTone}`}
    >
      <div className="px-3.5 py-2 flex items-center gap-3">
        {/* Prominent Elapsed Time Readout */}
        <div className="flex items-center gap-2 min-w-0">
          {stage === 'warning' || stage === 'critical' || stage === 'exceeded' ? (
            <AlertTriangle
              className={`w-4 h-4 shrink-0 ${
                stage === 'warning'
                  ? 'text-amber-300'
                  : 'text-rose-300 motion-safe:animate-pulse'
              }`}
              aria-hidden="true"
            />
          ) : (
            <Clock className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />
          )}

          <div className="flex flex-col leading-none">
            <span className={`font-mono tabular-nums text-lg sm:text-xl font-bold tracking-wider ${clockColor}`}>
              {formatCallClock(elapsedSec)}
            </span>
            <span className="text-[11px] font-medium mt-1 whitespace-nowrap">
              {stage === 'exceeded' ? (
                <span className="text-rose-200 font-semibold">Time limit reached</span>
              ) : stage === 'critical' && remainingSec !== null ? (
                <span className="text-rose-200 font-semibold font-mono tabular-nums">
                  {formatCallClock(remainingSec)} left · Ending soon
                </span>
              ) : stage === 'warning' && remainingSec !== null ? (
                <span className="text-amber-200 font-semibold font-mono tabular-nums">
                  {formatCallClock(remainingSec)} remaining
                </span>
              ) : remainingSec !== null ? (
                <span className="text-slate-300 font-mono tabular-nums">
                  {formatCallClock(remainingSec)} left
                </span>
              ) : (
                <span className="text-slate-300">Live call · No limit</span>
              )}
            </span>
          </div>
        </div>

        {/* Action Controls: Quick +5m Extend during warnings, or Limit Preset Switcher */}
        <div className="flex items-center gap-1.5 pl-2 border-l border-white/15 shrink-0">
          {(stage === 'warning' || stage === 'critical' || stage === 'exceeded') && (
            <button
              type="button"
              onClick={onExtendFiveMin}
              className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 active:scale-[0.98] text-white text-xs font-bold inline-flex items-center gap-1 whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-white"
              title="Add 5 minutes to call timer limit"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>5m</span>
            </button>
          )}
          <button
            type="button"
            onClick={cycleLimitPreset}
            className="min-h-[40px] px-2.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 active:scale-[0.98] text-slate-100 text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-emerald-400"
            title="Switch call time limit (15m / 30m / 60m / No limit)"
          >
            <Timer className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
            <span>{currentLimitLabel}</span>
          </button>
        </div>
      </div>

      {/* Subtle Bottom Progress Track when a call limit is active */}
      {limitSec !== null && (
        <svg className="block w-full h-[3px]" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0" y="0" width="100" height="3" className="fill-white/10" />
          <rect x="0" y="0" width={progressPct} height="3" className={progressBarFill} />
        </svg>
      )}
    </div>
  );
};
