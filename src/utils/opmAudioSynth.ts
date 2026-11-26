export type OpmGenreGroup = 'classic' | 'indie' | 'ballad' | 'custom';

export interface OpmSongTrack {
  id: string;
  title: string;
  artist: string;
  year: string;
  genre: string;
  genreGroup: OpmGenreGroup;
  bpm: number;
  durationSec: number;
  coverGradient: string;
  isCustom?: boolean;
  audioUrl?: string;
}

interface SynthArrangement {
  bpm: number;
  beatsPerBar: number;
  bars: number;
  instrument: 'acoustic' | 'rhodes' | 'piano' | 'blues';
  chords: number[][]; // MIDI note arrays per bar (cycles if bars > chords.length)
  melody: Array<{ step: number; midi: number; lenSteps: number }>; // step in 8th notes per bar
}

export const OPM_PLAYLIST: OpmSongTrack[] = [
  {
    id: 'opm-huling-el-bimbo',
    title: 'Ang Huling El Bimbo',
    artist: 'Eraserheads (Acoustic Mix)',
    year: '1995',
    genre: 'OPM Rock',
    genreGroup: 'classic',
    bpm: 106,
    durationSec: 36,
    coverGradient: 'from-amber-600 via-orange-700 to-emerald-900',
  },
  {
    id: 'opm-tadhana',
    title: 'Tadhana',
    artist: 'Up Dharma Down (Rhodes Mix)',
    year: '2012',
    genre: 'Indie Soul',
    genreGroup: 'indie',
    bpm: 92,
    durationSec: 42,
    coverGradient: 'from-indigo-700 via-slate-800 to-teal-900',
  },
  {
    id: 'opm-214',
    title: '214',
    artist: 'Rivermaya (Piano Ballad)',
    year: '1994',
    genre: 'OPM Classic',
    genreGroup: 'classic',
    bpm: 82,
    durationSec: 46,
    coverGradient: 'from-emerald-700 via-teal-800 to-slate-900',
  },
  {
    id: 'opm-buwan',
    title: 'Buwan',
    artist: 'Juan Karlos (Midnight 6/8)',
    year: '2018',
    genre: 'Blues Soul',
    genreGroup: 'ballad',
    bpm: 84,
    durationSec: 40,
    coverGradient: 'from-slate-800 via-amber-900 to-slate-950',
  },
  {
    id: 'opm-kundiman',
    title: 'Kundiman',
    artist: 'Silent Sanctuary (Harana Mix)',
    year: '2007',
    genre: 'Acoustic Strings',
    genreGroup: 'ballad',
    bpm: 88,
    durationSec: 44,
    coverGradient: 'from-rose-700 via-amber-800 to-emerald-950',
  },
  {
    id: 'opm-kathang-isip',
    title: 'Kathang Isip',
    artist: 'Ben&Ben (Folk Breeze)',
    year: '2017',
    genre: 'Indie Folk',
    genreGroup: 'indie',
    bpm: 96,
    durationSec: 40,
    coverGradient: 'from-sky-700 via-emerald-800 to-slate-900',
  },
  {
    id: 'opm-rainbow',
    title: 'Rainbow',
    artist: 'South Border (Smooth R&B)',
    year: '2005',
    genre: 'OPM R&B',
    genreGroup: 'ballad',
    bpm: 86,
    durationSec: 44,
    coverGradient: 'from-amber-500 via-rose-700 to-indigo-900',
  },
  {
    id: 'opm-with-a-smile',
    title: 'With A Smile',
    artist: 'Eraserheads (Sunny Acoustic)',
    year: '1994',
    genre: 'OPM Classic',
    genreGroup: 'classic',
    bpm: 100,
    durationSec: 38,
    coverGradient: 'from-emerald-500 via-teal-700 to-sky-900',
  },
];

// Expressive chord & motif arrangements keyed to each OPM track
const ARRANGEMENTS: Record<string, SynthArrangement> = {
  'opm-huling-el-bimbo': {
    // Classic G - A7 - C - G cycle
    bpm: 106,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'acoustic',
    chords: [
      [43, 55, 59, 62, 67], // G
      [45, 55, 61, 64, 69], // A7
      [48, 55, 60, 64, 67], // C
      [43, 55, 59, 62, 67], // G
    ],
    melody: [
      { step: 0, midi: 74, lenSteps: 2 },
      { step: 2, midi: 76, lenSteps: 2 },
      { step: 4, midi: 74, lenSteps: 2 },
      { step: 6, midi: 71, lenSteps: 2 },
      { step: 8, midi: 73, lenSteps: 3 },
      { step: 11, midi: 71, lenSteps: 1 },
      { step: 12, midi: 69, lenSteps: 4 },
      { step: 16, midi: 72, lenSteps: 2 },
      { step: 18, midi: 74, lenSteps: 2 },
      { step: 20, midi: 76, lenSteps: 2 },
      { step: 22, midi: 74, lenSteps: 2 },
      { step: 24, midi: 71, lenSteps: 4 },
      { step: 28, midi: 67, lenSteps: 4 },
    ],
  },
  'opm-tadhana': {
    // Dreamy F#m9 - Dmaj7 - A - E progression
    bpm: 92,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'rhodes',
    chords: [
      [42, 54, 57, 61, 68], // F#m9
      [50, 57, 61, 66, 69], // Dmaj7
      [45, 57, 61, 64, 69], // A
      [40, 56, 59, 64, 68], // E
    ],
    melody: [
      { step: 1, midi: 73, lenSteps: 2 },
      { step: 3, midi: 76, lenSteps: 3 },
      { step: 6, midi: 73, lenSteps: 2 },
      { step: 9, midi: 78, lenSteps: 3 },
      { step: 12, midi: 76, lenSteps: 2 },
      { step: 14, midi: 73, lenSteps: 2 },
      { step: 17, midi: 71, lenSteps: 3 },
      { step: 20, midi: 73, lenSteps: 2 },
      { step: 22, midi: 69, lenSteps: 2 },
      { step: 24, midi: 71, lenSteps: 4 },
      { step: 28, midi: 68, lenSteps: 4 },
    ],
  },
  'opm-214': {
    // Lush E - B/D# - C#m - B - A - E ballad feel
    bpm: 82,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'piano',
    chords: [
      [40, 52, 56, 59, 64], // E
      [47, 54, 59, 63, 66], // B
      [49, 56, 61, 64, 68], // C#m
      [45, 52, 57, 61, 64], // A
    ],
    melody: [
      { step: 0, midi: 71, lenSteps: 3 },
      { step: 3, midi: 73, lenSteps: 1 },
      { step: 4, midi: 76, lenSteps: 4 },
      { step: 8, midi: 75, lenSteps: 3 },
      { step: 11, midi: 73, lenSteps: 1 },
      { step: 12, midi: 71, lenSteps: 4 },
      { step: 16, midi: 73, lenSteps: 3 },
      { step: 19, midi: 75, lenSteps: 1 },
      { step: 20, midi: 76, lenSteps: 2 },
      { step: 22, midi: 73, lenSteps: 2 },
      { step: 24, midi: 71, lenSteps: 4 },
      { step: 28, midi: 69, lenSteps: 4 },
    ],
  },
  'opm-buwan': {
    // Moody 6/8 Am - F - C - G sway
    bpm: 84,
    beatsPerBar: 3,
    bars: 18,
    instrument: 'blues',
    chords: [
      [45, 52, 57, 60, 64], // Am
      [41, 53, 57, 60, 65], // F
      [48, 55, 60, 64, 67], // C
      [43, 55, 59, 62, 67], // G
    ],
    melody: [
      { step: 0, midi: 72, lenSteps: 3 },
      { step: 3, midi: 76, lenSteps: 2 },
      { step: 5, midi: 74, lenSteps: 1 },
      { step: 6, midi: 72, lenSteps: 4 },
      { step: 10, midi: 69, lenSteps: 2 },
      { step: 12, midi: 72, lenSteps: 3 },
      { step: 15, midi: 74, lenSteps: 2 },
      { step: 17, midi: 72, lenSteps: 1 },
      { step: 18, midi: 71, lenSteps: 4 },
      { step: 22, midi: 67, lenSteps: 2 },
    ],
  },
  'opm-kundiman': {
    // Warm E - A - C#m - B acoustic serenade
    bpm: 88,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'acoustic',
    chords: [
      [40, 52, 56, 59, 64], // E
      [45, 57, 61, 64, 69], // A
      [49, 56, 61, 64, 68], // C#m
      [47, 54, 59, 63, 66], // B
    ],
    melody: [
      { step: 0, midi: 76, lenSteps: 2 },
      { step: 2, midi: 75, lenSteps: 2 },
      { step: 4, midi: 73, lenSteps: 2 },
      { step: 6, midi: 71, lenSteps: 2 },
      { step: 8, midi: 73, lenSteps: 4 },
      { step: 12, midi: 69, lenSteps: 4 },
      { step: 16, midi: 71, lenSteps: 2 },
      { step: 18, midi: 73, lenSteps: 2 },
      { step: 20, midi: 76, lenSteps: 2 },
      { step: 22, midi: 75, lenSteps: 2 },
      { step: 24, midi: 71, lenSteps: 6 },
      { step: 30, midi: 68, lenSteps: 2 },
    ],
  },
  'opm-kathang-isip': {
    // Gentle C - G/B - Am - Fmaj7 folk-pop
    bpm: 96,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'acoustic',
    chords: [
      [48, 55, 60, 64, 67], // C
      [47, 55, 59, 62, 67], // G/B
      [45, 52, 57, 60, 64], // Am
      [41, 53, 57, 60, 64], // Fmaj7
    ],
    melody: [
      { step: 0, midi: 72, lenSteps: 2 },
      { step: 2, midi: 74, lenSteps: 2 },
      { step: 4, midi: 76, lenSteps: 3 },
      { step: 7, midi: 74, lenSteps: 1 },
      { step: 8, midi: 74, lenSteps: 3 },
      { step: 11, midi: 72, lenSteps: 1 },
      { step: 12, midi: 71, lenSteps: 4 },
      { step: 16, midi: 72, lenSteps: 2 },
      { step: 18, midi: 76, lenSteps: 2 },
      { step: 20, midi: 79, lenSteps: 3 },
      { step: 23, midi: 76, lenSteps: 1 },
      { step: 24, midi: 76, lenSteps: 4 },
      { step: 28, midi: 72, lenSteps: 4 },
    ],
  },
  'opm-rainbow': {
    // Classic R&B Cmaj7 - Em7 - Dm7 - G9sus4
    bpm: 86,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'rhodes',
    chords: [
      [48, 55, 59, 64, 67], // Cmaj7
      [40, 55, 59, 62, 67], // Em7
      [50, 57, 60, 64, 69], // Dm9
      [43, 55, 58, 62, 65], // G9sus
    ],
    melody: [
      { step: 1, midi: 76, lenSteps: 2 },
      { step: 3, midi: 79, lenSteps: 3 },
      { step: 6, midi: 76, lenSteps: 2 },
      { step: 8, midi: 74, lenSteps: 3 },
      { step: 11, midi: 72, lenSteps: 1 },
      { step: 12, midi: 74, lenSteps: 4 },
      { step: 17, midi: 72, lenSteps: 2 },
      { step: 19, midi: 74, lenSteps: 2 },
      { step: 21, midi: 76, lenSteps: 3 },
      { step: 24, midi: 74, lenSteps: 4 },
      { step: 28, midi: 71, lenSteps: 4 },
    ],
  },
  'opm-with-a-smile': {
    // Bright D - Em7 - G - A sunny strum
    bpm: 100,
    beatsPerBar: 4,
    bars: 16,
    instrument: 'acoustic',
    chords: [
      [50, 57, 62, 66, 69], // D
      [40, 55, 59, 62, 67], // Em7
      [43, 55, 59, 62, 67], // G
      [45, 57, 61, 64, 69], // A
    ],
    melody: [
      { step: 0, midi: 78, lenSteps: 2 },
      { step: 2, midi: 76, lenSteps: 2 },
      { step: 4, midi: 74, lenSteps: 4 },
      { step: 8, midi: 74, lenSteps: 2 },
      { step: 10, midi: 76, lenSteps: 2 },
      { step: 12, midi: 74, lenSteps: 4 },
      { step: 16, midi: 71, lenSteps: 2 },
      { step: 18, midi: 74, lenSteps: 2 },
      { step: 20, midi: 78, lenSteps: 2 },
      { step: 22, midi: 76, lenSteps: 2 },
      { step: 24, midi: 74, lenSteps: 4 },
      { step: 28, midi: 73, lenSteps: 4 },
    ],
  },
};

function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function writeAscii(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

function encodeStereoWav(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const numFrames = left.length;
  const bytesPerSample = 2;
  const numChannels = 2;
  const dataSize = numFrames * numChannels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, 'WAVE');
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * bytesPerSample, true);
  view.setUint16(32, numChannels * bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  let pos = 44;
  for (let i = 0; i < numFrames; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(pos, l < 0 ? l * 0x8000 : l * 0x7fff, true);
    view.setInt16(pos + 2, r < 0 ? r * 0x8000 : r * 0x7fff, true);
    pos += 4;
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

function addPluckedGuitarNote(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSec: number,
  durSec: number,
  freq: number,
  gain: number,
  pan: number // -1 to 1
) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + durSec) * sampleRate));
  const lGain = gain * Math.sqrt(0.5 * (1 - pan));
  const rGain = gain * Math.sqrt(0.5 * (1 + pan));

  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const attack = Math.min(1, t / 0.012);
    const decay = Math.exp(-t * 2.5);
    const body =
      Math.sin(2 * Math.PI * freq * t) * 0.65 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.25 * Math.exp(-t * 3.8) +
      Math.sin(2 * Math.PI * freq * 3 * t) * 0.1 * Math.exp(-t * 6.5);
    const sample = body * attack * decay;
    left[i] += sample * lGain;
    right[i] += sample * rGain;
  }
}

function addWarmRhodesNote(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSec: number,
  durSec: number,
  freq: number,
  gain: number,
  pan: number
) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + durSec) * sampleRate));
  const lGain = gain * Math.sqrt(0.5 * (1 - pan));
  const rGain = gain * Math.sqrt(0.5 * (1 + pan));

  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const attack = Math.min(1, t / 0.018);
    const releaseStart = Math.max(0, durSec - 0.18);
    const release = t > releaseStart ? Math.max(0, 1 - (t - releaseStart) / 0.18) : 1;
    const decay = Math.exp(-t * 1.45);
    const tremolo = 0.88 + 0.12 * Math.sin(2 * Math.PI * 4.2 * t);
    const bell = Math.sin(2 * Math.PI * freq * 4 * t) * 0.14 * Math.exp(-t * 9);
    const tone =
      Math.sin(2 * Math.PI * freq * t) * 0.78 +
      Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 * Math.exp(-t * 2.4) +
      bell;
    const sample = tone * attack * decay * release * tremolo;
    left[i] += sample * lGain;
    right[i] += sample * rGain;
  }
}

function addSoftBassNote(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSec: number,
  durSec: number,
  freq: number,
  gain: number
) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + durSec) * sampleRate));
  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const attack = Math.min(1, t / 0.02);
    const decay = Math.exp(-t * 1.2);
    const val =
      (Math.sin(2 * Math.PI * freq * t) * 0.8 +
        Math.sin(2 * Math.PI * freq * 2 * t) * 0.2 * Math.exp(-t * 3)) *
      attack *
      decay *
      gain;
    left[i] += val;
    right[i] += val;
  }
}

function addSoftKick(left: Float32Array, right: Float32Array, sampleRate: number, startSec: number, gain: number) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + 0.22) * sampleRate));
  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const freq = 48 + 82 * Math.exp(-t * 28);
    const env = Math.exp(-t * 14);
    const val = Math.sin(2 * Math.PI * freq * t) * env * gain;
    left[i] += val;
    right[i] += val;
  }
}

function addSoftBrushRim(left: Float32Array, right: Float32Array, sampleRate: number, startSec: number, gain: number) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + 0.09) * sampleRate));
  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const env = Math.exp(-t * 42);
    // Deterministic pseudo-noise for soft shaker/brush feel
    const noise = Math.sin(i * 12.9898) * 43758.5453;
    const frac = (noise - Math.floor(noise)) * 2 - 1;
    const val = frac * env * gain;
    left[i] += val * 0.9;
    right[i] += val * 1.1;
  }
}

function addMelodyVoice(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  startSec: number,
  durSec: number,
  freq: number,
  gain: number
) {
  const startIdx = Math.max(0, Math.floor(startSec * sampleRate));
  const endIdx = Math.min(left.length, Math.floor((startSec + durSec) * sampleRate));
  for (let i = startIdx; i < endIdx; i++) {
    const t = (i - startIdx) / sampleRate;
    const attack = Math.min(1, t / 0.035);
    const releaseStart = Math.max(0, durSec - 0.14);
    const release = t > releaseStart ? Math.max(0, 1 - (t - releaseStart) / 0.14) : 1;
    const vibrato = t > 0.18 ? Math.sin(2 * Math.PI * 5.2 * t) * 0.004 : 0;
    const f = freq * (1 + vibrato);
    const tone =
      Math.sin(2 * Math.PI * f * t) * 0.72 +
      Math.sin(2 * Math.PI * f * 2 * t) * 0.22 +
      Math.sin(2 * Math.PI * f * 3 * t) * 0.06;
    const val = tone * attack * release * gain;
    left[i] += val * 0.98;
    right[i] += val * 1.02;
  }
}

const renderedAudioUrlCache = new Map<string, string>();

export function getOrRenderOpmTrackAudioUrl(track: OpmSongTrack): string {
  if (track.audioUrl) return track.audioUrl;
  const cached = renderedAudioUrlCache.get(track.id);
  if (cached) return cached;

  const arr = ARRANGEMENTS[track.id] || ARRANGEMENTS['opm-huling-el-bimbo'];
  const sampleRate = 22050;
  const beatSec = 60 / arr.bpm;
  const eighthSec = beatSec / 2;
  const barSec = beatSec * arr.beatsPerBar;
  const totalSec = Math.max(24, arr.bars * barSec + 1.2);
  const totalFrames = Math.floor(totalSec * sampleRate);

  const left = new Float32Array(totalFrames);
  const right = new Float32Array(totalFrames);

  for (let bar = 0; bar < arr.bars; bar++) {
    const barStart = bar * barSec;
    const chord = arr.chords[bar % arr.chords.length];
    const rootMidi = chord[0];

    // Warm root bass pulse
    addSoftBassNote(left, right, sampleRate, barStart, barSec * 0.92, midiToHz(rootMidi), 0.24);
    if (arr.beatsPerBar === 4) {
      addSoftBassNote(
        left,
        right,
        sampleRate,
        barStart + beatSec * 2.5,
        beatSec * 1.3,
        midiToHz(rootMidi + 7),
        0.14
      );
    }

    // Chord arpeggio / strum voicing
    const stepsPerBar = arr.beatsPerBar * 2;
    for (let s = 0; s < stepsPerBar; s++) {
      const noteStart = barStart + s * eighthSec;
      const chordNote = chord[1 + (s % (chord.length - 1))];
      const pan = s % 2 === 0 ? -0.35 : 0.35;

      if (arr.instrument === 'rhodes' || arr.instrument === 'piano') {
        if (s === 0 || s === 3 || s === 6) {
          for (let k = 1; k < chord.length; k++) {
            addWarmRhodesNote(
              left,
              right,
              sampleRate,
              noteStart + k * 0.015,
              eighthSec * 2.6,
              midiToHz(chord[k]),
              0.085,
              (k - 2) * 0.22
            );
          }
        }
      } else {
        addPluckedGuitarNote(
          left,
          right,
          sampleRate,
          noteStart,
          eighthSec * 2.4,
          midiToHz(chordNote),
          s === 0 ? 0.13 : 0.095,
          pan
        );
      }
    }

    // Soft rhythmic pulse
    addSoftKick(left, right, sampleRate, barStart, 0.16);
    if (arr.beatsPerBar === 4) {
      addSoftBrushRim(left, right, sampleRate, barStart + beatSec, 0.045);
      addSoftKick(left, right, sampleRate, barStart + beatSec * 2, 0.11);
      addSoftBrushRim(left, right, sampleRate, barStart + beatSec * 3, 0.05);
    } else {
      addSoftBrushRim(left, right, sampleRate, barStart + beatSec * 1.5, 0.04);
      addSoftBrushRim(left, right, sampleRate, barStart + beatSec * 2.5, 0.032);
    }
  }

  // Expressive OPM vocal-style melody phrasing looping every 4 bars
  const phraseBars = 4;
  const stepsPerPhrase = arr.beatsPerBar * 2 * phraseBars;
  for (let phraseStartBar = 0; phraseStartBar < arr.bars; phraseStartBar += phraseBars) {
    // Give 1 bar intro on the very first phrase for natural breathing room
    for (const m of arr.melody) {
      if (m.step >= stepsPerPhrase) continue;
      if (phraseStartBar === 0 && m.step < 2) continue;
      const startSec = (phraseStartBar * arr.beatsPerBar * 2 + m.step) * eighthSec;
      const durSec = Math.max(0.18, m.lenSteps * eighthSec * 0.92);
      addMelodyVoice(left, right, sampleRate, startSec, durSec, midiToHz(m.midi), 0.16);
    }
  }

  // Subtle stereo room delay + gentle soft-clip + clean fade-out
  const delaySamples = Math.floor(0.24 * sampleRate);
  const fadeOutSamples = Math.floor(1.4 * sampleRate);
  const fadeStart = Math.max(0, totalFrames - fadeOutSamples);

  for (let i = 0; i < totalFrames; i++) {
    if (i >= delaySamples) {
      left[i] += right[i - delaySamples] * 0.18;
      right[i] += left[i - delaySamples] * 0.18;
    }
    const fade = i >= fadeStart ? Math.max(0, 1 - (i - fadeStart) / fadeOutSamples) : 1;
    left[i] = Math.tanh(left[i] * 0.9) * fade;
    right[i] = Math.tanh(right[i] * 0.9) * fade;
  }

  const blob = encodeStereoWav(left, right, sampleRate);
  const url = URL.createObjectURL(blob);
  renderedAudioUrlCache.set(track.id, url);
  return url;
}
