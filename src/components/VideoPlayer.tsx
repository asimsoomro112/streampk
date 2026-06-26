import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import {
  AlertCircle,
  Check,
  ChevronUp,
  Loader2,
  Maximize2,
  Minimize2,
  PictureInPicture2,
  Pause,
  Play,
  RefreshCw,
  Settings2,
  SkipForward,
  Volume1,
  Volume2,
  VolumeX,
} from 'lucide-react';

function isLocalProxyUrl(source: string) {
  try {
    const parsed = new URL(source, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith('/api/');
  } catch {
    return source.startsWith('/api/');
  }
}

function toProxyUrl(source: string) {
  if (isLocalProxyUrl(source) || source.includes('corsproxy.io')) {
    return source;
  }

  try {
    const absoluteUrl = new URL(source, window.location.href);
    return `/api/proxy?url=${encodeURIComponent(absoluteUrl.toString())}`;
  } catch {
    return `/api/proxy?url=${encodeURIComponent(source)}`;
  }
}

function isHlsUrl(source: string) {
  return /\.m3u8?($|[?#])/i.test(source);
}

const STREAM_START_TIMEOUT_MS = 22000;
const CONTROLS_HIDE_DELAY_MS = 3500;
const KEYBOARD_HINT_DISPLAY_MS = 4000;

type QualityOption = {
  label: string;
  value: number;
};

function formatLevelLabel(level: Hls['levels'][number], fallbackIndex: number) {
  if (level.height) {
    return `${level.height}p`;
  }

  if (level.bitrate) {
    return `${Math.round(level.bitrate / 1000)}kbps`;
  }

  return `Level ${fallbackIndex + 1}`;
}

function buildQualityOptions(levels: Hls['levels']): QualityOption[] {
  const optionsByLabel = new Map<string, QualityOption & { bitrate: number }>();

  levels.forEach((level, index) => {
    const label = formatLevelLabel(level, index);
    const current = optionsByLabel.get(label);

    if (!current || (level.bitrate || 0) > current.bitrate) {
      optionsByLabel.set(label, {
        label,
        value: index,
        bitrate: level.bitrate || 0,
      });
    }
  });

  return Array.from(optionsByLabel.values())
    .sort((a, b) => {
      const aHeight = Number.parseInt(a.label, 10) || 0;
      const bHeight = Number.parseInt(b.label, 10) || 0;
      if (aHeight !== bHeight) return bHeight - aHeight;
      return b.bitrate - a.bitrate;
    })
    .map(({ label, value }) => ({ label, value }));
}

export default function VideoPlayer({
  url,
  autoPlay = true,
  onRetry,
  onSkip,
}: {
  url: string;
  autoPlay?: boolean;
  onRetry?: () => void;
  onSkip?: () => void;
  key?: React.Key;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsHideTimeoutRef = useRef<number | undefined>(undefined);
  const keyboardHintTimeoutRef = useRef<number | undefined>(undefined);

  // ---- Streaming / lifecycle state (unchanged contract from original) ----
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [pipSupported, setPipSupported] = useState(false);
  const [areControlsVisible, setAreControlsVisible] = useState(true);
  const [hasControlFocus, setHasControlFocus] = useState(false);
  const [qualityOptions, setQualityOptions] = useState<QualityOption[]>([]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [currentAutoQuality, setCurrentAutoQuality] = useState('');
  const [isQualityMenuOpen, setIsQualityMenuOpen] = useState(false);
  const [isVolumeSliderOpen, setIsVolumeSliderOpen] = useState(false);
  const [showKeyboardHint, setShowKeyboardHint] = useState(false);

  const selectedQualityLabel =
    selectedQuality === -1
      ? currentAutoQuality
        ? `Auto · ${currentAutoQuality}`
        : 'Auto'
      : qualityOptions.find(option => option.value === selectedQuality)?.label || 'Quality';
  const shouldShowControls =
    areControlsVisible || isQualityMenuOpen || isVolumeSliderOpen || !isPlaying || isLoading || hasControlFocus;

  const clearControlsHideTimer = () => {
    if (controlsHideTimeoutRef.current) {
      window.clearTimeout(controlsHideTimeoutRef.current);
      controlsHideTimeoutRef.current = undefined;
    }
  };

  const scheduleControlsHide = () => {
    clearControlsHideTimer();

    if (!isPlaying || isLoading || isQualityMenuOpen || isVolumeSliderOpen || hasControlFocus) {
      return;
    }

    controlsHideTimeoutRef.current = window.setTimeout(() => {
      setAreControlsVisible(false);
    }, CONTROLS_HIDE_DELAY_MS);
  };

  const revealControls = () => {
    setAreControlsVisible(true);
    scheduleControlsHide();
  };

  const handleQualityChange = (value: number) => {
    const hls = hlsRef.current;
    if (!hls) return;

    revealControls();
    hls.currentLevel = value;
    setSelectedQuality(value);
    setIsQualityMenuOpen(false);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    revealControls();
    if (video.paused) {
      video.play().catch(e => console.warn('Play failed:', e));
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    revealControls();
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (next: number) => {
    const video = videoRef.current;
    if (!video) return;

    revealControls();
    const clamped = Math.min(1, Math.max(0, next));
    video.volume = clamped;
    video.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      revealControls();
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await container.requestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen failed:', e);
    }
  };

  const togglePictureInPicture = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      revealControls();
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await video.requestPictureInPicture();
      }
    } catch (e) {
      console.warn('Picture-in-picture failed:', e);
    }
  };

  const handleRemoteKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    revealControls();

    const target = event.target as HTMLElement;
    if (target.closest('button') || target.closest('input')) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      togglePlay();
    }

    if (event.key.toLowerCase() === 'f') {
      event.preventDefault();
      toggleFullscreen();
    }

    if (event.key.toLowerCase() === 'm') {
      event.preventDefault();
      toggleMute();
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      handleVolumeChange(volume + 0.1);
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      handleVolumeChange(volume - 0.1);
    }
  };

  // ---- One-time keyboard-shortcut hint on mount (discoverability, not nagging) ----
  useEffect(() => {
    setShowKeyboardHint(true);
    keyboardHintTimeoutRef.current = window.setTimeout(() => {
      setShowKeyboardHint(false);
    }, KEYBOARD_HINT_DISPLAY_MS);

    return () => {
      if (keyboardHintTimeoutRef.current) {
        window.clearTimeout(keyboardHintTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    container?.focus({ preventScroll: true });

    setPipSupported(typeof document !== 'undefined' && 'pictureInPictureEnabled' in document);

    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    const handlePipChange = () => {
      setIsPipActive(document.pictureInPictureElement === videoRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('enterpictureinpicture', handlePipChange);
    document.addEventListener('leavepictureinpicture', handlePipChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('enterpictureinpicture', handlePipChange);
      document.removeEventListener('leavepictureinpicture', handlePipChange);
    };
  }, []);

  useEffect(() => {
    scheduleControlsHide();
    return clearControlsHideTimer;
  }, [isPlaying, isLoading, isQualityMenuOpen, isVolumeSliderOpen, hasControlFocus]);

  // ---------------------------------------------------------------------
  // Streaming pipeline — unchanged from the original implementation.
  // HLS.js wiring, proxy loader, direct-fallback, retry/recovery tiers,
  // and the 22s start timeout are all preserved exactly as they were.
  // ---------------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    hlsRef.current = null;
    setError(false);
    setErrorMessage('');
    setIsLoading(true);
    setIsBuffering(false);
    setIsPlaying(false);
    setAreControlsVisible(true);
    setHasControlFocus(false);
    setQualityOptions([]);
    setSelectedQuality(-1);
    setCurrentAutoQuality('');
    setIsQualityMenuOpen(false);
    let hls: Hls | null = null;
    let retryCount = 0;
    let mediaRecoverCount = 0;
    let triedProxyFallback = false;
    let shouldProxyHlsRequests = false;
    let loadTimeoutId: number | undefined;

    const clearLoadTimeout = () => {
      if (loadTimeoutId) {
        window.clearTimeout(loadTimeoutId);
        loadTimeoutId = undefined;
      }
    };

    const failStream = (message: string) => {
      clearLoadTimeout();
      setErrorMessage(message);
      setError(true);
      setIsLoading(false);
      setIsBuffering(false);
    };

    const startLoadTimeout = () => {
      clearLoadTimeout();
      loadTimeoutId = window.setTimeout(() => {
        hls?.destroy();
        failStream('This stream did not respond in time. Try again or skip to another channel.');
      }, STREAM_START_TIMEOUT_MS);
    };

    const handleReady = () => {
      clearLoadTimeout();
      setIsLoading(false);
      setIsBuffering(false);
    };
    const handlePlayState = () => setIsPlaying(!video.paused);
    const handleMuteState = () => {
      setIsMuted(video.muted);
      setVolume(video.volume);
    };
    const handleWaiting = () => {
      if (!isLoading) setIsBuffering(true);
    };

    const handleLoadedMetadata = () => {
      handleReady();
      if (!hls && autoPlay) {
        video.play().catch(e => console.warn('Autoplay blocked:', e));
      }
    };
    const handleFallbackError = () => {
      if (!triedProxyFallback && !isLocalProxyUrl(video.src)) {
        triedProxyFallback = true;
        video.src = toProxyUrl(url);
        setIsLoading(true);
        startLoadTimeout();
        video.load();
        return;
      }

      failStream('This stream is unavailable, blocked, or in a format your browser cannot play.');
    };

    startLoadTimeout();

    video.addEventListener('playing', handleReady);
    video.addEventListener('play', handlePlayState);
    video.addEventListener('pause', handlePlayState);
    video.addEventListener('volumechange', handleMuteState);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleReady);
    video.addEventListener('waiting', handleWaiting);

    if (Hls.isSupported() && isHlsUrl(url)) {
      // @ts-ignore - HLS.js internal loader types
      class ProxyLoader extends Hls.DefaultConfig.loader {
        constructor(config: any) {
          super(config);
          const load = this.load.bind(this);
          this.load = (context: any, config: any, callbacks: any) => {
            if (shouldProxyHlsRequests && context.url) {
              context.url = toProxyUrl(context.url);
            }
            load(context, config, callbacks);
          };
        }
      }

      hls = new Hls({
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 1,
        manifestLoadingRetryDelay: 1000,
        levelLoadingTimeOut: 10000,
        levelLoadingMaxRetry: 1,
        levelLoadingRetryDelay: 1000,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 1,
        fragLoadingRetryDelay: 1000,
        pLoader: ProxyLoader as any,
        fLoader: ProxyLoader as any,
      });
      hlsRef.current = hls;

      const loadStream = (targetUrl: string, useProxy: boolean) => {
        shouldProxyHlsRequests = useProxy;
        hls?.loadSource(useProxy ? toProxyUrl(targetUrl) : targetUrl);
        hls?.attachMedia(video);
      };

      loadStream(url, isLocalProxyUrl(url));

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const options = hls ? buildQualityOptions(hls.levels) : [];
        setQualityOptions(options);
        setSelectedQuality(-1);

        if (autoPlay) {
          video.play().catch(e => console.warn('Autoplay blocked:', e));
        }
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        if (!hls) return;

        const level = hls.levels[data.level];
        if (level) {
          setCurrentAutoQuality(formatLevelLabel(level, data.level));
        }
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              if (!triedProxyFallback && !shouldProxyHlsRequests && !isLocalProxyUrl(url)) {
                triedProxyFallback = true;
                retryCount = 0;
                setIsLoading(true);
                startLoadTimeout();
                console.warn('Direct HLS load failed, retrying through proxy', data);
                loadStream(url, true);
                return;
              }

              if (retryCount < 2) {
                retryCount += 1;
                console.warn('Fatal network error encountered, retrying stream load', data);
                hls?.startLoad();
              } else {
                console.error('Unrecoverable HLS network error:', data);
                hls?.destroy();
                failStream('This stream host is not responding right now. Try another channel.');
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoverCount < 1) {
                mediaRecoverCount += 1;
                console.warn('Fatal media error encountered, trying to recover', data);
                hls?.recoverMediaError();
              } else {
                console.error('Unrecoverable HLS media error:', data);
                hls?.destroy();
                failStream('This stream is in a format your browser cannot decode.');
              }
              break;
            default:
              // cannot recover
              console.error('Unrecoverable HLS Error:', data);
              hls?.destroy();
              failStream('This stream could not be loaded.');
              break;
          }
        }
      });
    } else if (isHlsUrl(url) && video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari / iOS)
      video.src = url;
      video.addEventListener('error', handleFallbackError);
    } else {
      // Fallback for non-m3u8 streams or mp4s
      video.src = url;
      video.addEventListener('error', handleFallbackError);
    }

    return () => {
      clearLoadTimeout();
      video.removeEventListener('playing', handleReady);
      video.removeEventListener('play', handlePlayState);
      video.removeEventListener('pause', handlePlayState);
      video.removeEventListener('volumechange', handleMuteState);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleReady);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('error', handleFallbackError);
      if (hls) {
        hls.destroy();
      }
      hlsRef.current = null;
    };
  }, [url, autoPlay]);

  // ---------------------------------------------------------------------
  // Error state — interface voice, one clear primary action.
  // ---------------------------------------------------------------------
  if (error) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center rounded-lg bg-[#050505] p-6 text-center text-white">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20">
          <AlertCircle className="h-6 w-6 text-rose-400" aria-hidden="true" />
        </div>
        <h3 className="mb-2 text-xl font-bold">Stream unavailable</h3>
        <p className="mb-8 max-w-md text-sm text-slate-400">
          {errorMessage || 'This channel stream is currently offline, in an unsupported format, or blocked by your browser.'}
        </p>

        <div className="flex items-center gap-3">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-6 py-3 font-medium text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              <RefreshCw className="h-5 w-5" aria-hidden="true" />
              Try again
            </button>
          )}

          {onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="flex items-center gap-2 rounded-xl border border-[#00D2FF]/30 bg-[#00D2FF]/15 px-6 py-3 font-medium text-[#00D2FF] transition-colors hover:bg-[#00D2FF]/25 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              Skip to next
              <SkipForward className="h-5 w-5" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleRemoteKeyDown}
      onMouseMove={revealControls}
      onMouseDown={revealControls}
      onTouchStart={revealControls}
      className="group/player relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-black focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
    >
      {/* ---- LIVE badge: only meaningful once we know we're actually playing ---- */}
      {isPlaying && !isLoading && (
        <div className="absolute left-4 top-4 z-20 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 backdrop-blur-md">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 motion-reduce:animate-none" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
          </span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-white">Live</span>
        </div>
      )}

      {/* ---- Discoverability hint: shown once, then fades — not nagging ---- */}
      {showKeyboardHint && !isLoading && (
        <div
          aria-hidden="true"
          className="absolute right-4 top-4 z-20 hidden items-center gap-2 rounded-full border border-white/10 bg-black/60 px-3 py-1.5 text-[11px] text-slate-300 backdrop-blur-md motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 md:flex"
        >
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">Space</kbd> play
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">F</kbd> fullscreen
          <kbd className="rounded bg-white/10 px-1.5 py-0.5 font-mono">M</kbd> mute
        </div>
      )}

      {/* ---- Initial load vs. mid-playback rebuffer get distinct messaging ---- */}
      {isLoading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/70">
          <Loader2 className="mb-4 h-10 w-10 animate-spin text-[#00D2FF]" aria-hidden="true" />
          <span className="text-sm font-medium text-white/70">Connecting to channel…</span>
        </div>
      )}
      {!isLoading && isBuffering && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="flex items-center gap-2 rounded-full bg-black/60 px-4 py-2 backdrop-blur-md">
            <Loader2 className="h-4 w-4 animate-spin text-[#00D2FF]" aria-hidden="true" />
            <span className="text-xs font-medium text-white/80">Buffering…</span>
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        controls={false}
        className="h-full w-full object-contain"
        autoPlay={autoPlay}
        crossOrigin="anonymous"
        playsInline
        onClick={togglePlay}
      />

      {/* ---- Control bar: liquid-glass, labeled actions, bottom-anchored ---- */}
      <div
        className={[
          'absolute bottom-6 left-4 right-4 z-20 transition-all duration-300 md:bottom-8 md:left-8 md:right-8',
          shouldShowControls ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0',
        ].join(' ')}
        onClick={event => event.stopPropagation()}
        onFocusCapture={() => {
          setHasControlFocus(true);
          setAreControlsVisible(true);
        }}
        onBlurCapture={event => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setHasControlFocus(false);
          }
        }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/60 px-3 py-3 shadow-2xl backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={togglePlay}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-black transition-transform duration-150 hover:scale-105 hover:bg-[#00D2FF] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF] active:scale-95"
              title={isPlaying ? 'Pause' : 'Play'}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
            </button>

            {/* Volume cluster: click toggles mute, hover/focus reveals slider */}
            <div
              className="relative flex items-center"
              onMouseEnter={() => setIsVolumeSliderOpen(true)}
              onMouseLeave={() => setIsVolumeSliderOpen(false)}
            >
              {isVolumeSliderOpen && (
                <div className="absolute bottom-14 left-0 flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/80 p-3 backdrop-blur-2xl">
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={e => handleVolumeChange(Number(e.target.value))}
                    className="h-24 w-1.5 accent-[#00D2FF] [writing-mode:vertical-lr] [direction:rtl]"
                    aria-label="Volume"
                  />
                  <span className="text-[10px] font-medium text-slate-400">
                    {Math.round((isMuted ? 0 : volume) * 100)}%
                  </span>
                </div>
              )}

              <button
                type="button"
                onClick={toggleMute}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute' : 'Mute'}
              >
                <VolumeIcon className="h-5 w-5" />
              </button>
            </div>

            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="hidden h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-3 text-sm font-medium text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF] sm:flex"
                title="Next channel"
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                Next
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {qualityOptions.length > 0 && (
              <div className="relative">
                {isQualityMenuOpen && (
                  <div
                    role="menu"
                    className="absolute bottom-14 right-0 w-44 overflow-hidden rounded-xl border border-white/10 bg-black/90 shadow-2xl backdrop-blur-2xl"
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={selectedQuality === -1}
                      onClick={() => handleQualityChange(-1)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                    >
                      <span className="flex items-center gap-1.5">
                        <ChevronUp className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                        Auto
                      </span>
                      {selectedQuality === -1 && <Check className="h-4 w-4 text-[#00D2FF]" aria-hidden="true" />}
                    </button>

                    {qualityOptions.map(option => (
                      <button
                        key={option.value}
                        type="button"
                        role="menuitemradio"
                        aria-checked={selectedQuality === option.value}
                        onClick={() => handleQualityChange(option.value)}
                        className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm text-white hover:bg-white/10 focus:bg-white/10 focus:outline-none"
                      >
                        <span>{option.label}</span>
                        {selectedQuality === option.value && (
                          <Check className="h-4 w-4 text-[#00D2FF]" aria-hidden="true" />
                        )}
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    revealControls();
                    setIsQualityMenuOpen(open => !open);
                  }}
                  aria-expanded={isQualityMenuOpen}
                  className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
                  title="Video quality"
                >
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  <span>{selectedQualityLabel}</span>
                </button>
              </div>
            )}

            {pipSupported && (
              <button
                type="button"
                onClick={togglePictureInPicture}
                className={[
                  'flex h-11 w-11 items-center justify-center rounded-xl border text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]',
                  isPipActive
                    ? 'border-[#00D2FF]/40 bg-[#00D2FF]/20 text-[#00D2FF]'
                    : 'border-white/10 bg-white/10 hover:bg-white/20',
                ].join(' ')}
                title={isPipActive ? 'Exit mini player' : 'Mini player'}
                aria-label={isPipActive ? 'Exit mini player' : 'Mini player'}
              >
                <PictureInPicture2 className="h-5 w-5" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleFullscreen}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
