importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// Cache the anti-detection script text so we can inline it into HTML responses
// instead of referencing an external URL (which would be rewritten by Scramjet
// and could fail to load or leak the proxy origin).
let antiDetectCode = null;

async function loadAntiDetect() {
	if (antiDetectCode !== null) return antiDetectCode;
	try {
		const resp = await fetch("/anti-detect.js");
		if (resp.ok) {
			antiDetectCode = await resp.text();
		}
	} catch (e) {
		// non-critical — proxied pages will still work, just without anti-detect
	}
	if (antiDetectCode === null) antiDetectCode = "";
	return antiDetectCode;
}

function injectAntiDetect(html, code) {
	if (!code) return html;
	const tag = "<script>" + code + "</script>";
	// Inject right after <head> so it runs before the destination site's scripts.
	const headIdx = html.search(/<head[^>]*>/i);
	if (headIdx !== -1) {
		const insertAt = html.indexOf(">", headIdx) + 1;
		return html.slice(0, insertAt) + tag + html.slice(insertAt);
	}
	// No <head> — inject at the very start of the document.
	return tag + html;
}

async function handleRequest(event) {
	await scramjet.loadConfig();
	if (scramjet.route(event)) {
		const response = await scramjet.fetch(event);
		// Only patch HTML navigation responses.
		const contentType = response.headers.get("content-type") || "";
		if (contentType.includes("text/html") && response.body) {
			const code = await loadAntiDetect();
			if (code) {
				const html = await response.text();
				const patched = injectAntiDetect(html, code);
				return new Response(patched, {
					status: response.status,
					statusText: response.statusText,
					headers: response.headers,
				});
			}
		}
		return response;
	}
	return fetch(event.request);
}

self.addEventListener("fetch", (event) => {
	event.respondWith(handleRequest(event));
});
