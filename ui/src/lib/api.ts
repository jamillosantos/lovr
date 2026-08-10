import { API_BASE } from "@/config.ts";

export interface FieldValue {
	value: string;
	count: number;
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
