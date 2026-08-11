import type { TimeRange } from "@/lib/timerange.ts";

// A saved view: the filter (query + time range), the visible columns and
// their widths. Stored in localStorage.
export interface View {
	name: string;
	q: string;
	range: TimeRange;
	cols: string[];
	columnWidths: Record<string, number>;
}

const STORAGE_KEY = "lovr-views";

export function sanitizeViews(raw: unknown): View[] {
	if (!Array.isArray(raw)) {
		return [];
	}
	const views: View[] = [];
	for (const item of raw) {
		if (typeof item !== "object" || item === null) {
			continue;
		}
		const v = item as Record<string, unknown>;
		if (typeof v.name !== "string" || v.name.trim() === "") {
			continue;
		}
		const cols = Array.isArray(v.cols)
			? v.cols.filter((c): c is string => typeof c === "string")
			: [];
		if (cols.length === 0) {
			continue;
		}
		const widths: Record<string, number> = {};
		if (typeof v.columnWidths === "object" && v.columnWidths !== null) {
			for (const [k, w] of Object.entries(
				v.columnWidths as Record<string, unknown>,
			)) {
				if (typeof w === "number" && Number.isFinite(w) && w >= 20) {
					widths[k] = w;
				}
			}
		}
		let range: TimeRange = null;
		if (typeof v.range === "object" && v.range !== null) {
			const r = v.range as Record<string, unknown>;
			if (typeof r.preset === "string") {
				range = { preset: r.preset };
			} else if (typeof r.from === "string") {
				range = {
					from: r.from,
					to: typeof r.to === "string" ? r.to : undefined,
				};
			}
		}
		views.push({
			name: v.name.trim(),
			q: typeof v.q === "string" ? v.q : "",
			range,
			cols,
			columnWidths: widths,
		});
	}
	return views.sort((a, b) => a.name.localeCompare(b.name));
}

export function loadViews(): View[] {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? sanitizeViews(JSON.parse(raw)) : [];
	} catch {
		return [];
	}
}

export function persistViews(views: View[]) {
	localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
}

// upsertView replaces a view with the same name (case-insensitive) and keeps
// the list sorted.
export function upsertView(views: View[], view: View): View[] {
	const next = views.filter(
		(v) => v.name.toLowerCase() !== view.name.toLowerCase(),
	);
	next.push(view);
	return next.sort((a, b) => a.name.localeCompare(b.name));
}

export function removeView(views: View[], name: string): View[] {
	return views.filter((v) => v.name !== name);
}
