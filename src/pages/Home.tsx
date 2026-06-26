import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import ChannelCard from '../components/ChannelCard';
import { Clock3, Loader2, RadioTower, RefreshCw, Sparkles } from 'lucide-react';
import clsx from 'clsx';

const CATEGORIES = ['All', 'News', 'Sports', 'Entertainment', 'Kids', 'Movies', 'Music', 'Documentary'];

// How many Pakistan channels get the large "featured" bento treatment
// vs. the compact rail. Keeps the section scannable instead of one long strip.
const FEATURED_PK_COUNT = 4;
const PK_COLLAPSED_COUNT = 15;

export default function Home() {
  const {
    channels,
    pkChannels,
    recentStreams,
    reportedBrokenStreams,
    isLoading,
    error,
    loadChannels,
    clearRecentChannels,
    clearReportedBrokenChannels,
  } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedCategory = searchParams.get('category') || 'All';
  const [showAllPkChannels, setShowAllPkChannels] = useState(false);

  const setSelectedCategory = (category: string) => {
    setSearchParams(category === 'All' ? {} : { category });
  };

  const filteredChannels = useMemo(
    () =>
      channels.filter(ch => {
        if (selectedCategory === 'All') return true;
        return ch.categories.some(c => c.toLowerCase().includes(selectedCategory.toLowerCase()));
      }),
    [channels, selectedCategory]
  );

  const featuredPk = pkChannels.slice(0, FEATURED_PK_COUNT);
  const restPk = pkChannels.slice(FEATURED_PK_COUNT);
  const visibleRestPk = showAllPkChannels ? restPk : restPk.slice(0, PK_COLLAPSED_COUNT - FEATURED_PK_COUNT);
  const channelByStream = useMemo(() => {
    const map = new Map<string, (typeof channels)[number]>();
    [...pkChannels, ...channels].forEach(channel => {
      map.set(channel.streamUrl, channel);
    });
    return map;
  }, [channels, pkChannels]);
  const recentChannels = useMemo(
    () => recentStreams
      .map(streamUrl => channelByStream.get(streamUrl))
      .filter((channel): channel is (typeof channels)[number] => Boolean(channel))
      .slice(0, 10),
    [channelByStream, channels, recentStreams]
  );

  // ---- Error state: interface voice, says what happened and how to fix it ----
  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/[0.03] p-8 text-center backdrop-blur-xl">
          <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 ring-1 ring-rose-500/20">
            <RadioTower className="h-5 w-5 text-rose-400" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-white">Channels didn't load</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{error}</p>
          <button
            type="button"
            onClick={() => loadChannels()}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform duration-150 hover:scale-[1.03] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF] focus-visible:ring-offset-2 focus-visible:ring-offset-black active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500 space-y-12 pb-8 pt-4">
      {recentChannels.length > 0 && (
        <section aria-labelledby="recent-heading">
          <div className="mb-5 flex items-center justify-between">
            <h2 id="recent-heading" className="flex items-center text-lg font-bold text-white md:text-xl">
              <span className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
                <Clock3 className="h-3.5 w-3.5 text-[#00D2FF]" aria-hidden="true" />
              </span>
              Continue Watching
            </h2>
            <button
              type="button"
              onClick={clearRecentChannels}
              className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              Clear
            </button>
          </div>

          <div className="hide-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {recentChannels.map(channel => (
              <div key={channel.id} className="w-44 shrink-0 snap-start md:w-64">
                <ChannelCard channel={channel} />
              </div>
            ))}
          </div>
        </section>
      )}
      {/* ============ Pakistan & Urdu — bento-featured rail ============ */}
      <section aria-labelledby="pk-heading">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="pk-heading" className="flex items-center text-lg font-bold text-white md:text-xl">
            <span className="mr-3 h-6 w-1 rounded-full bg-gradient-to-b from-[#00D2FF] to-[#7C5CFF]" />
            Pakistan &amp; Urdu Channels
          </h2>
          {restPk.length > PK_COLLAPSED_COUNT - FEATURED_PK_COUNT && (
            <button
              type="button"
              onClick={() => setShowAllPkChannels(s => !s)}
              aria-expanded={showAllPkChannels}
              className="rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[#00D2FF] transition-colors hover:bg-[#00D2FF]/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF]"
            >
              {showAllPkChannels ? 'Show less' : 'View all'}
            </button>
          )}
        </div>

        {pkChannels.length === 0 && isLoading ? (
          <PkSkeleton />
        ) : pkChannels.length === 0 ? (
          <EmptyRow label="No Pakistani channels available right now." />
        ) : (
          <div className="space-y-4">
            {/* Featured bento row — first few PK channels get larger glass tiles */}
            {featuredPk.length > 0 && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {featuredPk.map((channel, i) => (
                  <div
                    key={channel.id}
                    className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
                    style={{ animationDelay: `${i * 60}ms`, animationDuration: '400ms', animationFillMode: 'backwards' }}
                  >
                    <ChannelCard channel={channel} />
                  </div>
                ))}
              </div>
            )}

            {/* Remaining PK channels — compact horizontal rail */}
            {visibleRestPk.length > 0 && (
              <div className="hide-scrollbar -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
                {visibleRestPk.map(channel => (
                  <div key={channel.id} className="w-40 shrink-0 snap-start md:w-56">
                    <ChannelCard channel={channel} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* ============ Discover Global ============ */}
      <section aria-labelledby="global-heading">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="global-heading" className="flex items-center text-lg font-bold text-white md:text-xl">
            <span className="mr-3 h-6 w-1 rounded-full bg-slate-600" />
            Discover Global
          </h2>
          <div className="flex items-center gap-2">
            {reportedBrokenStreams.length > 0 && (
              <button
                type="button"
                onClick={clearReportedBrokenChannels}
                className="rounded-full border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-200 transition-colors hover:bg-amber-400/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
              >
                Restore hidden
              </button>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-slate-400 ring-1 ring-white/10">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              {filteredChannels.length} channel{filteredChannels.length === 1 ? '' : 's'}
            </span>
          </div>
        </div>

        {/* Category pills — sticky so filtering stays reachable while scrolling a long grid */}
        <div
          className="hide-scrollbar sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-gradient-to-b from-black/80 to-transparent px-4 py-3 backdrop-blur-md md:static md:mx-0 md:bg-none md:px-0 md:py-0 md:pb-4"
          role="tablist"
          aria-label="Filter channels by category"
        >
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              type="button"
              role="tab"
              aria-selected={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={clsx(
                'whitespace-nowrap rounded-full border px-4 py-2 text-xs font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00D2FF] focus-visible:ring-offset-2 focus-visible:ring-offset-black',
                selectedCategory === cat
                  ? 'border-[#00D2FF]/40 bg-gradient-to-r from-[#00D2FF]/20 to-[#7C5CFF]/20 font-bold text-white shadow-[0_0_20px_-4px_rgba(0,210,255,0.5)]'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]'
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 md:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          {filteredChannels.length > 0
            ? filteredChannels.map((channel, i) => (
                <div
                  key={channel.id}
                  className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300"
                  style={{ animationDelay: `${Math.min(i, 10) * 35}ms`, animationFillMode: 'backwards' }}
                >
                  <ChannelCard channel={channel} />
                </div>
              ))
            : isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-video animate-pulse rounded-2xl border border-white/5 bg-white/[0.03]"
                  />
                ))
              : (
                <EmptyGrid category={selectedCategory} />
              )}
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton for the Pakistan rail — mirrors the real bento + rail
// shape so the layout doesn't jump once data lands.
// ---------------------------------------------------------------------------
function PkSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-video animate-pulse rounded-2xl border border-white/5 bg-white/[0.04]" />
        ))}
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="aspect-video w-40 shrink-0 animate-pulse rounded-2xl border border-white/5 bg-white/[0.03] md:w-56" />
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 pt-1 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        Loading channels…
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty states — written in the interface's voice: what happened, what to
// do next. No apology, no vagueness.
// ---------------------------------------------------------------------------
function EmptyRow({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] py-8 text-center text-sm text-slate-500">
      {label}
    </div>
  );
}

function EmptyGrid({ category }: { category: string }) {
  return (
    <div className="col-span-full flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 py-14 text-center">
      <RadioTower className="h-6 w-6 text-slate-600" aria-hidden="true" />
      <p className="text-sm font-medium text-slate-300">
        No channels in <span className="text-white">{category}</span> yet.
      </p>
      <p className="text-xs text-slate-500">Try a different category or check back later.</p>
    </div>
  );
}
