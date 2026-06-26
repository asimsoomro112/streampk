import React, { useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import ChannelCard from '../components/ChannelCard';
import { ArrowLeft, Search } from 'lucide-react';

export default function Countries() {
  const { channels, pkChannels } = useAppStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);

  const allChannels = useMemo(() => {
    const map = new Map<string, (typeof channels)[number]>();
    [...pkChannels, ...channels].forEach(channel => {
      map.set(channel.streamUrl, channel);
    });
    return Array.from(map.values());
  }, [channels, pkChannels]);

  const countries = useMemo(() => {
    const map = new Map<string, { name: string; count: number; code: string }>();

    allChannels.forEach(channel => {
      if (!channel.country || !channel.countryCode) return;

      const existing = map.get(channel.countryCode);
      if (existing) {
        existing.count++;
      } else {
        map.set(channel.countryCode, {
          name: channel.country,
          code: channel.countryCode,
          count: 1,
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [allChannels]);

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const countryChannels = selectedCountry
    ? allChannels.filter(channel => channel.countryCode === selectedCountry)
    : [];

  return (
    <div className="animate-in fade-in duration-300 pt-4 pb-8">
      {selectedCountry ? (
        <div>
          <button
            onClick={() => setSelectedCountry(null)}
            className="mb-6 text-[#00D2FF] hover:underline font-medium focus:outline-none flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Countries
          </button>
          <h2 className="text-2xl font-bold text-white mb-6">
            Channels from {countries.find(country => country.code === selectedCountry)?.name}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
            {countryChannels.map(channel => (
              <ChannelCard key={channel.id} channel={channel} />
            ))}
          </div>
        </div>
      ) : (
        <div>
          <div className="sticky top-0 bg-[#050505] pt-2 pb-4 z-10">
            <h1 className="text-2xl font-bold text-white mb-4">Countries</h1>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                placeholder="Search countries..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full bg-[#121212] border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#00D2FF] shadow-inner"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 md:gap-6 mt-4">
            {filteredCountries.map(country => (
              <button
                key={country.code}
                onClick={() => setSelectedCountry(country.code)}
                className="flex flex-col items-center justify-center bg-[#121212] p-6 rounded-2xl border border-white/5 hover:border-[#00D2FF]/50 hover:bg-white/5 transition-colors focus:outline-none focus:ring-2 focus:ring-[#00D2FF] shadow-lg group"
              >
                <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{getFlagEmoji(country.code)}</span>
                <span className="text-sm font-bold text-white text-center truncate w-full">{country.name}</span>
                <span className="text-xs text-slate-500">{country.count} channels</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function getFlagEmoji(countryCode: string) {
  if (!countryCode || countryCode.length !== 2) return '';

  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));

  return String.fromCodePoint(...codePoints);
}
