// Time range filtering: quick presets and absolute ranges, persisted in the
// URL and resolved to since/until instants when a stream (re)starts.

export interface PresetRange {
	preset: string;
}

export interface AbsoluteRange {
	from: string;
	to?: string;
}

// null means "All time" — no time filtering at all.
export type TimeRange = PresetRange | AbsoluteRange | null;

export const PRESETS: { id: string; label: string; ms: number }[] = [
	{ id: "15m", label: "Last 15 minutes", ms: 15 * 60_000 },
	{ id: "30m", label: "Last 30 minutes", ms: 30 * 60_000 },
	{ id: "1h", label: "Last hour", ms: 60 * 60_000 },
	{ id: "3h", label: "Last 3 hours", ms: 3 * 60 * 60_000 },
	{ id: "6h", label: "Last 6 hours", ms: 6 * 60 * 60_000 },
	{ id: "12h", label: "Last 12 hours", ms: 12 * 60 * 60_000 },
	{ id: "24h", label: "Last 24 hours", ms: 24 * 60 * 60_000 },
	{ id: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60_000 },
];

export function isPreset(range: TimeRange): range is PresetRange {
	return range !== null && "preset" in range;
}

// resolveRange turns a range into concrete since/until instants ("now" is
// injectable for tests).
export function resolveRange(
	range: TimeRange,
	now: () => Date = () => new Date(),
): { since?: string; until?: string } {
	if (range === null) {
		return {};
	}
	if (isPreset(range)) {
		const preset = PRESETS.find((p) => p.id === range.preset);
		if (!preset) {
			return {};
		}
		return { since: new Date(now().getTime() - preset.ms).toISOString() };
	}
	return { since: range.from, until: range.to };
}

export function rangeLabel(range: TimeRange): string {
	if (range === null) {
		return "All time";
	}
	if (isPreset(range)) {
		return PRESETS.find((p) => p.id === range.preset)?.label ?? "All time";
	}
	const fmt = (iso: string) =>
		new Date(iso).toLocaleString(undefined, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	return range.to
		? `${fmt(range.from)} – ${fmt(range.to)}`
		: `Since ${fmt(range.from)}`;
}

// URL round-trip.
export function rangeToParams(range: TimeRange, params: URLSearchParams) {
	if (range === null) {
		return;
	}
	if (isPreset(range)) {
		params.set("range", range.preset);
		return;
	}
	params.set("from", range.from);
	if (range.to) {
		params.set("to", range.to);
	}
}

export function rangeFromParams(params: URLSearchParams): TimeRange {
	const preset = params.get("range");
	if (preset && PRESETS.some((p) => p.id === preset)) {
		return { preset };
	}
	const from = params.get("from");
	if (from) {
		return { from, to: params.get("to") ?? undefined };
	}
	return null;
}
