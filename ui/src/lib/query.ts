// Builds a fielded term for the bluge query string syntax, quoting values
// that would otherwise break tokenization.
export function fieldTerm(key: string, value: unknown): string {
	const raw = String(value);
	const safe = /^[\w./-]+$/.test(raw) ? raw : `"${raw.replaceAll('"', '\\"')}"`;
	return `${key}:${safe}`;
}

// Appends a term to an existing query, keeping it readable.
export function appendTerm(query: string, term: string): string {
	const trimmed = query.trim();
	return trimmed ? `${trimmed} ${term}` : term;
}

import {
	rangeFromParams,
	rangeToParams,
	type TimeRange,
} from "@/lib/timerange.ts";

export const DEFAULT_COLUMNS = ["timestamp", "level", "message"];

// The application state persisted in the URL.
export interface URLState {
	q: string;
	cols: string[];
	range: TimeRange;
}

export function stateFromSearch(search: string): URLState {
	const params = new URLSearchParams(search);
	const cols = params.get("cols");
	return {
		q: params.get("q") ?? "",
		cols: cols ? cols.split(",").filter(Boolean) : [...DEFAULT_COLUMNS],
		range: rangeFromParams(params),
	};
}

// Builds the URL that persists the state, dropping parameters at their
// defaults.
export function stateURL(pathname: string, state: URLState): string {
	const params = new URLSearchParams();
	const q = state.q.trim();
	if (q) {
		params.set("q", q);
	}
	if (state.cols.join(",") !== DEFAULT_COLUMNS.join(",")) {
		params.set("cols", state.cols.join(","));
	}
	rangeToParams(state.range, params);
	const encoded = params.toString();
	return encoded ? `${pathname}?${encoded}` : pathname;
}
