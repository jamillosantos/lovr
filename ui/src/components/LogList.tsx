import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Entry } from "@/domain/models.ts";
import { formatListTimestamp } from "@/lib/datetime.ts";
import { useSettings } from "@/lib/settings.tsx";
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

function Cell({
	column,
	entry,
	timezone,
	formatOptions,
}: {
	column: string;
	entry: Entry;
	timezone: string;
	formatOptions: {
		hour12: boolean;
		hideDateToday: boolean;
		subsecond: boolean;
	};
}) {
	switch (column) {
		case "timestamp":
			return (
				<time className="log-row-time">
					{formatListTimestamp(entry.timestamp, timezone, formatOptions)}
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
	onScrolledAway,
	loadingOlder,
	exhausted,
}: {
	entries: Entry[];
	columns: string[];
	selectedID?: string;
	onSelect: (entry: Entry) => void;
	onEndReached?: () => void;
	/** Reports whether the user scrolled away from the top. */
	onScrolledAway?: (scrolled: boolean) => void;
	loadingOlder?: boolean;
	exhausted?: boolean;
}) {
	const { settings } = useSettings();
	const containerRef = useRef<HTMLDivElement>(null);
	const sentinelRef = useRef<HTMLDivElement>(null);
	const onEndReachedRef = useRef(onEndReached);
	onEndReachedRef.current = onEndReached;
	const onScrolledAwayRef = useRef(onScrolledAway);
	onScrolledAwayRef.current = onScrolledAway;

	const viewport = () =>
		containerRef.current?.querySelector<HTMLElement>(
			"[data-slot=scroll-area-viewport]",
		) ?? null;

	// Track scrolling away from the top (auto-pause) and snap back to the
	// newest entries when follow mode is on.
	useEffect(() => {
		const el = viewport();
		if (!el) {
			return;
		}
		const onScroll = () => {
			onScrolledAwayRef.current?.(el.scrollTop > 50);
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [entries.length > 0]);

	const newestID = entries[0]?.$id;
	useEffect(() => {
		if (settings.followMode) {
			viewport()?.scrollTo({ top: 0 });
		}
	}, [newestID, settings.followMode]);

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

	// Timestamp column width tracks the format: date(6) + hh:mm:ss(8) +
	// optional .SSS(4) + optional AM/PM(3).
	const tsWidth = 14 + (settings.subsecond ? 4 : 0) + (settings.hour12 ? 3 : 0);

	return (
		<div
			className={cn(
				"log-container",
				settings.density === "compact" && "log-density-compact",
				settings.wrapMessages && "log-wrap-messages",
			)}
			ref={containerRef}
			style={{ "--ts-width": `${tsWidth}ch` } as React.CSSProperties}
		>
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
									<Cell
										column={column}
										entry={entry}
										formatOptions={settings}
										key={column}
										timezone={settings.timezone}
									/>
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
