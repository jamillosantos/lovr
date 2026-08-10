// Base URL of the lovr API. Empty means same origin (the UI is being served
// by `lovr web` itself). During development, point it at the running backend:
//   BUN_PUBLIC_API_URL=http://127.0.0.1:8080 bun dev
// Bun inlines process.env.BUN_PUBLIC_* only when the variable is set; when it
// is not, this read hits the browser at runtime, where index.html shims a
// minimal `process` global so it safely falls back to "".
export const API_BASE = process.env.BUN_PUBLIC_API_URL ?? "";

export function wsURL(path: string): string {
	let raw = API_BASE || window.location.origin;
	if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) {
		raw = `http://${raw}`;
	}
	const base = new URL(raw);
	const proto = base.protocol === "https:" ? "wss:" : "ws:";
	const prefix = base.pathname.replace(/\/+$/, "");
	return `${proto}//${base.host}${prefix}${path}`;
}
