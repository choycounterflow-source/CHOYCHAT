// Welcome greeting voice player ("WELCOME TO CHOY CHAT")
// Tries cached server-generated Gemini TTS WAV first, then cleanly falls back to Web Speech API + gentle chime.

let cachedClientAudioUrl: string | null = null;

function playGentleWelcomeChime(): void {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99]; // C5 - E5 - G5 bright welcoming triad
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      gain.gain.setValueAtTime(0.001, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.11, now + idx * 0.08 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.38);
    });
    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 900);
  } catch {
    // Ignore audio context restrictions
  }
}

function speakWithBrowserTts(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance('Welcome to Choy Chat!');
    utterance.lang = 'en-US';
    utterance.rate = 0.98;
    utterance.pitch = 1.08;
    utterance.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /en/i.test(v.lang) && /female|samantha|google us english|natural|aria|zira/i.test(v.name)) ||
      voices.find((v) => /en/i.test(v.lang));
    if (preferred) utterance.voice = preferred;
    window.speechSynthesis.speak(utterance);
  } catch {
    // Ignore browser TTS errors
  }
}

export async function playWelcomeToChoyChatVoice(authToken?: string | null): Promise<void> {
  if (typeof window === 'undefined') return;
  if (localStorage.getItem('choychat_welcome_voice_muted') === 'true') return;

  playGentleWelcomeChime();

  try {
    if (cachedClientAudioUrl) {
      const audio = new Audio(cachedClientAudioUrl);
      audio.volume = 1;
      await audio.play();
      return;
    }

    const headers: Record<string, string> = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }
    const res = await fetch('/api/tts/welcome', {
      method: 'GET',
      credentials: 'include',
      headers,
    });
    if (res.ok && (res.headers.get('content-type') || '').includes('audio')) {
      const blob = await res.blob();
      if (blob.size > 200) {
        cachedClientAudioUrl = URL.createObjectURL(blob);
        const audio = new Audio(cachedClientAudioUrl);
        audio.volume = 1;
        await audio.play();
        return;
      }
    }
  } catch {
    // Fall back to browser speech synthesis below
  }

  speakWithBrowserTts();
}
