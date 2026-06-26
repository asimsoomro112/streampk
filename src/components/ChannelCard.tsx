import React, { useState } from 'react';
import { Channel } from '../lib/m3uParser';
import { useAppStore } from '../store/useAppStore';
import { Heart } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';

export default function ChannelCard({ channel }: { channel: Channel; key?: React.Key }) {
  const navigate = useNavigate();
  const { favorites, toggleFavorite } = useAppStore();
  const isFavorite = favorites.includes(channel.id);
  const [imgError, setImgError] = useState(false);

  const openPlayer = () => {
    navigate(`/player/${encodeURIComponent(channel.id)}`);
  };

  return (
    <div
      tabIndex={0}
      role="button"
      aria-label={`Play ${channel.name}`}
      onClick={openPlayer}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPlayer();
        }
      }}
      className="relative aspect-video rounded-2xl overflow-hidden bg-[#121212] border border-white/10 hover:border-white/30 focus:border-[#00D2FF] transition-all cursor-pointer group flex flex-col shadow-lg"
    >
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent z-10 pointer-events-none"></div>

      <div className="absolute inset-0 flex items-center justify-center p-6 opacity-70 group-hover:opacity-100 transition-opacity z-0">
        {!imgError && channel.logoUrl ? (
          <img
            src={channel.logoUrl}
            alt={channel.name}
            className="max-h-full max-w-full object-contain drop-shadow-2xl"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md">
            <span className="text-2xl font-black text-white">
              {channel.name.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      <div className="absolute bottom-3 left-4 right-4 z-20 pointer-events-none">
        <p className="text-sm font-bold text-white truncate">{channel.name}</p>
        <p className="text-[10px] text-slate-400 truncate">
          {channel.categories?.[0] || 'General'} - {channel.countryCode}
        </p>
      </div>

      <div className="absolute top-3 left-3 right-3 z-20 flex justify-between items-start">
        <button
          tabIndex={-1}
          onClick={(event) => {
            event.stopPropagation();
            toggleFavorite(channel.id);
          }}
          className={clsx(
            "p-1.5 rounded-full bg-black/40 backdrop-blur-sm transition-colors hover:bg-black/80 border border-white/10",
            isFavorite ? "text-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.3)]" : "text-white/50 hover:text-white"
          )}
          title={isFavorite ? 'Remove favorite' : 'Add favorite'}
        >
          <Heart className={clsx("w-4 h-4", isFavorite && "fill-current")} />
        </button>

        {channel.countryCode && (
          <span className="bg-black/40 border border-white/10 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-bold text-slate-300 uppercase flex items-center gap-1 shadow-sm">
            {getFlagEmoji(channel.countryCode)} {channel.countryCode}
          </span>
        )}
      </div>
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
