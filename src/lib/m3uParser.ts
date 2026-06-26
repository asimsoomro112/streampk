export interface Channel {
  id: string;
  name: string;
  streamUrl: string;
  logoUrl?: string;
  categories: string[];
  country: string;
  countryCode: string;
  languages: string[];
  isNsfw: boolean;
  listedQuality?: string;
}

function extractAttribute(line: string, attr: string): string {
  const regex = new RegExp(`${attr}="([^"]*?)"`, 'i');
  const match = line.match(regex);
  return match ? match[1] : '';
}

function extractListedQuality(name: string): string | undefined {
  const match = name.match(/\((\d{3,4}[pi])\)/i);
  return match?.[1]?.toLowerCase();
}

function cleanChannelName(name: string): string {
  return name
    .replace(/\s*\(\d{3,4}[pi]\)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeLogoUrl(logo: string): string | undefined {
  if (!logo) return undefined;

  try {
    const parsed = new URL(logo);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function inferCountryCode(tvgId: string, explicitCountry: string): string {
  if (explicitCountry) {
    return explicitCountry.toUpperCase();
  }

  const withoutVariant = tvgId.split('@')[0] || '';
  const match = withoutVariant.match(/\.([a-z]{2})$/i);
  if (!match) return '';

  const code = match[1].toUpperCase();
  return code === 'UK' ? 'GB' : code;
}

function getCountryName(countryCode: string) {
  if (!countryCode) return '';

  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(countryCode) || countryCode;
  } catch {
    return countryCode;
  }
}

export async function parseM3UFromUrl(url: string): Promise<Channel[]> {
  try {
    const response = await fetch(url);
    const content = await response.text();
    return parseM3UContent(content);
  } catch (error) {
    console.error("Failed to fetch M3U:", error);
    return [];
  }
}

export function parseM3UContent(content: string): Channel[] {
  const channels: Channel[] = [];
  const lines = content.split('\n').map(l => l.trim());

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('#EXTINF')) {
      let streamUrl = '';
      // Find the next non-empty, non-comment line
      for (let j = i + 1; j < lines.length; j++) {
        if (lines[j] && !lines[j].startsWith('#')) {
          streamUrl = lines[j];
          break;
        }
      }

      if (streamUrl && streamUrl.startsWith('http')) {
        const tvgId = extractAttribute(line, 'tvg-id');
        const id = tvgId || crypto.randomUUID();
        
        // Extract name
        let name = extractAttribute(line, 'tvg-name');
        if (!name) {
          const parts = line.split(',');
          name = parts[parts.length - 1]?.trim();
        }
        const listedQuality = extractListedQuality(name || '');
        const cleanName = cleanChannelName(name || 'Unknown Channel');
        
        const logo = normalizeLogoUrl(extractAttribute(line, 'tvg-logo'));
        const country = extractAttribute(line, 'tvg-country');
        const countryCode = inferCountryCode(tvgId, country);
        const language = extractAttribute(line, 'tvg-language');
        const groupTitle = extractAttribute(line, 'group-title') || 'General';

        const isNsfw = /XXX|Adult|18\+/i.test(groupTitle);

        if (!isNsfw) {
          channels.push({
            id,
            name: cleanName || 'Unknown Channel',
            streamUrl,
            logoUrl: logo,
            categories: groupTitle ? groupTitle.split(';').map(c => c.trim()) : ['General'],
            country: getCountryName(countryCode),
            countryCode,
            languages: language ? language.split(';').map(l => l.trim()) : [],
            isNsfw,
            listedQuality
          });
        }
      }
    }
  }
  
  // Deduplicate by stream URL to avoid identical multiple entries
  const uniqueChannels = new Map<string, Channel>();
  channels.forEach(ch => {
    if (!uniqueChannels.has(ch.streamUrl)) {
      uniqueChannels.set(ch.streamUrl, ch);
    }
  });
  
  return Array.from(uniqueChannels.values());
}
