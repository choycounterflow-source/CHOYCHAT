import React, { useRef } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Ban, Check, Droplets, ImagePlus, Sparkles, X } from 'lucide-react';
import type { VideoBackgroundPresetId } from '../utils/videoBackgroundProcessor';

export interface VideoBackgroundOption {
  id: VideoBackgroundPresetId;
  label: string;
  subtitle: string;
  swatchClass: string;
}

export const VIDEO_BACKGROUND_OPTIONS: VideoBackgroundOption[] = [
  {
    id: 'none',
    label: 'None',
    subtitle: 'Original camera',
    swatchClass: 'bg-slate-800 border-slate-600',
  },
  {
    id: 'soft-blur',
    label: 'Soft Blur',
    subtitle: 'Subtle depth',
    swatchClass: 'bg-gradient-to-br from-slate-700 via-emerald-900/70 to-slate-800 border-emerald-400/40',
  },
  {
    id: 'strong-blur',
    label: 'Strong Blur',
    subtitle: 'Studio focus',
    swatchClass: 'bg-gradient-to-br from-slate-800 via-teal-900/80 to-slate-950 border-teal-400/50',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    subtitle: 'Lounge glow',
    swatchClass: 'bg-gradient-to-br from-emerald-950 via-emerald-700 to-amber-500/40 border-emerald-400/60',
  },
  {
    id: 'office',
    label: 'Office',
    subtitle: 'Sunlit studio',
    swatchClass: 'bg-gradient-to-br from-amber-50 via-slate-200 to-amber-800/70 border-amber-200/70',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    subtitle: 'Warm horizon',
    swatchClass: 'bg-gradient-to-br from-indigo-950 via-rose-700 to-amber-400 border-amber-400/60',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    subtitle: 'Cool rim light',
    swatchClass: 'bg-gradient-to-br from-slate-950 via-sky-900 to-indigo-900 border-sky-400/50',
  },
];

interface VideoBackgroundPickerProps {
  isOpen: boolean;
  activePreset: VideoBackgroundPresetId;
  customImageUrl: string | null;
  isApplying: boolean;
  onSelectPreset: (preset: VideoBackgroundPresetId, customUrl?: string | null) => void;
  onClose: () => void;
}

export const VideoBackgroundPicker: React.FC<VideoBackgroundPickerProps> = ({
  isOpen,
  activePreset,
  customImageUrl,
  isApplying,
  onSelectPreset,
  onClose,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const handleFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSelectPreset('custom', reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          key="video-background-picker"
          initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
          animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="VideoBackgroundPicker w-full max-w-3xl mt-3 rounded-2xl bg-slate-900/95 border border-emerald-500/40 backdrop-blur-md p-3.5 sm:p-4 shadow-2xl space-y-3"
          role="region"
          aria-label="Video Call Background Effects"
        >
          <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-xs font-bold text-white truncate">Background Blur &amp; Virtual Scenes</h4>
            <p className="text-[10px] text-slate-300 truncate">
              Processed live via media stream processor before sending to participants
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-white/10 transition shrink-0"
          aria-label="Close background picker"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
        {VIDEO_BACKGROUND_OPTIONS.map((option) => {
          const isSelected = activePreset === option.id;
          return (
            <button
              key={option.id}
              type="button"
              disabled={isApplying}
              onClick={() => onSelectPreset(option.id)}
              className={`min-h-[64px] p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition disabled:opacity-60 ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/60 text-white'
                  : 'bg-slate-950/70 border-white/10 hover:border-emerald-400/50 text-slate-200'
              }`}
            >
              <div
                className={`relative w-8 h-6 rounded-md border flex items-center justify-center overflow-hidden ${option.swatchClass}`}
              >
                {option.id === 'none' && <Ban className="w-3.5 h-3.5 text-slate-300" />}
                {(option.id === 'soft-blur' || option.id === 'strong-blur') && (
                  <Droplets className="w-3.5 h-3.5 text-emerald-200" />
                )}
                {isSelected && (
                  <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </div>
              <span className="text-[10px] font-bold leading-tight truncate w-full">{option.label}</span>
            </button>
          );
        })}

        <button
          type="button"
          disabled={isApplying}
          onClick={() => fileInputRef.current?.click()}
          className={`min-h-[64px] p-1.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition disabled:opacity-60 ${
            activePreset === 'custom'
              ? 'bg-emerald-500/20 border-emerald-400 ring-2 ring-emerald-400/60 text-white'
              : 'bg-slate-950/70 border-white/10 hover:border-emerald-400/50 text-slate-200'
          }`}
        >
          <div className="relative w-8 h-6 rounded-md border border-dashed border-emerald-400/60 bg-slate-900 flex items-center justify-center overflow-hidden">
            {customImageUrl ? (
              <img src={customImageUrl} alt="Custom background" className="w-full h-full object-cover" />
            ) : (
              <ImagePlus className="w-3.5 h-3.5 text-emerald-300" />
            )}
            {activePreset === 'custom' && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center">
                <Check className="w-2.5 h-2.5 stroke-[3]" />
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold leading-tight truncate w-full">Upload</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFilePicked}
          className="hidden"
        />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
