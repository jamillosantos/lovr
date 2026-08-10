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

// Extracts the search query from a location search string (?q=...).
export function queryFromSearch(search: string): string {
	return new URLSearchParams(search).get("q") ?? "";
}

// Builds the URL that persists a query, dropping the parameter when empty.
export function searchURL(pathname: string, query: string): string {
	const trimmed = query.trim();
	if (!trimmed) {
		return pathname;
	}
	return `${pathname}?${new URLSearchParams({ q: trimmed })}`;
}
