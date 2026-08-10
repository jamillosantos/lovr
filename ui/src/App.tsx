import { AlertCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ColumnSelector } from "@/components/ColumnSelector.tsx";
import { ConnectionStatus } from "@/components/ConnectionStatus.tsx";
import { LogDetail, type SearchAction } from "@/components/LogDetail.tsx";
import { LogList } from "@/components/LogList.tsx";
import { SearchBar } from "@/components/SearchBar.tsx";
import { ThemeToggle } from "@/components/ThemeToggle.tsx";
import { TimeFilter } from "@/components/TimeFilter.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { Entry, Field } from "@/domain/models.ts";
import { useLiveEntries } from "@/hooks/useLiveEntries.ts";
import {
	appendTerm,
	fieldTerm,
	stateFromSearch,
	stateURL,
	type URLState,
} from "@/lib/query.ts";
import type { TimeRange } from "@/lib/timerange.ts";

export function App() {
	const [initialState] = useState(() =>
		stateFromSearch(window.location.search),
	);
	const [queryInput, setQueryInput] = useState(initialState.q);
	const [query, setQuery] = useState(initialState.q);
	const [columns, setColumns] = useState(initialState.cols);
	const [range, setRange] = useState<TimeRange>(initialState.range);
	const [refresh, setRefresh] = useState(0);
	const [selected, setSelected] = useState<Entry | undefined>();

	const syncURL = (state: URLState, push: boolean) => {
		const url = stateURL(window.location.pathname, state);
		const current = window.location.pathname + window.location.search;
		if (url === current) {
			return;
		}
		if (push) {
			window.history.pushState(null, "", url);
		} else {
			window.history.replaceState(null, "", url);
		}
	};

	const runQuery = (q: string, pushHistory = true) => {
		setQuery(q);
		// Bumping the nonce restarts the stream even for an unchanged query.
		setRefresh((r) => r + 1);
		if (pushHistory) {
			syncURL({ q, cols: columns, range }, true);
		}
	};

	const changeColumns = (cols: string[]) => {
		setColumns(cols);
		syncURL({ q: query, cols, range }, false);
	};

	const changeRange = (next: TimeRange) => {
		setRange(next);
		// The stream restarts via the range key; persist as navigation.
		syncURL({ q: query, cols: columns, range: next }, true);
	};

	// Restore the state when navigating browser history.
	useEffect(() => {
		const onPopState = () => {
			const state = stateFromSearch(window.location.search);
			setQueryInput(state.q);
			setColumns(state.cols);
			setRange(state.range);
			runQuery(state.q, false);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const searchAction = (field: Field, action: SearchAction) => {
		let term: string;
		switch (action) {
			case "add":
				term = fieldTerm(field.key, field.value);
				break;
			case "exclude":
				term = `-${fieldTerm(field.key, field.value)}`;
				break;
			case "add-key":
				term = `_exists_:${field.key}`;
				break;
			case "exclude-key":
				term = `-_exists_:${field.key}`;
				break;
		}
		const next = appendTerm(queryInput, term);
		setQueryInput(next);
		runQuery(next);
	};

	const {
		entries,
		connection,
		error,
		paused,
		setPaused,
		loadOlder,
		loadingOlder,
		exhausted,
	} = useLiveEntries(query, range, refresh);

	const selectedEntry = useMemo(
		() => entries.find((e) => e.$id === selected?.$id) ?? selected,
		[entries, selected],
	);

	return (
		<div className="app-shell">
			<header className="app-header">
				<h1 className="app-title">lovr</h1>

				<SearchBar
					value={queryInput}
					onChange={setQueryInput}
					onClear={() => {
						setQueryInput("");
						runQuery("");
					}}
					onSubmit={() => runQuery(queryInput)}
				/>

				<TimeFilter onChange={changeRange} range={range} />

				<ColumnSelector columns={columns} onChange={changeColumns} />

				<ConnectionStatus
					connection={connection}
					count={entries.length}
					onToggle={() => setPaused(!paused)}
					paused={paused}
				/>

				<ThemeToggle />
			</header>

			{error && (
				<Alert variant="destructive" className="error-banner">
					<AlertCircle />
					<AlertDescription className="error-banner-text">
						{error}
					</AlertDescription>
				</Alert>
			)}

			<main className="app-main">
				<LogList
					columns={columns}
					entries={entries}
					exhausted={exhausted}
					loadingOlder={loadingOlder}
					onEndReached={paused ? undefined : loadOlder}
					onSelect={setSelected}
					selectedID={selectedEntry?.$id}
				/>
				{selectedEntry && (
					<LogDetail
						entry={selectedEntry}
						onClose={() => setSelected(undefined)}
						onSearchAction={searchAction}
					/>
				)}
			</main>
		</div>
	);
}
