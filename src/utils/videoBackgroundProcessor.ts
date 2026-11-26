export type VideoBackgroundPresetId =
  | 'none'
  | 'soft-blur'
  | 'strong-blur'
  | 'emerald'
  | 'office'
  | 'sunset'
  | 'midnight'
  | 'custom';

export interface VideoBackgroundConfig {
  preset: VideoBackgroundPresetId;
  customImageUrl?: string | null;
}

export interface VideoBackgroundProcessorHandle {
  outputStream: MediaStream;
  outputTrack: MediaStreamTrack;
  updateConfig: (config: VideoBackgroundConfig) => Promise<void>;
  updateInputTrack: (nextInputTrack: MediaStreamTrack) => Promise<void>;
  dispose: () => void;
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number
) {
  if (!srcW || !srcH || !dstW || !dstH) return;
  const scale = Math.max(dstW / srcW, dstH / srcH);
  const drawW = srcW * scale;
  const drawH = srcH * scale;
  const dx = (dstW - drawW) / 2;
  const dy = (dstH - drawH) / 2;
  ctx.drawImage(source, dx, dy, drawW, drawH);
}

function renderPresetBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  preset: VideoBackgroundPresetId,
  customImage: HTMLImageElement | null
) {
  ctx.save();
  if (preset === 'custom' && customImage && customImage.complete && customImage.naturalWidth > 0) {
    drawCoverImage(ctx, customImage, customImage.naturalWidth, customImage.naturalHeight, width, height);
    ctx.restore();
    return;
  }

  if (preset === 'office') {
    const wallGrad = ctx.createLinearGradient(0, 0, width, height);
    wallGrad.addColorStop(0, '#f1f5f9');
    wallGrad.addColorStop(0.55, '#e2e8f0');
    wallGrad.addColorStop(1, '#cbd5e1');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(0, 0, width, height);

    // Warm sunlit window glow on the left
    const windowGlow = ctx.createRadialGradient(width * 0.14, height * 0.24, 10, width * 0.14, height * 0.24, width * 0.55);
    windowGlow.addColorStop(0, 'rgba(255, 251, 235, 0.92)');
    windowGlow.addColorStop(0.5, 'rgba(254, 243, 199, 0.35)');
    windowGlow.addColorStop(1, 'rgba(226, 232, 240, 0)');
    ctx.fillStyle = windowGlow;
    ctx.fillRect(0, 0, width, height);

    // Minimalist architectural wall panels
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
    ctx.lineWidth = 2;
    ctx.strokeRect(width * 0.62, height * 0.12, width * 0.28, height * 0.44);
    ctx.fillStyle = 'rgba(51, 65, 85, 0.12)';
    ctx.fillRect(width * 0.64, height * 0.14, width * 0.24, height * 0.4);

    // Warm wood credenza band at bottom
    const woodGrad = ctx.createLinearGradient(0, height * 0.78, 0, height);
    woodGrad.addColorStop(0, '#92400e');
    woodGrad.addColorStop(1, '#451a03');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(0, height * 0.8, width, height * 0.2);
  } else if (preset === 'sunset') {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
    skyGrad.addColorStop(0, '#1e1b4b');
    skyGrad.addColorStop(0.38, '#9d174d');
    skyGrad.addColorStop(0.72, '#ea580c');
    skyGrad.addColorStop(1, '#fbbf24');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, width, height);

    const sunGlow = ctx.createRadialGradient(width * 0.75, height * 0.62, 8, width * 0.75, height * 0.62, width * 0.42);
    sunGlow.addColorStop(0, 'rgba(254, 240, 138, 0.92)');
    sunGlow.addColorStop(0.35, 'rgba(251, 146, 60, 0.45)');
    sunGlow.addColorStop(1, 'rgba(251, 146, 60, 0)');
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.82);
    ctx.quadraticCurveTo(width * 0.35, height * 0.74, width, height * 0.84);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
  } else if (preset === 'midnight') {
    const studioGrad = ctx.createLinearGradient(0, 0, width, height);
    studioGrad.addColorStop(0, '#020617');
    studioGrad.addColorStop(0.5, '#0f172a');
    studioGrad.addColorStop(1, '#1e1b4b');
    ctx.fillStyle = studioGrad;
    ctx.fillRect(0, 0, width, height);

    const rimCyan = ctx.createRadialGradient(width * 0.2, height * 0.25, 10, width * 0.2, height * 0.25, width * 0.52);
    rimCyan.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    rimCyan.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = rimCyan;
    ctx.fillRect(0, 0, width, height);

    const rimIndigo = ctx.createRadialGradient(width * 0.85, height * 0.75, 10, width * 0.85, height * 0.75, width * 0.48);
    rimIndigo.addColorStop(0, 'rgba(129, 140, 248, 0.26)');
    rimIndigo.addColorStop(1, 'rgba(129, 140, 248, 0)');
    ctx.fillStyle = rimIndigo;
    ctx.fillRect(0, 0, width, height);
  } else {
    // Emerald studio default backdrop
    const emGrad = ctx.createLinearGradient(0, 0, width, height);
    emGrad.addColorStop(0, '#022c22');
    emGrad.addColorStop(0.55, '#064e3b');
    emGrad.addColorStop(1, '#065f46');
    ctx.fillStyle = emGrad;
    ctx.fillRect(0, 0, width, height);

    const bokehOne = ctx.createRadialGradient(width * 0.2, height * 0.28, 6, width * 0.2, height * 0.28, width * 0.42);
    bokehOne.addColorStop(0, 'rgba(52, 211, 153, 0.34)');
    bokehOne.addColorStop(1, 'rgba(16, 185, 129, 0)');
    ctx.fillStyle = bokehOne;
    ctx.fillRect(0, 0, width, height);

    const bokehGold = ctx.createRadialGradient(width * 0.84, height * 0.22, 6, width * 0.84, height * 0.22, width * 0.36);
    bokehGold.addColorStop(0, 'rgba(251, 191, 36, 0.22)');
    bokehGold.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = bokehGold;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
}

function buildPortraitMaskCanvas(width: number, height: number): HTMLCanvasElement {
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = width;
  maskCanvas.height = height;
  const mctx = maskCanvas.getContext('2d');
  if (!mctx) return maskCanvas;

  mctx.clearRect(0, 0, width, height);

  // Softly feathered head & upper-body portrait silhouette
  // Head zone
  const headX = width * 0.5;
  const headY = height * 0.38;
  const headR = Math.min(width, height) * 0.34;
  mctx.save();
  mctx.translate(headX, headY);
  mctx.scale(0.86, 1.08);
  const headGrad = mctx.createRadialGradient(0, 0, headR * 0.55, 0, 0, headR * 1.15);
  headGrad.addColorStop(0, 'rgba(255,255,255,1)');
  headGrad.addColorStop(0.7, 'rgba(255,255,255,0.92)');
  headGrad.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = headGrad;
  mctx.beginPath();
  mctx.arc(0, 0, headR * 1.15, 0, Math.PI * 2);
  mctx.fill();
  mctx.restore();

  // Shoulders & torso zone
  const bodyX = width * 0.5;
  const bodyY = height * 0.88;
  const bodyR = width * 0.44;
  mctx.save();
  mctx.translate(bodyX, bodyY);
  mctx.scale(1.0, 0.72);
  const bodyGrad = mctx.createRadialGradient(0, 0, bodyR * 0.48, 0, 0, bodyR);
  bodyGrad.addColorStop(0, 'rgba(255,255,255,1)');
  bodyGrad.addColorStop(0.68, 'rgba(255,255,255,0.92)');
  bodyGrad.addColorStop(1, 'rgba(255,255,255,0)');
  mctx.fillStyle = bodyGrad;
  mctx.beginPath();
  mctx.arc(0, 0, bodyR, 0, Math.PI * 2);
  mctx.fill();
  mctx.restore();

  return maskCanvas;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load background image'));
    img.src = url;
  });
}

export async function createVideoBackgroundProcessor(
  initialTrack: MediaStreamTrack,
  initialConfig: VideoBackgroundConfig
): Promise<VideoBackgroundProcessorHandle> {
  let activeTrack = initialTrack;
  let currentConfig: VideoBackgroundConfig = { ...initialConfig };
  let disposed = false;

  const settings = initialTrack.getSettings?.() || {};
  const initW = Math.min(640, Math.max(320, Number(settings.width) || 640));
  const initH = Math.min(480, Math.max(240, Number(settings.height) || 480));

  const outCanvas = document.createElement('canvas');
  outCanvas.width = initW;
  outCanvas.height = initH;
  const outCtx = outCanvas.getContext('2d');

  const fgCanvas = document.createElement('canvas');
  fgCanvas.width = initW;
  fgCanvas.height = initH;
  const fgCtx = fgCanvas.getContext('2d');

  const tinyBlurCanvas = document.createElement('canvas');
  tinyBlurCanvas.width = Math.max(32, Math.round(initW / 10));
  tinyBlurCanvas.height = Math.max(24, Math.round(initH / 10));
  const tinyBlurCtx = tinyBlurCanvas.getContext('2d');

  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = initW;
  bgCanvas.height = initH;
  const bgCtx = bgCanvas.getContext('2d');

  let maskCanvas = buildPortraitMaskCanvas(initW, initH);
  let customImg: HTMLImageElement | null = null;

  const syncBackdropCache = async () => {
    if (currentConfig.preset === 'custom' && currentConfig.customImageUrl) {
      try {
        customImg = await loadImage(currentConfig.customImageUrl);
      } catch {
        customImg = null;
      }
    } else {
      customImg = null;
    }
    if (bgCtx) {
      renderPresetBackdrop(bgCtx, bgCanvas.width, bgCanvas.height, currentConfig.preset, customImg);
    }
  };

  await syncBackdropCache();

  const ensureCanvasSize = (w: number, h: number) => {
    const targetW = Math.min(640, Math.max(320, w));
    const targetH = Math.min(480, Math.max(240, h));
    if (outCanvas.width === targetW && outCanvas.height === targetH) return;
    outCanvas.width = targetW;
    outCanvas.height = targetH;
    fgCanvas.width = targetW;
    fgCanvas.height = targetH;
    bgCanvas.width = targetW;
    bgCanvas.height = targetH;
    tinyBlurCanvas.width = Math.max(28, Math.round(targetW / 10));
    tinyBlurCanvas.height = Math.max(20, Math.round(targetH / 10));
    maskCanvas = buildPortraitMaskCanvas(targetW, targetH);
    if (bgCtx) {
      renderPresetBackdrop(bgCtx, targetW, targetH, currentConfig.preset, customImg);
    }
  };

  const compositeFrame = (source: CanvasImageSource, srcW: number, srcH: number) => {
    if (disposed || !outCtx || !fgCtx) return;
    ensureCanvasSize(srcW || initW, srcH || initH);
    const w = outCanvas.width;
    const h = outCanvas.height;

    if (currentConfig.preset === 'none') {
      drawCoverImage(outCtx, source, srcW, srcH, w, h);
      return;
    }

    // 1. Background layer (real CSS filter blur or fallback pixel blur or preset scene)
    if (currentConfig.preset === 'soft-blur' || currentConfig.preset === 'strong-blur') {
      const blurPx = currentConfig.preset === 'strong-blur' ? 20 : 10;
      const overscan = 1.08;
      const bw = w * overscan;
      const bh = h * overscan;
      const bx = (w - bw) / 2;
      const by = (h - bh) / 2;

      const supportsFilter = typeof (outCtx as { filter?: unknown }).filter === 'string';
      if (supportsFilter) {
        outCtx.save();
        outCtx.filter = `blur(${blurPx}px)`;
        outCtx.drawImage(source, 0, 0, srcW, srcH, bx, by, bw, bh);
        outCtx.restore();
      } else if (tinyBlurCtx) {
        tinyBlurCtx.drawImage(source, 0, 0, tinyBlurCanvas.width, tinyBlurCanvas.height);
        outCtx.save();
        outCtx.imageSmoothingEnabled = true;
        outCtx.drawImage(tinyBlurCanvas, 0, 0, w, h);
        outCtx.restore();
      } else {
        drawCoverImage(outCtx, source, srcW, srcH, w, h);
      }
      if (currentConfig.preset === 'strong-blur') {
        outCtx.fillStyle = 'rgba(2, 6, 23, 0.14)';
        outCtx.fillRect(0, 0, w, h);
      }
    } else {
      outCtx.drawImage(bgCanvas, 0, 0, w, h);
    }

    // 2. Crisp portrait foreground layer masked smoothly over background
    fgCtx.clearRect(0, 0, w, h);
    drawCoverImage(fgCtx, source, srcW, srcH, w, h);
    fgCtx.save();
    fgCtx.globalCompositeOperation = 'destination-in';
    fgCtx.drawImage(maskCanvas, 0, 0, w, h);
    fgCtx.restore();

    outCtx.drawImage(fgCanvas, 0, 0, w, h);
  };

  // Pipeline control (prefers WebRTC MediaStreamTrackProcessor, falls back to hidden <video> loop)
  let loopStopper: (() => void) | null = null;

  const startPipelineForTrack = (track: MediaStreamTrack) => {
    if (loopStopper) {
      loopStopper();
      loopStopper = null;
    }

    type TrackProcessorType = new (init: { track: MediaStreamTrack }) => {
      readable: ReadableStream<VideoFrame>;
    };
    const TrackProcessorCtor = (
      window as unknown as { MediaStreamTrackProcessor?: TrackProcessorType }
    ).MediaStreamTrackProcessor;

    if (typeof TrackProcessorCtor === 'function') {
      let reader: ReadableStreamDefaultReader<VideoFrame> | null = null;
      let cancelled = false;
      try {
        const processor = new TrackProcessorCtor({ track });
        reader = processor.readable.getReader();
        let lastDrawMs = 0;

        const pump = async () => {
          while (!cancelled && !disposed && reader) {
            const result = await reader.read();
            if (result.done || !result.value) break;
            const frame = result.value;
            try {
              const now = performance.now();
              if (now - lastDrawMs >= 36) {
                lastDrawMs = now;
                compositeFrame(
                  frame,
                  frame.displayWidth || initW,
                  frame.displayHeight || initH
                );
              }
            } finally {
              frame.close();
            }
          }
        };
        void pump().catch(() => {});

        loopStopper = () => {
          cancelled = true;
          if (reader) {
            void reader.cancel().catch(() => {});
            reader = null;
          }
        };
        return;
      } catch {
        if (reader) {
          void reader.cancel().catch(() => {});
        }
      }
    }

    // Fallback for browsers without MediaStreamTrackProcessor (Safari / Firefox)
    const videoEl = document.createElement('video');
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.autoplay = true;
    videoEl.srcObject = new MediaStream([track]);
    void videoEl.play().catch(() => {});

    let stopped = false;
    const timer = window.setInterval(() => {
      if (stopped || disposed) return;
      if (videoEl.readyState >= 2 && videoEl.videoWidth > 0 && videoEl.videoHeight > 0) {
        compositeFrame(videoEl, videoEl.videoWidth, videoEl.videoHeight);
      }
    }, 42);

    loopStopper = () => {
      stopped = true;
      window.clearInterval(timer);
      videoEl.pause();
      videoEl.srcObject = null;
    };
  };

  // Paint initial frame / backdrop immediately so captureStream emits right away
  if (bgCtx && outCtx) {
    outCtx.drawImage(bgCanvas, 0, 0, outCanvas.width, outCanvas.height);
  }
  startPipelineForTrack(activeTrack);

  const outputStream = outCanvas.captureStream(24);
  const outputTrack = outputStream.getVideoTracks()[0];

  return {
    outputStream,
    outputTrack,
    updateConfig: async (nextConfig: VideoBackgroundConfig) => {
      currentConfig = { ...nextConfig };
      await syncBackdropCache();
    },
    updateInputTrack: async (nextInputTrack: MediaStreamTrack) => {
      activeTrack = nextInputTrack;
      startPipelineForTrack(nextInputTrack);
    },
    dispose: () => {
      disposed = true;
      if (loopStopper) {
        loopStopper();
        loopStopper = null;
      }
      outputStream.getTracks().forEach((t) => t.stop());
    },
  };
}
