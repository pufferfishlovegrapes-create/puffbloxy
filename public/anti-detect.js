"use strict";

// PuffBlox anti-detection script — injected into every proxied HTML document.
// Runs inside the proxied page's window context (via Scramjet's JS realm)
// before the destination site's own scripts execute. It patches the browser
// fingerprint surfaces that reveal the user is behind a proxy/VPN.

(function () {
	// 1. Block WebRTC IP leaks.
	// RTCPeerConnection can enumerate local network interfaces and expose the
	// user's real public IP via STUN, completely bypassing the HTTP proxy.
	// Scramjet does not intercept WebRTC, so we neutralise it here.
	try {
		if (window.RTCPeerConnection) {
		 window.RTCPeerConnection = undefined;
		}
		if (window.webkitRTCPeerConnection) {
			window.webkitRTCPeerConnection = undefined;
		}
		if (window.mozRTCPeerConnection) {
			window.mozRTCPeerConnection = undefined;
		}
		if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
			// Leave getUserMedia functional but it will fail without RTCPeerConnection
			// for IP enumeration purposes.
		}
	} catch (e) {
		// ignore
	}

	// 2. Mask navigator.webdriver.
	// Selenium/Puppeteer set this to true; some anti-bot systems treat any
	// non-undefined value as a signal even if false, so we delete it cleanly.
	try {
		if ("webdriver" in navigator) {
			Object.defineProperty(navigator, "webdriver", {
				get: () => undefined,
				configurable: true,
			});
		}
	} catch (e) {
		// ignore
	}

	// 3. Normalize navigator.plugins and mimeTypes.
	// Headless/automated browsers report empty plugin arrays. We present a
	// typical Chrome-like plugin list so the fingerprint looks ordinary.
	try {
		const fakePlugins = [
			{ name: "PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
			{ name: "Chrome PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
			{ name: "Chromium PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
			{ name: "Microsoft Edge PDF Viewer", filename: "internal-pdf-viewer", description: "Portable Document Format" },
			{ name: "WebKit built-in PDF", filename: "internal-pdf-viewer", description: "Portable Document Format" },
		];
		const pluginArray = fakePlugins.map((p) => {
			const obj = Object.create(Plugin.prototype);
			Object.defineProperties(obj, {
				name: { value: p.name, enumerable: true },
				filename: { value: p.filename, enumerable: true },
				description: { value: p.description, enumerable: true },
				length: { value: 0, enumerable: true },
			});
			return obj;
		});
		Object.defineProperty(navigator, "plugins", {
			get: () => {
				const arr = pluginArray;
				arr.item = (i) => arr[i] || null;
				arr.namedItem = (n) => arr.find((p) => p.name === n) || null;
				arr.refresh = () => {};
				return arr;
			},
			configurable: true,
		});
	} catch (e) {
		// ignore
	}

	// 4. Spoof navigator.languages to a common US English default.
	// Unusual language combinations can flag a proxy user.
	try {
		Object.defineProperty(navigator, "languages", {
			get: () => ["en-US", "en"],
			configurable: true,
		});
	} catch (e) {
		// ignore
	}

	// 5. Hide the Proxy/VPN detection via window.chrome.
	// Real Chrome exposes window.chrome as an object; headless browsers or
	// other browsers may expose it differently or not at all.
	try {
		if (!window.chrome) {
			window.chrome = {
				runtime: {},
				loadTimes: function () {},
				csi: function () {},
				app: {},
			};
		}
	} catch (e) {
		// ignore
	}

	// 6. Mask hardware concurrency and device memory to common values.
	// Extreme values (1 core, very low memory) can indicate a VPS.
	try {
		Object.defineProperty(navigator, "hardwareConcurrency", {
			get: () => 8,
			configurable: true,
		});
	} catch (e) {
		// ignore
	}
	try {
		Object.defineProperty(navigator, "deviceMemory", {
			get: () => 8,
			configurable: true,
		});
	} catch (e) {
		// ignore
	}

	// 7. Prevent WebRTC leak via iframe/contentWindow access.
	// Some sites create hidden iframes and use their RTCPeerConnection.
	// The patch above already removes the global, but we also intercept
	// iframe creation to patch subframes.
	try {
		const origContentWindow = Object.getOwnPropertyDescriptor(
			HTMLIFrameElement.prototype,
			"contentWindow",
		);
		if (origContentWindow && origContentWindow.get) {
			const origGet = origContentWindow.get;
			Object.defineProperty(HTMLIFrameElement.prototype, "contentWindow", {
				get: function () {
					const w = origGet.call(this);
					try {
						if (w) {
							w.RTCPeerConnection = undefined;
							w.webkitRTCPeerConnection = undefined;
						}
					} catch (e) {
						// cross-origin iframe — can't patch, that's fine
					}
					return w;
				},
				configurable: true,
			});
		}
	} catch (e) {
		// ignore
	}
})();
