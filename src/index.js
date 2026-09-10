import { createServer } from "node:http";
import { hostname } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { scramjetPath } from "@mercuryworkshop/scramjet/path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const publicPath = path.join(projectRoot, "public");
const controllerPath = path.resolve(
	projectRoot,
	"node_modules/@mercuryworkshop/scramjet-controller/dist"
);
const epoxyPath = path.resolve(
	projectRoot,
	"node_modules/@mercuryworkshop/epoxy-transport/dist"
);
const port = Number.parseInt(process.env.PORT || "8080", 10);

// This server is only a local development asset server. Browsing traffic is
// sent directly from the browser to the public Wisp endpoint in config.js.
const fastify = Fastify({
	logger: true,
	serverFactory: (handler) =>
		createServer((request, reply) => {
			reply.setHeader("Cross-Origin-Opener-Policy", "same-origin");
			reply.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
			reply.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
			handler(request, reply);
		}),
});

await fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
});

await fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scramjet/",
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: controllerPath,
	prefix: "/controller/",
	decorateReply: false,
});

await fastify.register(fastifyStatic, {
	root: epoxyPath,
	prefix: "/epoxy/",
	decorateReply: false,
});

fastify.get("/api/health", async () => ({
	status: "ok",
	mode: "client-side",
	environment: process.env.VERCEL === "1" ? "vercel" : "local",
}));

fastify.setNotFoundHandler((request, reply) =>
	reply.code(404).type("text/html").sendFile("404.html")
);

if (process.env.VERCEL !== "1") {
	try {
		await fastify.listen({
			port: Number.isFinite(port) ? port : 8080,
			host: "0.0.0.0",
		});
		const address = fastify.server.address();
		console.log("Listening on:");
		console.log(`\thttp://localhost:${address.port}`);
		console.log(`\thttp://${hostname()}:${address.port}`);
	} catch (error) {
		fastify.log.error(error, "Unable to start server");
		process.exit(1);
	}
}

export default fastify;
