import React, { useState } from 'react';
import { WifiOff } from 'lucide-react';

export type CallSignalLevel = 'excellent' | 'good' | 'fair' | 'poor' | 'offline' | 'checking';

export interface CallNetworkQuality {
  level: CallSignalLevel;
  bars: 0 | 1 | 2 | 3 | 4;
  rttMs: number | null;
  packetLossPct: number | null;
  source: 'webrtc' | 'browser' | 'offline';
  effectiveType?: string;
}

interface CallSignalIndicatorProps {
  quality: CallNetworkQuality;
}

const LEVEL_META: Record<
  CallSignalLevel,
  {
    label: string;
    activeBarClass: string;
    containerClass: string;
    textClass: string;
  }
> = {
  excellent: {
    label: 'Strong',
    activeBarClass: 'bg-emerald-400',
    containerClass: 'bg-slate-950/84 border-emerald-400/50 text-white',
    textClass: 'text-emerald-300',
  },
  good: {
    label: 'Good',
    activeBarClass: 'bg-emerald-400',
    containerClass: 'bg-slate-950/84 border-emerald-400/40 text-white',
    textClass: 'text-emerald-200',
  },
  fair: {
    label: 'Fair',
    activeBarClass: 'bg-amber-400',
    containerClass: 'bg-amber-950/88 border-amber-400/75 text-amber-50',
    textClass: 'text-amber-200',
  },
  poor: {
    label: 'Weak',
    activeBarClass: 'bg-rose-400',
    containerClass: 'bg-rose-950/90 border-rose-400/80 text-rose-50',
    textClass: 'text-rose-200',
  },
  offline: {
    label: 'Offline',
    activeBarClass: 'bg-rose-500',
    containerClass: 'bg-rose-950/92 border-rose-500/85 text-rose-50',
    textClass: 'text-rose-200',
  },
  checking: {
    label: 'Checking',
    activeBarClass: 'bg-slate-400',
    containerClass: 'bg-slate-950/80 border-white/15 text-slate-200',
    textClass: 'text-slate-300',
  },
};

const BAR_HEIGHT_CLASSES = ['h-1.5', 'h-2.5', 'h-3.5', 'h-4'];

export const CallSignalIndicator: React.FC<CallSignalIndicatorProps> = ({ quality }) => {
  const [showDetails, setShowDetails] = useState(false);
  const meta = LEVEL_META[quality.level];

  return (
    <div className="pointer-events-auto relative flex flex-col items-start">
      <button
        type="button"
        onClick={() => setShowDetails((prev) => !prev)}
        aria-expanded={showDetails}
        aria-label={`Network connection quality: ${meta.label}${
          quality.rttMs !== null ? `, ${quality.rttMs} milliseconds latency` : ''
        }`}
        className={`min-h-[40px] px-3 py-1.5 rounded-2xl border backdrop-blur-md shadow-lg inline-flex items-center gap-2.5 text-xs font-semibold transition-colors duration-200 hover:brightness-110 active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-emerald-400 ${meta.containerClass}`}
        title="Tap for live connection details"
      >
        {quality.level === 'offline' ? (
          <WifiOff className="w-4 h-4 text-rose-300 shrink-0" aria-hidden="true" />
        ) : (
          <span className="inline-flex items-end gap-[3px] h-4 shrink-0" aria-hidden="true">
            {BAR_HEIGHT_CLASSES.map((heightCls, idx) => {
              const isActive = idx < quality.bars;
              return (
                <span
                  key={heightCls}
                  className={`w-[3.5px] rounded-[1px] transition-colors duration-200 ${heightCls} ${
                    isActive
                      ? meta.activeBarClass
                      : quality.level === 'checking'
                      ? 'bg-white/25 motion-safe:animate-pulse'
                      : 'bg-white/20'
                  }`}
                />
              );
            })}
          </span>
        )}

        <span className={`whitespace-nowrap ${meta.textClass}`}>{meta.label}</span>

        {quality.rttMs !== null && quality.level !== 'offline' && (
          <span className="font-mono tabular-nums text-[11px] text-slate-300 whitespace-nowrap">
            {quality.rttMs} ms
          </span>
        )}
      </button>

      {showDetails && (
        <div className="mt-1.5 px-3 py-2 rounded-xl bg-slate-950/92 border border-white/15 backdrop-blur-md shadow-2xl text-[11px] text-slate-200 space-y-1 min-w-[175px]">
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Signal</span>
            <span className={`font-semibold ${meta.textClass}`}>{meta.label}</span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-slate-400">Latency</span>
            <span className="font-mono tabular-nums text-white">
              {quality.rttMs !== null ? `${quality.rttMs} ms` : 'Measuring...'}
            </span>
          </div>
          {quality.packetLossPct !== null && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Packet loss</span>
              <span className="font-mono tabular-nums text-white">
                {quality.packetLossPct.toFixed(1)}%
              </span>
            </div>
          )}
          {quality.effectiveType && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Network</span>
              <span className="font-mono uppercase text-white">{quality.effectiveType}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
