<h1 align="center">PuffBlox</h1>

PuffBlox is a minimal, single-destination proxy built on top of [Scramjet](https://github.com/MercuryWorkshop/scramjet) and the [Wisp](https://www.npmjs.com/package/@mercuryworkshop/wisp-js) WebSocket transport.

When a visitor opens the site, PuffBlox automatically boots the Scramjet service worker and loads a **configurable destination URL** as a fullscreen experience — no search bar, no URL input, no tabs. The destination defaults to the EasyFun Roblox cloud-games page and is validated against an explicit hostname allowlist.

> The Scramjet interception proxy, the Wisp transport, the service worker, and the Node.js backend are all preserved from the original Scramjet-Demo. Only the user-facing shell was simplified into a single-destination launcher.

---

## Requirements

- Node.js 18+ (the repo also works with Node 16, but 18 is recommended)
- npm 7+ (a `package-lock.json` is included; `pnpm` is also supported via `pnpm-lock.yaml`)

## Quick start

```bash
npm install
npm start
```

Then open `http://localhost:8080` in a browser. The configured destination loads automatically and fills the viewport.

> **HTTPS / service workers:** Browsers only allow service workers on `https://` or on `localhost` / `127.0.0.1`. For any other hostname you must serve PuffBlox over HTTPS (e.g. behind nginx + Let's Encrypt, or a reverse proxy).

## Configuration

All configuration is via environment variables.

| Variable           | Default                                                | Description                                                                                                                            |
| ------------------ | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`             | `8080`                                                 | Port the HTTP server listens on.                                                                                                       |
| `DESTINATION_URL`  | `https://www.easyfun.gg/cloud-games/roblox.html`       | The URL the proxy auto-loads. Must be `http(s)` and its hostname **must** be in the allowlist below, otherwise the server refuses to start. |

### Destination allowlist

The destination hostname is validated at startup against an explicit allowlist defined in `src/index.js`:

```js
const ALLOWED_HOSTNAMES = [
	"www.easyfun.gg",
	"easyfun.gg",
];
```

To allow a different destination, add its hostname to `ALLOWED_HOSTNAMES` **and** set `DESTINATION_URL`. If `DESTINATION_URL` points at a hostname not in the list, the server exits with an error rather than silently proxying an arbitrary origin. This is intentional: PuffBlox is a single-destination launcher, not a general-purpose open proxy.

## How it works

1. **Backend** (`src/index.js`) — a Fastify HTTP server serves the static frontend, the Scramjet runtime (`/scram/`), the libcurl transport (`/libcurl/`), the Bare-Mux bundle (`/baremux/`), and a dynamic `/config.js` containing the allowlist-validated destination. The same HTTP server upgrades `/wisp/` WebSocket connections to the Wisp transport.

2. **Service worker** (`public/sw.js`) — registers Scramjet's service worker, which intercepts and rewrites proxied requests.

3. **Frontend** (`public/index.js`) — on load it initializes Scramjet, registers the service worker, sets the libcurl transport to use the Wisp endpoint, creates a single Scramjet frame, and navigates it to the configured destination. A loading screen is shown until the frame loads, then removed.

### Wisp endpoint

The Wisp WebSocket endpoint is served at:

```
ws://<your-host>:<port>/wisp/      # or wss:// under HTTPS
```

The frontend computes this automatically from the current `location`, so no manual configuration is needed.

## Deploy

### Docker

```bash
docker build -t puffblox:latest .
docker run -p 8080:8080 -e DESTINATION_URL=https://www.easyfun.gg/cloud-games/roblox.html puffblox:latest
```

Or with docker-compose:

```bash
docker compose up -d
```

### Plain Node.js host

```bash
npm install --omit=dev
DESTINATION_URL=https://www.easyfun.gg/cloud-games/roblox.html PORT=8080 npm start
```

For production, put PuffBlox behind an HTTPS reverse proxy (nginx, Caddy, etc.) that terminates TLS and forwards to `localhost:8080`, and upgrades `/wisp/` WebSocket connections.

## Project layout

```
src/index.js          Fastify server: static assets, /scram /libcurl /baremux, /wisp upgrade, /config.js
public/index.html     Minimal shell — no search bar, just a loading screen
public/index.js       Auto-init Scramjet + Wisp, create fullscreen frame, navigate to destination
public/sw.js          Scramjet service worker
public/register-sw.js Service-worker registration helper
public/index.css      Loading screen + fullscreen frame styling
```

## Credits

Built on [Scramjet](https://github.com/MercuryWorkshop/scramjet) by Mercury Workshop (GNU AGPL). See `public/credits.html` for full license text.
