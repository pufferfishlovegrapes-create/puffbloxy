import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptsDirectory, "..");

const assets = [
	["node_modules/@mercuryworkshop/scramjet/dist", "public/scramjet"],
	[
		"node_modules/@mercuryworkshop/scramjet-controller/dist",
		"public/controller",
	],
	[
		"node_modules/@mercuryworkshop/epoxy-transport/dist/index.js",
		"public/epoxy/index.js",
	],
];

await Promise.all(
	assets.map(([source, destination]) =>
		(async () => {
			const target = path.join(projectRoot, destination);
			await mkdir(path.dirname(target), { recursive: true });
			return cp(path.join(projectRoot, source), target, {
				recursive: true,
				force: true,
			});
		})()
	)
);

console.log("Static browser assets prepared for Vercel.");
