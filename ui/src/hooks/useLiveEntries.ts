import { useCallback, useEffect, useState } from "react";
import { wsURL } from "@/config.ts";
import type { BatchEntries, Entry } from "@/domain/models.ts";

const MAX_ENTRIES = 1000;
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
}

// useLiveEntries keeps a websocket open against /entries/live, restarting the
// stream whenever the query (or the refresh nonce) changes. Batches arrive
// newest-first and are prepended to the list, deduplicated by entry id.
// Pausing only freezes what is rendered — ingestion continues in the
// background so no entries are lost.
export function useLiveEntries(query: string, refresh: number): LiveEntries {
	const [entries, setEntries] = useState<Entry[]>([]);
	const [frozen, setFrozen] = useState<Entry[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [connection, setConnection] = useState<ConnectionState>("connecting");

	useEffect(() => {
		let ws: WebSocket | null = null;
		let closed = false;
		let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

		setEntries([]);
		setFrozen(null);
		setError(null);

		let url: string;
		try {
			url = wsURL("/entries/live");
		} catch (e) {
			setConnection("closed");
			setError(`Invalid API URL: ${e instanceof Error ? e.message : e}`);
			return;
		}

		const connect = () => {
			setConnection("connecting");
			ws = new WebSocket(url);

			ws.onopen = () => {
				setConnection("connected");
				ws?.send(JSON.stringify({ q: query }));
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
				setEntries((current) => {
					const seen = new Set(incoming.map((e) => e.$id));
					const kept = current.filter((e) => !seen.has(e.$id));
					return [...incoming, ...kept].slice(0, MAX_ENTRIES);
				});
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
			ws?.close();
		};
	}, [query, refresh]);

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
		},
	};
}
