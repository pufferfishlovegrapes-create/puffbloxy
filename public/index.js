"use strict";

const errorEl = document.getElementById("sj-error");
const errorCodeEl = document.getElementById("sj-error-code");
const loadingEl = document.getElementById("sj-loading");

function showError(message, detail) {
	errorEl.textContent = message;
	if (detail) errorCodeEl.textContent = String(detail);
}

const { ScramjetController } = $scramjetLoadController();

const scramjet = new ScramjetController({
	files: {
		wasm: "/scram/scramjet.wasm.wasm",
		all: "/scram/scramjet.all.js",
		sync: "/scram/scramjet.sync.js",
	},
});

const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

function buildWispUrl() {
	return (
		(location.protocol === "https:" ? "wss" : "ws") +
		"://" +
		location.host +
		"/wisp/"
	);
}

async function boot() {
	const destination =
		window.__PUFFBLOX__ && window.__PUFFBLOX__.destination;

	if (!destination) {
		showError("Configuration failed to load. /config.js did not provide a destination.");
		return;
	}

	try {
		await scramjet.init();
	} catch (err) {
		showError("Failed to initialize the proxy engine.", err);
		throw err;
	}

	try {
		await registerSW();
	} catch (err) {
		showError("Failed to register the service worker.", err);
		throw err;
	}

	const wispUrl = buildWispUrl();
	try {
		if ((await connection.getTransport()) !== "/libcurl/index.mjs") {
			await connection.setTransport("/libcurl/index.mjs", [
				{ websocket: wispUrl },
			]);
		}
	} catch (err) {
		showError("Failed to connect to the Wisp transport.", err);
		throw err;
	}

	const frame = scramjet.createFrame();
	frame.frame.id = "sj-frame";
	document.body.appendChild(frame.frame);

	frame.frame.addEventListener("load", () => {
		if (loadingEl) loadingEl.remove();
	});

	frame.go(destination);
}

boot().catch((err) => {
	// boot() already surfaced a user-facing message via showError; keep the
	// console trace for debugging without spamming the UI.
	console.error(err);
});
