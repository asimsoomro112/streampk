import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import VideoPlayer from '../components/VideoPlayer';
import { AlertTriangle, ArrowLeft, Heart, Loader2, RadioTower, SkipForward } from 'lucide-react';
import clsx from 'clsx';

export default function Player() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    channels,
    pkChannels,
    favorites,
    isLoading,
    loadChannels,
    toggleFavorite,
    markRecentChannel,
    reportBrokenChannel,
  } = useAppStore();
  const [retryKey, setRetryKey] = useState(0);
  const [isFavoritePulsing, setIsFavoritePulsing] = useState(false);

  const channel = pkChannels.find(c => c.id === id) || channels.find(c => c.id === id);
  const isFavorite = channel ? favorites.includes(channel.id) : false;

  // The "up next" rail should reflect whichever list the *current* channel
  // actually belongs to — not always default to the Pakistan list, or the
  // section title and contents can disagree with each other.
  const sourceList = channel && pkChannels.some(c => c.id === channel.id) ? pkChannels : channels;
  const isPkSource = channel ? pkChannels.some(c => c.id === channel.id) : false;

  useEffect(() => {
    if (pkChannels.length === 0 && channels.length === 0) {
      loadChannels();
    }
  }, [channels.length, pkChannels.length, loadChannels]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [id]);

  useEffect(() => {
    if (channel) {
      markRecentChannel(channel.streamUrl);
    }
  }, [channel, markRecentChannel]);

  if (!channel) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505] p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          {isLoading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-[#00D2FF]" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-400">Loading channel…</p>
            </>
          ) : (
            <>
              <RadioTower className="h-6 w-6 text-slate-600" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-300">Channel not found.</p>
              <p className="text-xs text-slate-500">It may still be loading, or the link may be out of date.</p>
              <button
                type="button"
                onClick={() => navigate('/')}
                className="mt-2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF] active:scale-95"
              >
                Back to channels
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  const handleRetry = () => {
    setRetryKey(prev => prev + 1);
  };

  const handleSkip = () => {
    const currentIndex = sourceList.findIndex(c => c.id === id);

    if (currentIndex !== -1 && sourceList.length > 0) {
      const nextChannel = sourceList[(currentIndex + 1) % sourceList.length];
      navigate(`/player/${encodeURIComponent(nextChannel.id)}`, { replace: true });
    }
  };

  const handleToggleFavorite = () => {
    setIsFavoritePulsing(true);
    toggleFavorite(channel.id);
    window.setTimeout(() => setIsFavoritePulsing(false), 300);
  };

  const handleReportBroken = () => {
    const currentIndex = sourceList.findIndex(item => item.id === channel.id);
    const nextChannel = sourceList.find((item, index) => index > currentIndex && item.streamUrl !== channel.streamUrl)
      || sourceList.find(item => item.streamUrl !== channel.streamUrl);

    reportBrokenChannel(channel.streamUrl);

    if (nextChannel) {
      navigate(`/player/${encodeURIComponent(nextChannel.id)}`, { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  };

  const channelList = sourceList.filter(item => item.id !== channel.id).slice(0, 12);

  return (
    <div className="min-h-screen overflow-y-auto bg-[#050505] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 md:px-8 md:py-6">
        {/* ---------------- Header ---------------- */}
        <header className="mb-4 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
              title="Back"
              aria-label="Go back"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>

            {channel.logoUrl && (
              <img
                src={channel.logoUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg border border-white/10 bg-neutral-900 object-contain"
              />
            )}

            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold leading-tight text-white md:text-2xl">{channel.name}</h1>
              <p className="truncate text-sm text-slate-400">
                {channel.categories.join(', ')} · {channel.countryCode}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleFavorite}
            className={clsx(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]',
              isFavoritePulsing && 'motion-safe:scale-110',
              isFavorite
                ? 'border-pink-500/30 bg-pink-500/10 text-pink-500 hover:text-pink-400'
                : 'border-white/10 bg-white/10 text-white hover:text-[#00D2FF]'
            )}
            title={isFavorite ? 'Remove favorite' : 'Add favorite'}
            aria-pressed={isFavorite}
          >
            <Heart className={clsx('h-6 w-6', isFavorite && 'fill-current')} />
          </button>
        </header>

        {/* ---------------- Player ---------------- */}
        <div className="relative aspect-video max-h-[72vh] w-full overflow-hidden rounded-2xl border border-white/10 bg-black shadow-2xl">
          <VideoPlayer
            key={`${id}-${retryKey}`}
            url={channel.streamUrl}
            autoPlay={true}
            onRetry={handleRetry}
            onSkip={handleSkip}
          />
        </div>

        {/* ---------------- Actions ---------------- */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleReportBroken}
            className="flex h-11 items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 text-sm font-semibold text-amber-200 transition-colors hover:bg-amber-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Report broken
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRetry}
              className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/10 px-4 text-sm font-semibold text-white transition-colors hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              Retry
            </button>

            <button
              type="button"
              onClick={handleSkip}
              className="flex h-11 items-center gap-2 rounded-xl border border-[#00D2FF]/30 bg-gradient-to-r from-[#00D2FF]/20 to-[#7C5CFF]/20 px-4 text-sm font-semibold text-[#00D2FF] transition-colors hover:from-[#00D2FF]/30 hover:to-[#7C5CFF]/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              Next
              <SkipForward className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ---------------- Up next rail ---------------- */}
        {channelList.length > 0 && (
          <section className="mt-6 pb-8">
            <h2 className="mb-3 flex items-center text-sm font-bold uppercase tracking-wider text-slate-500">
              <span className="mr-2.5 h-4 w-0.5 rounded-full bg-gradient-to-b from-[#00D2FF] to-[#7C5CFF]" />
              {isPkSource ? 'More Pakistan & Urdu Channels' : 'More Channels'}
            </h2>
            <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
              {channelList.map((item, i) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(`/player/${encodeURIComponent(item.id)}`, { replace: true })}
                  className="motion-safe:animate-in motion-safe:fade-in min-w-44 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:border-white/20 hover:bg-white/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
                  style={{ animationDelay: `${Math.min(i, 8) * 40}ms`, animationDuration: '300ms', animationFillMode: 'backwards' }}
                >
                  <span className="block truncate text-sm font-semibold text-white">{item.name}</span>
                  <span className="block truncate text-xs text-slate-500">{item.categories[0] || 'General'}</span>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
