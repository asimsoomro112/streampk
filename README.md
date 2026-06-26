# StreamPK

StreamPK is a React/Vite IPTV web app with a local Express proxy for HLS streams. It is tuned for desktop browsers and Android TV boxes with remote-friendly focus controls.

## Requirements

- Node.js 20+

## Run Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the app:
   ```bash
   npm run dev
   ```

3. Open:
   ```text
   http://localhost:3000
   ```

## Production Build

```bash
npm run build
npm start
```

## Deploy To Vercel

Import the GitHub repository in Vercel and keep these settings:

- Framework Preset: Vite
- Build Command: `npm run vercel-build`
- Output Directory: `dist`

The Vercel deployment uses serverless functions in `api/` for the HLS proxy and ARY News resolver.

## Notes

- The app uses public IPTV playlists, so some channel sources may be offline or geo/network blocked.
- HLS playlists and media segments are proxied through `/api/proxy` to avoid browser CORS failures.
- Player controls support mouse/touch and TV remote focus navigation.
