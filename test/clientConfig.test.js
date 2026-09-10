import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import test from "node:test";

test("browser config exposes the required quick links and client transport", async () => {
	const source = await readFile(
		new URL("../public/config.js", import.meta.url),
		"utf8"
	);
	const context = createContext({ window: {} });

	new Script(source).runInContext(context);

	const config = context.window.SCRAMJET_APP_CONFIG;
	assert.deepEqual(
		Array.from(config.quickLinks, (quickLink) => quickLink.label),
		["Geforce Now", "TikTok", "Snapchat", "YouTube", "Quenq"]
	);
	assert.equal(config.transport.strategy, "round-robin");
	assert.equal(config.transport.selectEndpoint(), "wss://wisp.webmc.fun/");
	assert.equal(Object.isFrozen(config), true);
});
