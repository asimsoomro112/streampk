import React, { useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import ChannelCard from '../components/ChannelCard';
import { Heart } from 'lucide-react';

export default function Favorites() {
  const { channels, pkChannels, favorites } = useAppStore();

  const channelLookup = useMemo(() => {
    const map = new Map<string, (typeof channels)[number]>();
    [...pkChannels, ...channels].forEach(channel => {
      map.set(channel.id, channel);
    });
    return map;
  }, [channels, pkChannels]);

  const favoriteChannels = favorites
    .map(favoriteId => channelLookup.get(favoriteId))
    .filter(Boolean);

  return (
    <div className="animate-in fade-in duration-300 pt-4 pb-8">
      <div className="flex items-center gap-3 mb-6">
        <Heart className="w-6 h-6 text-pink-500 fill-current" />
        <h1 className="text-2xl font-bold text-white tracking-tight">Your Favorites</h1>
      </div>

      {favoriteChannels.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {favoriteChannels.map(channel => channel && (
            <ChannelCard key={channel.id} channel={channel} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center text-center pt-32 px-4">
          <div className="w-20 h-20 bg-[#121212] border border-white/5 shadow-inner rounded-full flex items-center justify-center mb-6">
            <Heart className="w-10 h-10 text-slate-700" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">No favorites yet</h2>
          <p className="text-slate-400 max-w-sm">
            Tap the heart icon on any channel to save it here for quick access later.
          </p>
        </div>
      )}
    </div>
  );
}
