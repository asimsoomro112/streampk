import { Readable } from 'stream';
import {
  copyResponseHeaders,
  DEFAULT_USER_AGENT,
  firstQueryValue,
  isHttpUrl,
  isPlaylistResponse,
  PROXY_TIMEOUT_MS,
  rewritePlaylist,
  setCorsHeaders,
} from './_streamUtils';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    setCorsHeaders(res);
    return res.status(405).send('Method not allowed');
  }

  const targetUrl = firstQueryValue(req.query?.url);
  if (!targetUrl) {
    setCorsHeaders(res);
    return res.status(400).send('URL is required');
  }

  if (!isHttpUrl(targetUrl)) {
    setCorsHeaders(res);
    return res.status(400).send('Only http and https URLs are supported');
  }

  const referer = firstQueryValue(req.query?.referer);
  const safeReferer = referer && isHttpUrl(referer) ? referer : undefined;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

  try {
    const headers: Record<string, string> = {
      'User-Agent': req.headers?.['user-agent'] || DEFAULT_USER_AGENT,
      'Accept': req.headers?.accept || '*/*',
    };

    if (safeReferer) headers.Referer = safeReferer;
    if (req.headers?.range) headers.Range = req.headers.range;

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      redirect: 'follow',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    res.status(response.status);
    copyResponseHeaders(response, res);

    if (req.method === 'HEAD') {
      return res.end();
    }

    const contentType = response.headers.get('content-type');
    if (isPlaylistResponse(targetUrl, contentType)) {
      const playlist = await response.text();
      if (!playlist.trimStart().startsWith('#EXTM3U')) {
        return res.send(playlist);
      }

      const rewrittenPlaylist = rewritePlaylist(playlist, response.url || targetUrl, safeReferer);
      res.setHeader('Content-Type', contentType || 'application/vnd.apple.mpegurl');
      return res.send(rewrittenPlaylist);
    }

    if (!response.body) {
      return res.end();
    }

    const stream = Readable.fromWeb(response.body as any);
    stream.on('error', () => {
      if (!res.writableEnded) {
        res.end();
      }
    });
    return stream.pipe(res);
  } catch (error) {
    clearTimeout(timeoutId);
    setCorsHeaders(res);

    const errorName = error instanceof Error ? error.name : '';
    const causeCode = (error as { cause?: { code?: string } })?.cause?.code;
    if (errorName === 'AbortError' || causeCode === 'UND_ERR_CONNECT_TIMEOUT') {
      return res.status(504).send('Stream timed out');
    }

    console.error('Vercel proxy error:', error);
    return res.status(502).send('Proxy failed to load stream');
  }
}
