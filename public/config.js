// This file is a fallback. In production the server serves a generated
// /config.js (see src/index.js) containing the allowlist-validated destination.
// The value below is only used if the static file is served instead of the
// dynamic route (e.g. when opening public/ directly without the backend).
window.__PUFFPROXY__ = window.__PUFFPROXY__ || {
	destination: "https://www.easyfun.gg/cloud-games/roblox.html",
};
