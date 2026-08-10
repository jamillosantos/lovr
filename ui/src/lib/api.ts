import { API_BASE } from "@/config.ts";
import type { Entry } from "@/domain/models.ts";

export interface FieldValue {
	value: string;
	count: number;
}

export interface SearchParams {
	q?: string;
	since?: string;
	until?: string;
	pageSize?: number;
}

export async function searchEntries(
	{ q, since, until, pageSize }: SearchParams,
	signal?: AbortSignal,
): Promise<Entry[]> {
	const params = new URLSearchParams();
	if (q) {
		params.set("q", q);
	}
	if (since) {
		params.set("since", since);
	}
	if (until) {
		params.set("until", until);
	}
	if (pageSize) {
		params.set("pageSize", String(pageSize));
	}
	const res = await fetch(`${API_BASE}/entries/search?${params}`, { signal });
	if (!res.ok) {
		throw new Error(`search failed: ${res.status}`);
	}
	const body: { entries: Entry[] | null } = await res.json();
	return body.entries ?? [];
}

export async function fetchFields(signal?: AbortSignal): Promise<string[]> {
	const res = await fetch(`${API_BASE}/entries/fields`, { signal });
	if (!res.ok) {
		throw new Error(`fetching fields failed: ${res.status}`);
	}
	const body: { fields: string[] | null } = await res.json();
	return body.fields ?? [];
}

export async function fetchFieldValues(
	field: string,
	prefix: string,
	signal?: AbortSignal,
): Promise<FieldValue[]> {
	const params = new URLSearchParams();
	if (prefix) {
		params.set("prefix", prefix);
	}
	const res = await fetch(
		`${API_BASE}/entries/fields/${encodeURIComponent(field)}/values?${params}`,
		{ signal },
	);
	if (!res.ok) {
		throw new Error(`fetching field values failed: ${res.status}`);
	}
	const body: { values: FieldValue[] | null } = await res.json();
	return body.values ?? [];
}
