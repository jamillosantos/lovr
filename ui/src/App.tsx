import { AlertCircle, Pause, Play, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus.tsx";
import { LogDetail } from "@/components/LogDetail.tsx";
import { LogList } from "@/components/LogList.tsx";
import { SearchBar } from "@/components/SearchBar.tsx";
import { ThemeToggle } from "@/components/ThemeToggle.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Entry, Field } from "@/domain/models.ts";
import { useLiveEntries } from "@/hooks/useLiveEntries.ts";
import {
	appendTerm,
	fieldTerm,
	queryFromSearch,
	searchURL,
} from "@/lib/query.ts";

export function App() {
	const [queryInput, setQueryInput] = useState(() =>
		queryFromSearch(window.location.search),
	);
	const [query, setQuery] = useState(queryInput);
	const [refresh, setRefresh] = useState(0);
	const [selected, setSelected] = useState<Entry | undefined>();

	const runQuery = (q: string, pushHistory = true) => {
		setQuery(q);
		// Bumping the nonce restarts the stream even for an unchanged query.
		setRefresh((r) => r + 1);
		if (pushHistory) {
			const url = searchURL(window.location.pathname, q);
			const current = window.location.pathname + window.location.search;
			if (url !== current) {
				window.history.pushState(null, "", url);
			}
		}
	};

	// Restore the query when navigating browser history.
	useEffect(() => {
		const onPopState = () => {
			const q = queryFromSearch(window.location.search);
			setQueryInput(q);
			runQuery(q, false);
		};
		window.addEventListener("popstate", onPopState);
		return () => window.removeEventListener("popstate", onPopState);
	}, []);

	const addToSearch = (field: Field) => {
		const next = appendTerm(queryInput, fieldTerm(field.key, field.value));
		setQueryInput(next);
		runQuery(next);
	};

	const { entries, connection, error, paused, setPaused, clear } =
		useLiveEntries(query, refresh);

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
					onSubmit={() => runQuery(queryInput)}
				/>

				<Button variant="outline" size="sm" onClick={() => setPaused(!paused)}>
					{paused ? <Play /> : <Pause />}
					{paused ? "Resume" : "Pause"}
				</Button>

				<Button variant="outline" size="sm" onClick={clear}>
					<Trash2 />
					Clear
				</Button>

				<Separator orientation="vertical" className="h-5!" />

				<ConnectionStatus
					connection={connection}
					paused={paused}
					count={entries.length}
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
					entries={entries}
					selectedID={selectedEntry?.$id}
					onSelect={setSelected}
				/>
				{selectedEntry && (
					<LogDetail
						entry={selectedEntry}
						onClose={() => setSelected(undefined)}
						onAddToSearch={addToSearch}
					/>
				)}
			</main>
		</div>
	);
}
