#!/usr/bin/env bun
import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import plugin from "bun-plugin-tailwind";

const outdir = path.join(process.cwd(), "dist");

if (existsSync(outdir)) {
	console.log(`🗑️ Cleaning previous build at ${outdir}`);
	await rm(outdir, { recursive: true, force: true });
}

// Recreate dist/.gitkeep right away (not after the build) so a failed build
// can't leave the tree without a dist/, which would break go:embed and with
// it every plain `go build` in the module.
await Bun.write(path.join(outdir, ".gitkeep"), "");

const start = performance.now();

const entrypoints = [...new Bun.Glob("**.html").scanSync("src")]
	.map((a) => path.resolve("src", a))
	.filter((dir) => !dir.includes("node_modules"));

const result = await Bun.build({
	entrypoints,
	outdir,
	plugins: [plugin],
	minify: true,
	target: "browser",
	sourcemap: "none",
	define: {
		"process.env.NODE_ENV": JSON.stringify("production"),
		"process.env.BUN_PUBLIC_API_URL": JSON.stringify(
			process.env.BUN_PUBLIC_API_URL ?? "",
		),
	},
});

const outputTable = result.outputs.map((output) => ({
	File: path.relative(process.cwd(), output.path),
	Type: output.kind,
	Size: `${(output.size / 1024).toFixed(2)} KB`,
}));

console.table(outputTable);
console.log(`\n✅ Build completed in ${(performance.now() - start).toFixed(2)}ms\n`);
