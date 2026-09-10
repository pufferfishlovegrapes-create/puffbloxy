"use strict";
const stockSW = "./sw.js";

/**
 * List of hostnames that are allowed to run serviceworkers on http://
 */
const swAllowedHostnames = ["localhost", "127.0.0.1"];

/**
 * Global util
 * Used in 404.html and index.html
 */
async function registerSW() {
	if (!navigator.serviceWorker) {
		if (
			location.protocol !== "https:" &&
			!swAllowedHostnames.includes(location.hostname)
		)
			throw new Error("Service workers cannot be registered without https.");

		throw new Error("Your browser doesn't support service workers.");
	}

	const registration = await navigator.serviceWorker.register(stockSW, {
		updateViaCache: "none",
	});
	await navigator.serviceWorker.ready;
	if (!navigator.serviceWorker.controller) {
		await new Promise((resolve) => {
			const timeout = setTimeout(resolve, 1500);
			navigator.serviceWorker.addEventListener(
				"controllerchange",
				() => {
					clearTimeout(timeout);
					resolve();
				},
				{ once: true }
			);
		});
	}
	if (!navigator.serviceWorker.controller) {
		throw new Error(
			"The service worker was installed but did not take control of this page. Refresh once to activate it."
		);
	}
	return registration;
}
