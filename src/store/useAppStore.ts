import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Channel, parseM3UFromUrl } from '../lib/m3uParser';
import { PAKISTAN_SUPPLEMENTAL_CHANNELS } from '../data/pakistanSupplementalChannels';
import { VERIFIED_STREAM_URLS } from '../data/verifiedStreamUrls';

const LANGUAGE_PLAYLISTS = [
  { language: 'English', url: 'https://iptv-org.github.io/iptv/languages/eng.m3u' },
  { language: 'Hindi', url: 'https://iptv-org.github.io/iptv/languages/hin.m3u' },
  { language: 'Urdu', url: 'https://iptv-org.github.io/iptv/languages/urd.m3u' },
];

const PAKISTAN_PLAYLIST_URL = 'https://iptv-org.github.io/iptv/countries/pk.m3u';

const UNRELIABLE_STREAM_HOSTS = new Set([
  '115.42.65.142',
  '116.90.120.151',
  '116.90.120.149',
  '121.91.61.106',
  '124.109.47.101',
  '162.250.201.58',
  '163.61.227.29',
  '103.250.28.74',
  '92news.vdn.dstreamone.net',
  '6zklx4wryw9b-hls-live.5centscdn.com',
  'cdn149.anystream.uk',
  'cdn61.liveonlineservices.com',
  'd35j504z0x2vu2.cloudfront.net',
  'f-tx-edge-87.christianworldmedia.com',
  'jk3lz82elw79-hls-live.5centscdn.com',
  'legitpro.co.in',
  'arymusik.aryzap.com',
  'video.primexsports.com',
]);

const UNRELIABLE_STREAM_URLS = new Set([
  'https://ml-pull-dvc-myco.io:2096/SAB_ENTERTAINMENT/tracks-v1a1/mono.ts.m3u8',
  'https://online.godstands.tv:5443/WebRTCApp/streams/HindiStreaming.m3u8',
  'https://online.godstands.tv:5443/WebRTCApp/streams/KidsUrdu.m3u8',
  'https://streamer12.vdn.dstreamone.net/saazoawaz/saazoawaz/playlist.m3u8',
]);

const DISALLOWED_LANGUAGE_WORDS = /\b(arabic|chinese|punjabi|tagalog)\b/i;

function isLikelyPlayableChannel(channel: Channel) {
  if (!/\.m3u8($|[?#])/.test(channel.streamUrl.toLowerCase())) {
    return false;
  }

  if (channel.streamUrl.startsWith('/api/')) {
    return true;
  }

  if (!VERIFIED_STREAM_URLS.has(channel.streamUrl)) {
    return false;
  }

  if (UNRELIABLE_STREAM_URLS.has(channel.streamUrl)) {
    return false;
  }

  try {
    const parsed = new URL(channel.streamUrl);
    return !UNRELIABLE_STREAM_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

function isAllowedLanguageChannel(channel: Channel) {
  return !DISALLOWED_LANGUAGE_WORDS.test(channel.name);
}

function withLanguage(channels: Channel[], language: string) {
  return channels
    .filter(isLikelyPlayableChannel)
    .map(channel => ({
      ...channel,
      languages: channel.languages.includes(language)
        ? channel.languages
        : [...channel.languages, language],
    }));
}

function asPakistanChannels(channels: Channel[]) {
  return channels
    .filter(isLikelyPlayableChannel)
    .filter(isAllowedLanguageChannel)
    .map(channel => ({
      ...channel,
      country: 'Pakistan',
      countryCode: 'PK',
      languages: channel.languages.length > 0 ? channel.languages : ['Urdu'],
    }));
}

function dedupeChannels(channels: Channel[]) {
  const map = new Map<string, Channel>();

  channels.forEach(channel => {
    const existing = map.get(channel.streamUrl);
    if (!existing) {
      map.set(channel.streamUrl, channel);
      return;
    }

    map.set(channel.streamUrl, {
      ...existing,
      languages: Array.from(new Set([...existing.languages, ...channel.languages])),
    });
  });

  return Array.from(map.values());
}

interface AppState {
  channels: Channel[];
  pkChannels: Channel[];
  favorites: string[];
  recentStreams: string[];
  reportedBrokenStreams: string[];
  isLoading: boolean;
  error: string | null;
  loadChannels: () => Promise<void>;
  toggleFavorite: (id: string) => void;
  markRecentChannel: (streamUrl: string) => void;
  clearRecentChannels: () => void;
  reportBrokenChannel: (streamUrl: string) => void;
  clearReportedBrokenChannels: () => void;
}

// Custom sort to feature main PK channels first
const sortPkChannels = (channels: Channel[]) => {
  const priorityKeywords = [
    'GEO', 'ARY', 'HUM', 'Samaa', 'BOL', 'PTV', 'A Sports', 'Ten Sports', 'Dawn', 'Express', 'Dunya'
  ];
  const getStreamScore = (channel: Channel) => {
    let score = 0;
    const streamUrl = channel.streamUrl.toLowerCase();

    if (!/\.m3u8($|[?#])/.test(streamUrl)) {
      score += 1000;
    }

    try {
      if (channel.streamUrl.startsWith('/api/')) {
        return score;
      }

      const parsed = new URL(channel.streamUrl);
      if (parsed.protocol === 'http:') score += 50;
      if (UNRELIABLE_STREAM_HOSTS.has(parsed.hostname)) score += 1000;
    } catch {
      score += 1000;
    }

    if (/\bnot 24\/7\b/i.test(channel.name)) {
      score += 100;
    }

    return score;
  };
  
  return channels.sort((a, b) => {
    const aStreamScore = getStreamScore(a);
    const bStreamScore = getStreamScore(b);
    if (aStreamScore !== bStreamScore) return aStreamScore - bStreamScore;

    const aPriority = priorityKeywords.findIndex(kw => a.name.toLowerCase().includes(kw.toLowerCase()));
    const bPriority = priorityKeywords.findIndex(kw => b.name.toLowerCase().includes(kw.toLowerCase()));
    
    if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
    if (aPriority !== -1) return -1;
    if (bPriority !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      channels: [],
      pkChannels: [],
      favorites: [],
      recentStreams: [],
      reportedBrokenStreams: [],
      isLoading: false,
      error: null,
      loadChannels: async () => {
        // Avoid duplicate playlist fetches, including React StrictMode double effects.
        if (get().isLoading || get().channels.length > 0) return;
        
        set({ isLoading: true, error: null });
        try {
          const urduPlaylist = LANGUAGE_PLAYLISTS.find(playlist => playlist.language === 'Urdu')!;
          const [pakistanChannels, urduChannels] = await Promise.all([
            parseM3UFromUrl(PAKISTAN_PLAYLIST_URL),
            parseM3UFromUrl(urduPlaylist.url),
          ]);

          const reportedBrokenStreams = new Set(get().reportedBrokenStreams);
          const hideReportedStreams = (channels: Channel[]) =>
            channels.filter(channel => !reportedBrokenStreams.has(channel.streamUrl));

          set({
            pkChannels: sortPkChannels(dedupeChannels([
              ...asPakistanChannels(pakistanChannels),
              ...asPakistanChannels(PAKISTAN_SUPPLEMENTAL_CHANNELS),
              ...withLanguage(urduChannels, urduPlaylist.language),
            ].filter(channel => !reportedBrokenStreams.has(channel.streamUrl)))),
          });

          const languageChannels = await Promise.all(
            LANGUAGE_PLAYLISTS.map(async (playlist) => {
              const channels = await parseM3UFromUrl(playlist.url);
              return withLanguage(channels, playlist.language);
            })
          );

          set({
            channels: hideReportedStreams(dedupeChannels(languageChannels.flat())),
            isLoading: false,
          });
        } catch (err) {
          console.error(err);
          set({ error: 'Failed to load channels', isLoading: false });
        }
      },
      toggleFavorite: (id) => set((state) => ({
        favorites: state.favorites.includes(id)
          ? state.favorites.filter(fav => fav !== id)
          : [...state.favorites, id]
      })),
      markRecentChannel: (streamUrl) => set((state) => ({
        recentStreams: [
          streamUrl,
          ...state.recentStreams.filter(item => item !== streamUrl),
        ].slice(0, 12),
      })),
      clearRecentChannels: () => set({ recentStreams: [] }),
      reportBrokenChannel: (streamUrl) => set((state) => {
        const brokenStreams = state.reportedBrokenStreams.includes(streamUrl)
          ? state.reportedBrokenStreams
          : [streamUrl, ...state.reportedBrokenStreams];

        return {
          reportedBrokenStreams: brokenStreams,
          recentStreams: state.recentStreams.filter(item => item !== streamUrl),
          pkChannels: state.pkChannels.filter(channel => channel.streamUrl !== streamUrl),
          channels: state.channels.filter(channel => channel.streamUrl !== streamUrl),
        };
      }),
      clearReportedBrokenChannels: () => {
        set({
          reportedBrokenStreams: [],
          channels: [],
          pkChannels: [],
        });
        void get().loadChannels();
      }
    }),
    {
      name: 'streampk-storage',
      partialize: (state) => ({
        favorites: state.favorites,
        recentStreams: state.recentStreams,
        reportedBrokenStreams: state.reportedBrokenStreams,
      })
    }
  )
);
