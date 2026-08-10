import clsx from "clsx";
import { Pause, Play, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { LogDetail } from "@/components/LogDetail.tsx";
import { LogList } from "@/components/LogList.tsx";
import type { Entry } from "@/domain/models.ts";
import { useLiveEntries } from "@/hooks/useLiveEntries.ts";

const connectionLabels = {
	connecting: ["bg-level-warning", "Connecting"],
	connected: ["bg-level-info", "Live"],
	closed: ["bg-level-error", "Disconnected"],
} as const;

export function App() {
	const [queryInput, setQueryInput] = useState("");
	const [query, setQuery] = useState("");
	const [refresh, setRefresh] = useState(0);
	const [selected, setSelected] = useState<Entry | undefined>();

	const { entries, connection, error, paused, setPaused, clear } =
		useLiveEntries(query, refresh);

	const selectedEntry = useMemo(
		() => entries.find((e) => e.$id === selected?.$id) ?? selected,
		[entries, selected],
	);

	const [dotClass, connectionLabel] = connectionLabels[connection];

	return (
		<div className="flex h-screen flex-col">
			<header className="flex items-center gap-3 border-border border-b bg-card px-4 py-2">
				<h1 className="font-bold text-sm tracking-wide">lovr</h1>

				<form
					className="flex flex-1 items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						setQuery(queryInput);
						// Re-submitting the same query restarts the stream too.
						setRefresh((r) => r + 1);
					}}
				>
					<div className="relative flex-1">
						<Search
							className="-translate-y-1/2 absolute top-1/2 left-2 text-muted-foreground"
							size={14}
						/>
						<input
							className="w-full rounded border border-border bg-background py-1.5 pr-3 pl-7 font-mono text-xs outline-none placeholder:text-muted-foreground focus:ring-1 focus:ring-ring"
							placeholder="Search… (e.g. timeout, level:error, nested.host:db1)"
							value={queryInput}
							onChange={(event) => setQueryInput(event.target.value)}
						/>
					</div>
				</form>

				<button
					className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					onClick={() => setPaused(!paused)}
				>
					{paused ? <Play size={12} /> : <Pause size={12} />}
					{paused ? "Resume" : "Pause"}
				</button>

				<button
					className="flex items-center gap-1.5 rounded border border-border px-2 py-1.5 text-muted-foreground text-xs hover:bg-muted hover:text-foreground"
					onClick={clear}
				>
					<Trash2 size={12} />
					Clear
				</button>

				<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<span
						className={clsx(
							"inline-block size-2 rounded-full",
							paused ? "bg-level-warning" : dotClass,
						)}
					/>
					{paused ? "Paused" : connectionLabel}
					<span className="ml-2 font-mono">{entries.length}</span>
				</div>
			</header>

			{error && (
				<div className="border-level-error/40 border-b bg-level-error/10 px-4 py-1.5 font-mono text-level-error text-xs">
					{error}
				</div>
			)}

			<main className="flex min-h-0 flex-1">
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
