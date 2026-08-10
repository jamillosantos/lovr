import { AlertCircle, Pause, Play, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConnectionStatus } from "@/components/ConnectionStatus.tsx";
import { LogDetail } from "@/components/LogDetail.tsx";
import { LogList } from "@/components/LogList.tsx";
import { SearchBar } from "@/components/SearchBar.tsx";
import { ThemeToggle } from "@/components/ThemeToggle.tsx";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { Entry } from "@/domain/models.ts";
import { useLiveEntries } from "@/hooks/useLiveEntries.ts";

export function App() {
	const [query, setQuery] = useState("");
	const [refresh, setRefresh] = useState(0);
	const [selected, setSelected] = useState<Entry | undefined>();

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
					onSubmit={(q) => {
						setQuery(q);
						// Re-submitting the same query restarts the stream too.
						setRefresh((r) => r + 1);
					}}
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
					/>
				)}
			</main>
		</div>
	);
}
