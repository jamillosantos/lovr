import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
	width,
}: {
	column: string;
	entry: Entry;
	timezone: string;
	formatOptions: {
		hour12: boolean;
		hideDateToday: boolean;
		subsecond: boolean;
	};
	width?: number;
}) {
	const style = width ? { width: `${width}px` } : undefined;
	switch (column) {
		case "timestamp":
			return (
				<time className="log-row-time" style={style}>
					{formatListTimestamp(entry.timestamp, timezone, formatOptions)}
				</time>
			);
		case "level":
			return (
				<span className="log-col-level" style={style}>
					<LevelBadge level={entry.level} />
				</span>
			);
		case "message":
			return (
				<span className="log-row-message" style={style}>
					{entry.message}
				</span>
			);
		case "caller":
			return (
				<span className="log-row-field" style={style}>
					{entry.caller ?? ""}
				</span>
			);
		case "stacktrace":
			return (
				<span className="log-row-field" style={style}>
					{entry.stacktrace ?? ""}
				</span>
			);
		default: {
			const value = entry.fields?.find((f) => f.key === column)?.value;
			const text =
				value === undefined
					? ""
					: typeof value === "object" && value !== null
						? JSON.stringify(value)
						: String(value);
			return (
				<span className="log-row-field" style={style}>
					{text}
				</span>
			);
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
	const { settings, update } = useSettings();
	const [widths, setWidths] = useState<Record<string, number>>(
		settings.columnWidths,
	);
	const widthsRef = useRef(widths);
	widthsRef.current = widths;
	// Views/restore replace widths from outside; follow them.
	useEffect(() => {
		setWidths(settings.columnWidths);
	}, [settings.columnWidths]);
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

	// startResize drags a column edge; the width persists in settings.
	const startResize = (
		event: React.MouseEvent<HTMLSpanElement>,
		column: string,
	) => {
		event.preventDefault();
		const cell = event.currentTarget.parentElement;
		if (!cell) {
			return;
		}
		const startX = event.clientX;
		const startWidth = cell.getBoundingClientRect().width;
		const onMove = (move: MouseEvent) => {
			const next = Math.max(
				40,
				Math.min(800, startWidth + move.clientX - startX),
			);
			setWidths((w) => ({ ...w, [column]: Math.round(next) }));
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			update({ columnWidths: widthsRef.current });
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

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
					<span
						className={cn(columnClass(column), "log-header-cell")}
						key={column}
						style={
							widths[column] ? { width: `${widths[column]}px` } : undefined
						}
					>
						{column}
						{column !== "message" && (
							<span
								className="col-resize"
								onMouseDown={(event) => startResize(event, column)}
								role="separator"
								aria-label={`Resize ${column} column`}
							/>
						)}
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
										width={widths[column]}
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
