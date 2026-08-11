import type { Entry } from "@/domain/models.ts";

export const MAX_ENTRIES = 5000;

// mergeLive prepends a live batch (newest first), dropping entries the batch
// re-delivered and trimming the tail at the cap.
export function mergeLive(
	current: Entry[],
	incoming: Entry[],
	max = MAX_ENTRIES,
): Entry[] {
	const seen = new Set(incoming.map((e) => e.$id));
	const kept = current.filter((e) => !seen.has(e.$id));
	return [...incoming, ...kept].slice(0, max);
}

// countFresh returns how many incoming entries are not already loaded — the
// amount a live batch grows the total number of matches.
export function countFresh(current: Entry[], incoming: Entry[]): number {
	const existing = new Set(current.map((e) => e.$id));
	return incoming.filter((e) => !existing.has(e.$id)).length;
}

// mergeOlder appends a backfill page (already newest first within the page),
// dropping entries that are already loaded (pages overlap at the boundary
// timestamp).
export function mergeOlder(
	current: Entry[],
	incoming: Entry[],
	max = MAX_ENTRIES,
): Entry[] {
	const existing = new Set(current.map((e) => e.$id));
	const fresh = incoming.filter((e) => !existing.has(e.$id));
	return [...current, ...fresh].slice(0, max);
}
