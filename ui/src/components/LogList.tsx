import clsx from "clsx";
import { format } from "date-fns";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import type { Entry } from "@/domain/models.ts";

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
		return (
			<div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
				Waiting for log entries…
			</div>
		);
	}

	return (
		<ul className="flex-1 divide-y divide-border overflow-y-auto font-mono text-xs">
			{entries.map((entry) => (
				<li key={entry.$id}>
					<button
						className={clsx(
							"flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-muted/50",
							entry.$id === selectedID && "bg-muted",
						)}
						onClick={() => onSelect(entry)}
					>
						<time className="shrink-0 text-muted-foreground">
							{format(new Date(entry.timestamp), "HH:mm:ss.SSS")}
						</time>
						<LevelBadge level={entry.level} />
						<span className="truncate">{entry.message}</span>
					</button>
				</li>
			))}
		</ul>
	);
}
