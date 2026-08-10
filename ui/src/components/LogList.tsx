import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Entry } from "@/domain/models.ts";
import { cn } from "@/lib/utils";

// columnClass gives each column its width so header and row cells align.
function columnClass(column: string): string {
	switch (column) {
		case "timestamp":
			return "log-row-time";
		case "level":
			return "log-col-level";
		case "message":
			return "log-row-message";
		default:
			return "log-row-field";
	}
}

function Cell({ column, entry }: { column: string; entry: Entry }) {
	switch (column) {
		case "timestamp":
			return (
				<time className="log-row-time">
					{format(new Date(entry.timestamp), "HH:mm:ss.SSS")}
				</time>
			);
		case "level":
			return <LevelBadge level={entry.level} />;
		case "message":
			return <span className="log-row-message">{entry.message}</span>;
		case "caller":
			return <span className="log-row-field">{entry.caller ?? ""}</span>;
		case "stacktrace":
			return <span className="log-row-field">{entry.stacktrace ?? ""}</span>;
		default: {
			const value = entry.fields?.find((f) => f.key === column)?.value;
			const text =
				value === undefined
					? ""
					: typeof value === "object" && value !== null
						? JSON.stringify(value)
						: String(value);
			return <span className="log-row-field">{text}</span>;
		}
	}
}

export function LogList({
	entries,
	columns,
	selectedID,
	onSelect,
	onEndReached,
	loadingOlder,
	exhausted,
}: {
	entries: Entry[];
	columns: string[];
	selectedID?: string;
	onSelect: (entry: Entry) => void;
	onEndReached?: () => void;
	loadingOlder?: boolean;
	exhausted?: boolean;
}) {
	const sentinelRef = useRef<HTMLDivElement>(null);
	const onEndReachedRef = useRef(onEndReached);
	onEndReachedRef.current = onEndReached;

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) {
			return;
		}
		const viewport = sentinel.closest("[data-slot=scroll-area-viewport]");
		const observer = new IntersectionObserver(
			(observed) => {
				if (observed.some((o) => o.isIntersecting)) {
					onEndReachedRef.current?.();
				}
			},
			{ root: viewport, rootMargin: "200px" },
		);
		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [entries.length > 0]);

	if (entries.length === 0) {
		return <div className="log-empty">Waiting for log entries…</div>;
	}

	return (
		<div className="log-container">
			<div className="log-header">
				{columns.map((column) => (
					<span className={columnClass(column)} key={column}>
						{column}
					</span>
				))}
			</div>
			<ScrollArea className="log-scroll">
				<ul className="log-list">
					{entries.map((entry) => (
						<li key={entry.$id}>
							<button
								className={cn(
									"log-row",
									entry.$id === selectedID && "log-row-selected",
								)}
								onClick={() => onSelect(entry)}
							>
								{columns.map((column) => (
									<Cell column={column} entry={entry} key={column} />
								))}
							</button>
						</li>
					))}
				</ul>
				<div className="log-list-footer" ref={sentinelRef}>
					{loadingOlder && <Loader2 className="log-list-spinner" />}
					{exhausted && <span>End of results</span>}
				</div>
			</ScrollArea>
		</div>
	);
}
