import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// PuffProxy configuration -------------------------------------------------

const DEFAULT_DESTINATION = "https://www.easyfun.gg/cloud-games/roblox.html";

// Hostnames the operator permits PuffProxy to auto-load. Any value supplied
// via DESTINATION_URL whose hostname is not in this list is rejected at
// startup, so an operator (or attacker who controls the env) cannot point the
// proxy at an arbitrary origin. Add more hostnames here to allow them.
const ALLOWED_HOSTNAMES = [
	"www.easyfun.gg",
	"easyfun.gg",
];

function resolveDestination() {
	const raw = (process.env.DESTINATION_URL || DEFAULT_DESTINATION).trim();
	let parsed;
	try {
		parsed = new URL(raw);
	} catch {
		throw new Error(
			`DESTINATION_URL is not a valid URL: ${JSON.stringify(raw)}`,
		);
	}
	if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
		throw new Error(
			`DESTINATION_URL must be http(s): protocol is ${parsed.protocol}`,
		);
	}
	if (!ALLOWED_HOSTNAMES.includes(parsed.hostname)) {
		throw new Error(
			`DESTINATION_URL hostname ${parsed.hostname} is not in the allowlist ` +
				`(${ALLOWED_HOSTNAMES.join(", ")}). Add it to ALLOWED_HOSTNAMES ` +
				`in src/index.js to permit it.`,
		);
	}
	return parsed.toString();
}

const destinationUrl = resolveDestination();

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

logging.set_level(logging.NONE);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	hostname_blacklist: [/example\.com/],
	dns_servers: ["1.1.1.3", "1.0.0.3"],
});

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				if (req.url.endsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
});

// Serve validated runtime config to the frontend. Computed once from the
// allowlist-checked destination so the browser never receives an arbitrary URL.
fastify.get("/config.js", async (_req, reply) => {
	const body = `window.__PUFFPROXY__ = ${JSON.stringify({
		destination: destinationUrl,
	})};\n`;
	return reply
		.code(200)
		.type("application/javascript; charset=utf-8")
		.send(body);
});

fastify.setNotFoundHandler((_req, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("PuffProxy listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`,
	);
	console.log(`\tDestination: ${destinationUrl}`);
	console.log(`\tWisp endpoint: ws://<host>:${address.port}/wisp/`);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
