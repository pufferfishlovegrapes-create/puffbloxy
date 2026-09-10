"use strict";

const appConfig = window.SCRAMJET_APP_CONFIG || {
	defaultSettings: { showBlockedImage: false, enableKonamiShortcut: false },
	quickLinks: [],
	transport: {
		endpoints: [],
		selectEndpoint: () => {
			throw new Error("No Wisp transport endpoints are configured.");
		},
	},
};
const storageKey = "classroom-browser-settings";
const konamiSequence = [
	"ArrowUp",
	"ArrowUp",
	"ArrowDown",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"ArrowLeft",
	"ArrowRight",
	"b",
	"a",
];

const form = document.getElementById("sj-form");
const address = document.getElementById("sj-address");
const searchEngine = document.getElementById("sj-search-engine");
const tabList = document.getElementById("tab-list");
const homeView = document.getElementById("home-view");
const browserContent = document.getElementById("browser-content");
const browserStatus = document.getElementById("browser-status");
const backButton = document.getElementById("back-button");
const forwardButton = document.getElementById("forward-button");
const reloadButton = document.getElementById("reload-button");
const newTabButton = document.getElementById("new-tab");
const quickLinksToggle = document.getElementById("quick-links-toggle");
const quickLinksMenu = document.getElementById("quick-links-menu");
const settingsButton = document.getElementById("settings-button");
const settingsDialog = document.getElementById("settings-dialog");
const settingsClose = document.getElementById("settings-close");
const konamiSetting = document.getElementById("konami-setting");
const restrictionOverlay = document.getElementById("restriction-overlay");
const blockedDismiss = document.getElementById("blocked-dismiss");

const { Controller } = $scramjetController;
let controller = null;
let transport = null;
const state = {
	tabs: [],
	activeTabId: null,
	transportReady: false,
	transportEndpoint: null,
	transportPromise: null,
	serviceWorkerReady: false,
	settings: loadSettings(),
	konamiIndex: 0,
	konamiTimer: null,
};

function toBoolean(value, fallback = false) {
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		if (["true", "1", "yes", "on"].includes(value.toLowerCase())) return true;
		if (["false", "0", "no", "off"].includes(value.toLowerCase())) return false;
	}
	return fallback;
}

function loadSettings() {
	const defaults = {
		showBlockedImage: toBoolean(appConfig.defaultSettings?.showBlockedImage),
		enableKonamiShortcut: toBoolean(
			appConfig.defaultSettings?.enableKonamiShortcut
		),
	};
	let stored = {};

	try {
		stored = JSON.parse(localStorage.getItem(storageKey) || "{}") || {};
	} catch {
		stored = {};
	}

	return {
		// This flag is intentionally code-only. localStorage cannot override it.
		showBlockedImage: defaults.showBlockedImage,
		enableKonamiShortcut: toBoolean(
			stored.enableKonamiShortcut,
			defaults.enableKonamiShortcut
		),
	};
}

function saveSettings() {
	try {
		localStorage.setItem(
			storageKey,
			JSON.stringify({
				enableKonamiShortcut: state.settings.enableKonamiShortcut,
			})
		);
	} catch (error) {
		console.warn("Unable to save browser settings.", error);
	}
}

function getActiveTab() {
	return state.tabs.find((tab) => tab.id === state.activeTabId) || null;
}

function createId() {
	return (
		globalThis.crypto?.randomUUID?.() ||
		"tab-" + Date.now() + "-" + Math.random()
	);
}

function getTitleForUrl(url) {
	if (!url) return "New tab";
	try {
		return new URL(url).hostname.replace(/^www\./, "") || "New tab";
	} catch {
		return "New tab";
	}
}

function setStatus(message) {
	browserStatus.textContent = message;
}

function setTabUrl(tab, url) {
	tab.activeUrl = url;
	// Keep url as a small compatibility alias for integrations that inspect tabs.
	tab.url = url;
}

function createTab() {
	const history = [];
	const tab = {
		id: createId(),
		title: "New tab",
		activeUrl: "",
		url: "",
		history,
		historyStack: history,
		historyIndex: -1,
		frame: null,
	};
	state.tabs.push(tab);
	selectTab(tab.id);
	return tab;
}

function selectTab(tabId) {
	const tab = state.tabs.find((candidate) => candidate.id === tabId);
	if (!tab) return;

	state.activeTabId = tabId;
	for (const candidate of state.tabs) {
		if (candidate.frame)
			candidate.frame.element.hidden = candidate.id !== tabId;
	}

	homeView.hidden = Boolean(tab.frame);
	address.value = tab.activeUrl;
	document.title = tab.title + " - Classroom";
	setStatus(tab.frame ? "" : "Ready");
	renderTabs();
	updateNavigationControls();
}

function closeTab(tabId) {
	const index = state.tabs.findIndex((tab) => tab.id === tabId);
	if (index === -1) return;

	const [tab] = state.tabs.splice(index, 1);
	if (tab.frame) tab.frame.element.remove();

	if (state.tabs.length === 0) {
		state.activeTabId = null;
		createTab();
		return;
	}

	if (state.activeTabId === tabId) {
		selectTab(state.tabs[Math.min(index, state.tabs.length - 1)].id);
	} else {
		renderTabs();
		updateNavigationControls();
	}
}

function renderTabs() {
	tabList.replaceChildren();
	for (const tab of state.tabs) {
		const tabButton = document.createElement("button");
		tabButton.className =
			"tab" + (tab.id === state.activeTabId ? " active" : "");
		tabButton.type = "button";
		tabButton.role = "tab";
		tabButton.ariaSelected = String(tab.id === state.activeTabId);
		tabButton.dataset.tabId = tab.id;
		tabButton.title = tab.title;

		const title = document.createElement("span");
		title.className = "tab-title";
		title.textContent = tab.title;

		const close = document.createElement("span");
		close.className = "tab-close";
		close.dataset.closeTab = tab.id;
		close.setAttribute("aria-label", "Close " + tab.title);
		close.textContent = "x";

		tabButton.append(title, close);
		tabList.append(tabButton);
	}
}

function updateNavigationControls() {
	const tab = getActiveTab();
	backButton.disabled = !tab || tab.historyIndex <= 0;
	forwardButton.disabled = !tab || tab.historyIndex >= tab.history.length - 1;
	reloadButton.disabled = !tab?.activeUrl;
}

function getTransportConfig() {
	return appConfig.transport || appConfig.wisp || { endpoints: [] };
}

function probeWispEndpoint(endpoint) {
	return new Promise((resolve, reject) => {
		let settled = false;
		let socket;
		const timeout = setTimeout(
			() => finish(reject, new Error("Wisp endpoint timed out.")),
			5000
		);
		const finish = (callback, value) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			try {
				socket?.close();
			} catch {
				// The socket may already be closed.
			}
			callback(value);
		};
		try {
			socket = new WebSocket(endpoint);
			socket.addEventListener("open", () => finish(resolve));
			socket.addEventListener("error", () =>
				finish(reject, new Error("Wisp endpoint refused the connection."))
			);
		} catch (error) {
			finish(reject, error);
		}
	});
}

async function ensureTransport() {
	if (state.transportReady) return;
	if (!state.transportPromise) {
		state.transportPromise = initializeTransport().finally(() => {
			if (!state.transportReady) state.transportPromise = null;
		});
	}
	return state.transportPromise;
}

async function initializeTransport() {
	if (state.transportReady) return;
	if (!state.serviceWorkerReady) {
		await registerSW();
		state.serviceWorkerReady = true;
	}
	const serviceWorker = navigator.serviceWorker.controller;
	if (!serviceWorker) {
		throw new Error(
			"The browser service worker is not controlling this page yet. Refresh once and try again."
		);
	}

	const transportConfig = getTransportConfig();
	const endpoints = Array.isArray(transportConfig.endpoints)
		? transportConfig.endpoints
		: [];
	if (
		endpoints.length === 0 ||
		typeof transportConfig.selectEndpoint !== "function"
	) {
		throw new Error("No client-side Wisp endpoints are configured.");
	}

	let lastError;
	for (let attempt = 0; attempt < endpoints.length; attempt += 1) {
		const endpoint = transportConfig.selectEndpoint();
		try {
			await probeWispEndpoint(endpoint);
			const transportModule = window.EpoxyTransport;
			const EpoxyTransport =
				transportModule?.default ||
				transportModule?.EpoxyTransport ||
				transportModule;
			if (typeof EpoxyTransport !== "function") {
				throw new Error("The Scramjet v2 transport bundle did not load.");
			}
			transport = new EpoxyTransport({ wisp: endpoint, wisp_v2: true });
			if (typeof transport.init === "function") await transport.init();
			controller = new Controller({
				serviceworker: serviceWorker,
				transport,
				config: {
					prefix: "/proxy/",
					scramjetPath: "/scramjet/scramjet.js",
					injectPath: "/controller/controller.inject.js",
					wasmPath: "/scramjet/scramjet.wasm",
					virtualWasmPath: "scramjet.wasm.js",
				},
			});
			await controller.wait();
			state.transportEndpoint = endpoint;
			state.transportReady = true;
			return;
		} catch (error) {
			lastError = error;
			console.warn("Unable to use Wisp endpoint " + endpoint + ".", error);
		}
	}

	throw (
		lastError || new Error("Unable to initialize the client-side transport.")
	);
}

async function navigateTo(url, options = {}) {
	const tab = getActiveTab();
	if (!tab) return;

	try {
		setStatus("Connecting...");
		await ensureTransport();

		if (!tab.frame) {
			const frameElement = document.createElement("iframe");
			tab.frame = controller.createFrame(frameElement);
			tab.frame.element.className = "browser-frame";
			tab.frame.element.id = "sj-frame-" + tab.id;
			browserContent.appendChild(tab.frame.element);
		}

		if (options.historyIndex == null) {
			tab.history.splice(tab.historyIndex + 1);
			tab.history.push(url);
			tab.historyIndex = tab.history.length - 1;
		} else if (
			options.historyIndex >= 0 &&
			options.historyIndex < tab.history.length
		) {
			tab.historyIndex = options.historyIndex;
		}

		setTabUrl(tab, url);
		tab.title = getTitleForUrl(url);
		tab.frame.element.hidden = false;
		homeView.hidden = true;
		address.value = tab.activeUrl;
		tab.frame.go(url);
		setStatus("");
		document.title = tab.title + " - Classroom";
		renderTabs();
		updateNavigationControls();
	} catch (error) {
		setStatus(
			"Could not open that page. Check the configured public Wisp endpoint."
		);
		console.error(error);
	}
}

function goBack() {
	const tab = getActiveTab();
	if (tab && tab.historyIndex > 0) {
		navigateTo(tab.history[tab.historyIndex - 1], {
			historyIndex: tab.historyIndex - 1,
		});
	}
}

function goForward() {
	const tab = getActiveTab();
	if (tab && tab.historyIndex < tab.history.length - 1) {
		navigateTo(tab.history[tab.historyIndex + 1], {
			historyIndex: tab.historyIndex + 1,
		});
	}
}

function reload() {
	const tab = getActiveTab();
	if (tab?.activeUrl)
		navigateTo(tab.activeUrl, { historyIndex: tab.historyIndex });
}

function closeQuickLinksMenu() {
	quickLinksMenu.hidden = true;
	quickLinksToggle.setAttribute("aria-expanded", "false");
}

function renderQuickLinks() {
	quickLinksMenu.replaceChildren();
	for (const quickLink of appConfig.quickLinks || []) {
		if (!quickLink?.label || !quickLink?.url) continue;
		const link = document.createElement("a");
		link.href = quickLink.url;
		link.textContent = quickLink.label;
		link.dataset.quickLink = quickLink.label;
		link.addEventListener("click", (event) => {
			event.preventDefault();
			closeQuickLinksMenu();
			navigateTo(quickLink.url);
		});
		quickLinksMenu.append(link);
	}
}

function applySettings() {
	state.settings.showBlockedImage = toBoolean(state.settings.showBlockedImage);
	state.settings.enableKonamiShortcut = toBoolean(
		state.settings.enableKonamiShortcut
	);
	konamiSetting.checked = state.settings.enableKonamiShortcut;

	const showOverlay = toBoolean(appConfig.defaultSettings?.showBlockedImage);
	restrictionOverlay.hidden = !showOverlay;
	restrictionOverlay.setAttribute("aria-hidden", String(!showOverlay));
	if (!showOverlay) resetKonamiSequence();
}

function dismissBlockedScreen() {
	if (restrictionOverlay.hidden) return;
	restrictionOverlay.hidden = true;
	restrictionOverlay.setAttribute("aria-hidden", "true");
	resetKonamiSequence();
}

function resetKonamiSequence() {
	state.konamiIndex = 0;
	clearTimeout(state.konamiTimer);
	state.konamiTimer = null;
}

tabList.addEventListener("click", (event) => {
	const closeTarget = event.target.closest("[data-close-tab]");
	if (closeTarget) {
		closeTab(closeTarget.dataset.closeTab);
		return;
	}

	const tabTarget = event.target.closest("[data-tab-id]");
	if (tabTarget) selectTab(tabTarget.dataset.tabId);
});

form.addEventListener("submit", (event) => {
	event.preventDefault();
	const input = address.value.trim();
	if (!input) return;
	navigateTo(search(input, searchEngine.value));
});

backButton.addEventListener("click", goBack);
forwardButton.addEventListener("click", goForward);
reloadButton.addEventListener("click", reload);
newTabButton.addEventListener("click", createTab);

quickLinksToggle.addEventListener("click", () => {
	const isOpen = !quickLinksMenu.hidden;
	quickLinksMenu.hidden = isOpen;
	quickLinksToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.addEventListener("click", (event) => {
	if (!event.target.closest(".quick-links-control")) closeQuickLinksMenu();
});

settingsButton.addEventListener("click", () => {
	if (!settingsDialog.open) settingsDialog.showModal();
});
settingsClose.addEventListener("click", () => settingsDialog.close());
settingsDialog.addEventListener("click", (event) => {
	if (event.target === settingsDialog) settingsDialog.close();
});

konamiSetting.addEventListener("change", () => {
	state.settings.enableKonamiShortcut = konamiSetting.checked === true;
	saveSettings();
	applySettings();
});

blockedDismiss.addEventListener("click", dismissBlockedScreen);

document.addEventListener("keyup", (event) => {
	if (event.ctrlKey && event.key.toLowerCase() === "l") {
		event.preventDefault();
		address.focus();
		address.select();
		return;
	}

	if (!state.settings.enableKonamiShortcut || restrictionOverlay.hidden) {
		resetKonamiSequence();
		return;
	}

	const expectedKey = konamiSequence[state.konamiIndex];
	const pressedKey = event.key.toLowerCase();
	const normalizedExpectedKey = expectedKey.toLowerCase();
	if (pressedKey === normalizedExpectedKey) {
		state.konamiIndex += 1;
		if (state.konamiIndex === konamiSequence.length) {
			dismissBlockedScreen();
			return;
		}
	} else {
		state.konamiIndex = pressedKey === konamiSequence[0].toLowerCase() ? 1 : 0;
	}

	clearTimeout(state.konamiTimer);
	state.konamiTimer = setTimeout(resetKonamiSequence, 2500);
});

window.dismissRestrictionOverlay = dismissBlockedScreen;
renderQuickLinks();
applySettings();
createTab();

// Warm the service worker, Scramjet WASM, and transport while the new-tab
// screen is visible so the first search does not pay the initialization cost.
setTimeout(() => {
	ensureTransport().catch((error) => {
		console.warn("Background transport warm-up failed.", error);
	});
}, 0);
