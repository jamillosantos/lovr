import { format } from "date-fns";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Entry } from "@/domain/models.ts";
import { cn } from "@/lib/utils";

export function LogList({
	entries,
	selectedID,
	onSelect,
}: {
	entries: Entry[];
	selectedID?: string;
	onSelect: (entry: Entry) => void;
}) {
	if (entries.length === 0) {
		return <div className="log-empty">Waiting for log entries…</div>;
	}

	return (
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
							<time className="log-row-time">
								{format(new Date(entry.timestamp), "HH:mm:ss.SSS")}
							</time>
							<LevelBadge level={entry.level} />
							<span className="log-row-message">{entry.message}</span>
						</button>
					</li>
				))}
			</ul>
		</ScrollArea>
	);
}
