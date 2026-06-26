import {
  ARY_NEWS_LIVE_PAGE,
  DEFAULT_USER_AGENT,
  pickAryNewsVideoStream,
  PROXY_TIMEOUT_MS,
  rewritePlaylist,
  setCorsHeaders,
} from '../_streamUtils';

export default async function handler(req: any, res: any) {
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    return res.status(204).end();
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    setCorsHeaders(res);
    return res.status(405).send('Method not allowed');
  }

  try {
    const pageResponse = await fetch(ARY_NEWS_LIVE_PAGE, {
      headers: { 'User-Agent': DEFAULT_USER_AGENT },
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    const html = await pageResponse.text();
    const streamUrl = pickAryNewsVideoStream(html);

    if (!streamUrl) {
      setCorsHeaders(res);
      return res.status(502).send('ARY News stream was not found');
    }

    const streamResponse = await fetch(streamUrl, {
      headers: {
        'User-Agent': DEFAULT_USER_AGENT,
        'Accept': 'application/vnd.apple.mpegurl,application/x-mpegURL,*/*',
        'Referer': ARY_NEWS_LIVE_PAGE,
      },
      signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
    });
    const playlist = await streamResponse.text();

    if (!playlist.trimStart().startsWith('#EXTM3U')) {
      setCorsHeaders(res);
      return res.status(502).send('ARY News stream did not return a playlist');
    }

    setCorsHeaders(res);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.status(streamResponse.status);

    if (req.method === 'HEAD') {
      return res.end();
    }

    return res.send(rewritePlaylist(playlist, streamResponse.url || streamUrl, ARY_NEWS_LIVE_PAGE));
  } catch (error) {
    console.error('ARY News resolver failed:', error);
    setCorsHeaders(res);
    return res.status(502).send('ARY News stream could not be resolved');
  }
}
