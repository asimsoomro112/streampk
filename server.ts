import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Readable } from "stream";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

const PROXY_TIMEOUT_MS = 12000;
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const ARY_NEWS_LIVE_PAGE = "https://live.arynews.tv/";

function isHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function toProxyUrl(resourceUrl: string, baseUrl: string, refererUrl?: string) {
  try {
    const absoluteUrl = new URL(resourceUrl, baseUrl);
    if (absoluteUrl.protocol !== "http:" && absoluteUrl.protocol !== "https:") {
      return resourceUrl;
    }

    const proxyUrl = new URLSearchParams({ url: absoluteUrl.toString() });
    if (refererUrl) {
      proxyUrl.set("referer", refererUrl);
    }

    return `/api/proxy?${proxyUrl.toString()}`;
  } catch {
    return resourceUrl;
  }
}

function rewritePlaylist(content: string, baseUrl: string, refererUrl?: string) {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        return line.replace(/URI="([^"]+)"/g, (_, uri: string) => {
          return `URI="${toProxyUrl(uri, baseUrl, refererUrl)}"`;
        });
      }

      return toProxyUrl(trimmed, baseUrl, refererUrl);
    })
    .join("\n");
}

function isPlaylistResponse(targetUrl: string, contentType: string | null) {
  if (contentType && /mpegurl|vnd\.apple\.mpegurl|application\/x-mpegurl/i.test(contentType)) {
    return true;
  }

  try {
    return /\.m3u8?$/i.test(new URL(targetUrl).pathname);
  } catch {
    return false;
  }
}

function copyResponseHeaders(response: Response, res: express.Response) {
  response.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase()) && !key.toLowerCase().startsWith("access-control-")) {
      res.setHeader(key, value);
    }
  });

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Accept, Content-Type, User-Agent");
}

function pickAryNewsVideoStream(html: string) {
  const streams = Array.from(html.matchAll(/https?:[^"'<>\\\s]+\.m3u8[^"'<>\\\s]*/gi))
    .map(match => match[0].replace(/&amp;/g, "&"));

  return streams.find(stream => {
    try {
      const parsed = new URL(stream);
      return parsed.hostname === "arynews.aryzap.com";
    } catch {
      return false;
    }
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.options("/api/proxy", (_req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Range, Origin, Accept, Content-Type, User-Agent");
    res.status(204).end();
  });

  app.get("/api/live/ary-news.m3u8", async (_req, res) => {
    try {
      const pageResponse = await fetch(ARY_NEWS_LIVE_PAGE, {
        headers: { "User-Agent": DEFAULT_USER_AGENT },
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      const html = await pageResponse.text();
      const streamUrl = pickAryNewsVideoStream(html);

      if (!streamUrl) {
        return res.status(502).send("ARY News stream was not found");
      }

      const streamResponse = await fetch(streamUrl, {
        headers: {
          "User-Agent": DEFAULT_USER_AGENT,
          "Accept": "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
          "Referer": ARY_NEWS_LIVE_PAGE,
        },
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
      });
      const playlist = await streamResponse.text();

      if (!playlist.trimStart().startsWith("#EXTM3U")) {
        return res.status(502).send("ARY News stream did not return a playlist");
      }

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.status(streamResponse.status).send(rewritePlaylist(playlist, streamResponse.url || streamUrl, ARY_NEWS_LIVE_PAGE));
    } catch (error) {
      console.error("ARY News resolver failed:", error);
      return res.status(502).send("ARY News stream could not be resolved");
    }
  });

  // Simple Proxy Route to bypass CORS for IPTV streams
  app.get("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).send("URL is required");
    }

    if (!isHttpUrl(targetUrl)) {
      return res.status(400).send("Only http and https URLs are supported");
    }

    const controller = new AbortController();
    let timedOut = false;
    let clientClosed = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, PROXY_TIMEOUT_MS);

    try {
      res.on("close", () => {
        clientClosed = true;
        if (!res.writableEnded) {
          controller.abort();
        }
      });

      const referer = typeof req.query.referer === "string" && isHttpUrl(req.query.referer)
        ? req.query.referer
        : undefined;

      const headers: Record<string, string> = {
        "User-Agent": req.get("user-agent") || DEFAULT_USER_AGENT,
        "Accept": req.get("accept") || "*/*",
      };

      if (referer) headers.Referer = referer;

      const range = req.get("range");
      if (range) headers.Range = range;

      const response = await fetch(targetUrl, {
        method: "GET",
        headers,
        redirect: 'follow', // Follow 301/302 redirects common in IPTV
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      res.status(response.status);
      copyResponseHeaders(response, res);

      const contentType = response.headers.get("content-type");
      if (isPlaylistResponse(targetUrl, contentType)) {
        const playlist = await response.text();
        if (!playlist.trimStart().startsWith("#EXTM3U")) {
          return res.send(playlist);
        }

        const rewrittenPlaylist = rewritePlaylist(playlist, response.url || targetUrl, referer);
        res.setHeader("Content-Type", contentType || "application/vnd.apple.mpegurl");
        return res.send(rewrittenPlaylist);
      }

      if (!response.body) {
        return res.end();
      }

      const stream = Readable.fromWeb(response.body as any);
      stream.on("error", (error) => {
        if (!res.writableEnded) {
          res.end();
        }

        console.log("Proxy stream ended early:", error instanceof Error ? error.message : error);
      });
      stream.pipe(res);
    } catch (e) {
      clearTimeout(timeoutId);

      const errorName = e instanceof Error ? e.name : "";
      const causeCode = (e as { cause?: { code?: string } })?.cause?.code;

      if (clientClosed || errorName === "AbortError") {
        if (!timedOut) {
          return;
        }
      }

      if (timedOut || causeCode === "UND_ERR_CONNECT_TIMEOUT") {
        console.log(`Proxy timeout: ${targetUrl}`);
        if (!res.headersSent) {
          return res.status(504).send("Stream timed out");
        }
        return;
      }

      console.error('Proxy Error:', e);
      if (!res.headersSent) {
        res.status(502).send("Proxy failed to load stream");
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
