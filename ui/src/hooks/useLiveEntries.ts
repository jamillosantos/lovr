import { useCallback, useEffect, useRef, useState } from "react";
import { wsURL } from "@/config.ts";
import type { BatchEntries, Entry } from "@/domain/models.ts";
import { searchEntries } from "@/lib/api.ts";
import {
	countFresh,
	MAX_ENTRIES,
	mergeLive,
	mergeOlder,
} from "@/lib/entries.ts";
import { useSettings } from "@/lib/settings.tsx";
import { resolveRange, type TimeRange } from "@/lib/timerange.ts";

const RECONNECT_DELAY_MS = 1000;

export type ConnectionState = "connecting" | "connected" | "closed";

export interface LiveEntries {
	/** Entries to render: a frozen snapshot while paused, live otherwise. */
	entries: Entry[];
	connection: ConnectionState;
	error: string | null;
	paused: boolean;
	setPaused: (paused: boolean) => void;
	clear: () => void;
	/** Fetches the next (older) history page. No-op while one is in flight. */
	loadOlder: () => void;
	loadingOlder: boolean;
	/** True when the history has been fully paginated. */
	exhausted: boolean;
	/** Total matches for the current query/window; null until known. */
	total: number | null;
}

// useLiveEntries combines the websocket live tail (new entries, prepended)
// with paginated history via the search endpoint (older entries, appended as
// the user scrolls). Both sources deduplicate by entry id. The stream
// restarts whenever the query (or the refresh nonce) changes. Pausing only
// freezes what is rendered — ingestion continues in the background.
export function useLiveEntries(
	query: string,
	range: TimeRange,
	refresh: number,
): LiveEntries {
	const { settings } = useSettings();
	const pageSizeRef = useRef(settings.historyPageSize);
	pageSizeRef.current = settings.historyPageSize;
	const [entries, setEntries] = useState<Entry[]>([]);
	const [frozen, setFrozen] = useState<Entry[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [connection, setConnection] = useState<ConnectionState>("connecting");
	const [loadingOlder, setLoadingOlder] = useState(false);
	const [exhausted, setExhausted] = useState(false);
	const [total, setTotal] = useState<number | null>(null);

	const entriesRef = useRef(entries);
	entriesRef.current = entries;
	const loadingOlderRef = useRef(false);
	const generationRef = useRef(0);
	// The resolved window of the current stream; backfill stays inside it.
	const windowRef = useRef<{ since?: string; until?: string }>({});

	const rangeKey = JSON.stringify(range);

	// biome-ignore lint/correctness/useExhaustiveDependencies: range is keyed by value via rangeKey; refresh is an intentional restart nonce
	useEffect(() => {
		let ws: WebSocket | null = null;
		let closed = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

		generationRef.current++;
		setEntries([]);
		setFrozen(null);
		setError(null);
		setExhausted(false);
		setTotal(null);
		loadingOlderRef.current = false;
		setLoadingOlder(false);

		let url: string;
		try {
			url = wsURL("/entries/live");
		} catch (e) {
			setConnection("closed");
			setError(`Invalid API URL: ${e instanceof Error ? e.message : e}`);
			return;
		}

		const resolved = resolveRange(range);
		windowRef.current = resolved;

		// The total match count is authoritative on the server; recount there
		// (debounced) instead of incrementing locally, which double-counts the
		// initial backlog batches.
		let totalTimer: ReturnType<typeof setTimeout> | undefined;
		const syncTotal = () => {
			const generation = generationRef.current;
			searchEntries({
				q: query,
				since: resolved.since,
				until: resolved.until,
			})
				.then((result) => {
					if (generation === generationRef.current) {
						setTotal(result.total);
					}
				})
				.catch(() => {
					// Non-fatal: the count stays stale until the next sync.
				});
		};
		const scheduleTotalSync = () => {
			clearTimeout(totalTimer);
			totalTimer = setTimeout(syncTotal, 800);
		};

		const connect = () => {
			setConnection("connecting");
			ws = new WebSocket(url);

			ws.onopen = () => {
				setConnection("connected");
				ws?.send(
					JSON.stringify({
						q: query,
						since: resolved.since,
						until: resolved.until,
					}),
				);
				syncTotal();
			};

			ws.onmessage = (event) => {
				const batch: BatchEntries = JSON.parse(event.data);
				if (batch.err) {
					setError(String(batch.err));
					return;
				}
				if (!batch.entries?.length) {
					return;
				}
				setError(null);
				const incoming = batch.entries;
				if (countFresh(entriesRef.current, incoming) > 0) {
					scheduleTotalSync();
				}
				setEntries((current) => mergeLive(current, incoming, MAX_ENTRIES));
			};

			ws.onclose = () => {
				if (closed) {
					return;
				}
				setConnection("closed");
				reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
			};

			ws.onerror = () => {
				ws?.close();
			};
		};

		connect();

		return () => {
			closed = true;
			clearTimeout(reconnectTimer);
			clearTimeout(totalTimer);
			ws?.close();
		};
	}, [query, refresh, rangeKey]);

	const loadOlder = useCallback(() => {
		if (loadingOlderRef.current || exhausted) {
			return;
		}
		const current = entriesRef.current;
		if (current.length === 0) {
			return;
		}
		const oldest = current[current.length - 1];
		if (!oldest) {
			return;
		}

		loadingOlderRef.current = true;
		setLoadingOlder(true);
		const generation = generationRef.current;

		searchEntries({
			q: query,
			since: windowRef.current.since,
			until: oldest.timestamp,
			pageSize: pageSizeRef.current,
		})
			.then((result) => {
				if (generation !== generationRef.current) {
					return;
				}
				const page = result.entries;
				setEntries((cur) => {
					const merged = mergeOlder(cur, page, MAX_ENTRIES);
					if (merged.length === cur.length) {
						setExhausted(true);
					}
					return merged;
				});
				// Keep a paused (frozen) view growing with history pages so
				// scrolling back works while paused.
				setFrozen((f) => (f ? mergeOlder(f, page, MAX_ENTRIES) : f));
			})
			.catch((e) => {
				if (generation === generationRef.current) {
					setError(
						`Loading history failed: ${e instanceof Error ? e.message : e}`,
					);
				}
			})
			.finally(() => {
				if (generation === generationRef.current) {
					loadingOlderRef.current = false;
					setLoadingOlder(false);
				}
			});
	}, [query, exhausted]);

	const setPaused = useCallback(
		(paused: boolean) => {
			setFrozen(paused ? entries : null);
		},
		[entries],
	);

	return {
		entries: frozen ?? entries,
		connection,
		error,
		paused: frozen !== null,
		setPaused,
		clear: () => {
			setEntries([]);
			setFrozen(null);
			setExhausted(false);
		},
		loadOlder,
		loadingOlder,
		exhausted,
		total,
	};
}
