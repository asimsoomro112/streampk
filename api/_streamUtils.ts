export const PROXY_TIMEOUT_MS = 12000;
export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
export const ARY_NEWS_LIVE_PAGE = 'https://live.arynews.tv/';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

export function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function toProxyUrl(resourceUrl: string, baseUrl: string, refererUrl?: string) {
  try {
    const absoluteUrl = new URL(resourceUrl, baseUrl);
    if (absoluteUrl.protocol !== 'http:' && absoluteUrl.protocol !== 'https:') {
      return resourceUrl;
    }

    const proxyUrl = new URLSearchParams({ url: absoluteUrl.toString() });
    if (refererUrl) {
      proxyUrl.set('referer', refererUrl);
    }

    return `/api/proxy?${proxyUrl.toString()}`;
  } catch {
    return resourceUrl;
  }
}

export function rewritePlaylist(content: string, baseUrl: string, refererUrl?: string) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          return `URI="${toProxyUrl(uri, baseUrl, refererUrl)}"`;
        });
      }

      return toProxyUrl(trimmed, baseUrl, refererUrl);
    })
    .join('\n');
}

export function isPlaylistResponse(targetUrl: string, contentType: string | null) {
  if (contentType && /mpegurl|vnd\.apple\.mpegurl|application\/x-mpegurl/i.test(contentType)) {
    return true;
  }

  try {
    return /\.m3u8?$/i.test(new URL(targetUrl).pathname);
  } catch {
    return false;
  }
}

export function setCorsHeaders(res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Origin, Accept, Content-Type, User-Agent');
}

export function copyResponseHeaders(response: Response, res: any) {
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && !key.toLowerCase().startsWith('access-control-')) {
      res.setHeader(key, value);
    }
  });

  setCorsHeaders(res);
}

export function firstQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function pickAryNewsVideoStream(html: string) {
  const streams = Array.from(html.matchAll(/https?:[^"'<>\\\s]+\.m3u8[^"'<>\\\s]*/gi))
    .map(match => match[0].replace(/&amp;/g, '&'));

  return streams.find(stream => {
    try {
      const parsed = new URL(stream);
      return parsed.hostname === 'arynews.aryzap.com';
    } catch {
      return false;
    }
  });
}
