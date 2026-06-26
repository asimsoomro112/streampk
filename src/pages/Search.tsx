import React, { useState, useMemo } from 'react';
import { useAppStore } from '../store/useAppStore';
import ChannelCard from '../components/ChannelCard';
import { Search as SearchIcon } from 'lucide-react';

export default function Search() {
  const { channels, pkChannels } = useAppStore();
  const [query, setQuery] = useState('');

  const allChannels = useMemo(() => {
    const map = new Map<string, (typeof channels)[number]>();
    [...pkChannels, ...channels].forEach(channel => {
      map.set(channel.streamUrl, channel);
    });
    return Array.from(map.values());
  }, [channels, pkChannels]);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();
    return allChannels.filter(ch => 
      ch.name.toLowerCase().includes(q) ||
      ch.categories.some(c => c.toLowerCase().includes(q)) ||
      ch.languages.some(language => language.toLowerCase().includes(q)) ||
      ch.country?.toLowerCase().includes(q)
    );
  }, [query, allChannels]);

  return (
    <div className="animate-in fade-in duration-300 pt-4 pb-8 flex flex-col h-full">
      <div className="sticky top-0 bg-[#050505] pt-2 pb-4 z-10">
        <h1 className="text-2xl font-bold text-white mb-4">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
          <input 
            type="text" 
            autoFocus
            placeholder="Search channels, categories, or countries..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-[#121212] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00D2FF] shadow-inner"
          />
        </div>
      </div>

      <div className="flex-1 mt-4">
        {!query.trim() ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4 pt-20">
            <SearchIcon className="w-16 h-16 opacity-20" />
            <p>Type to start searching across {allChannels.length} channels</p>
          </div>
        ) : results.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {results.map(channel => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        ) : (
          <div className="text-center pt-20 text-slate-500">
            No results found for "{query}"
          </div>
        )}
      </div>
    </div>
  );
}
