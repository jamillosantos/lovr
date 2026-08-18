import { ArrowDown, ArrowUp, Loader2 } from "lucide-react";
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
				<span
					className="log-row-message"
					style={width ? { width: `${width}px`, flex: "none" } : undefined}
				>
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
	sortAsc = false,
	onToggleSort,
}: {
	entries: Entry[];
	columns: string[];
	selectedID?: string;
	onSelect: (entry: Entry) => void;
	onEndReached?: () => void;
	/** Reports whether the user scrolled away from the live edge. */
	onScrolledAway?: (scrolled: boolean) => void;
	loadingOlder?: boolean;
	exhausted?: boolean;
	/** Oldest first when true; the data itself stays newest-first. */
	sortAsc?: boolean;
	onToggleSort?: () => void;
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
	// biome-ignore lint/correctness/useExhaustiveDependencies: entries.length>0 intentionally re-attaches the listener once the viewport mounts after the empty state; viewport() only reads a stable ref
	useEffect(() => {
		const el = viewport();
		if (!el) {
			return;
		}
		const onScroll = () => {
			const awayFromLiveEdge = sortAsc
				? el.scrollHeight - el.scrollTop - el.clientHeight > 50
				: el.scrollTop > 50;
			onScrolledAwayRef.current?.(awayFromLiveEdge);
		};
		el.addEventListener("scroll", onScroll, { passive: true });
		return () => el.removeEventListener("scroll", onScroll);
	}, [entries.length > 0, sortAsc]);

	const newestID = entries[0]?.$id;
	// biome-ignore lint/correctness/useExhaustiveDependencies: newestID is an intentional trigger to snap to the live edge on each new entry; viewport() only reads a stable ref
	useEffect(() => {
		if (settings.followMode) {
			const el = viewport();
			el?.scrollTo({ top: sortAsc ? el.scrollHeight : 0 });
		}
	}, [newestID, settings.followMode, sortAsc]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: entries.length>0 and sortAsc intentionally re-run the observer when the sentinel (re)mounts or moves between footer positions
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
	}, [entries.length > 0, sortAsc]);

	if (entries.length === 0) {
		return <div className="log-empty">Waiting for log entries…</div>;
	}

	const rendered = sortAsc ? [...entries].reverse() : entries;

	// Timestamp column width tracks the format: date(6) + hh:mm:ss(8) +
	// optional .SSS(4) + optional AM/PM(3).
	const tsWidth = 14 + (settings.subsecond ? 4 : 0) + (settings.hour12 ? 3 : 0);

	// resetWidth restores a column to its default (double-click on the handle).
	const resetWidth = (column: string) => {
		const next = { ...widthsRef.current };
		delete next[column];
		setWidths(next);
		update({ columnWidths: next });
	};

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
							widths[column]
								? {
										width: `${widths[column]}px`,
										...(column === "message" ? { flex: "none" } : {}),
									}
								: undefined
						}
					>
						{column === "timestamp" ? (
							<button className="log-sort" onClick={onToggleSort} type="button">
								{column}
								{sortAsc ? <ArrowUp /> : <ArrowDown />}
							</button>
						) : (
							column
						)}
						{/* biome-ignore-start lint/a11y/useSemanticElements: an <hr> would break the drag-handle styling and hit area */}
						{/* biome-ignore lint/a11y/useFocusableInteractive: mouse-only drag affordance; keyboard resize is not implemented, so a tab stop would be inert */}
						<span
							className="col-resize"
							onDoubleClick={() => resetWidth(column)}
							onMouseDown={(event) => startResize(event, column)}
							// biome-ignore lint/a11y/useAriaPropsForRole: aria-valuenow applies to focusable separators; this static handle's width is content-driven until dragged
							role="separator"
							aria-label={`Resize ${column} column`}
						/>
						{/* biome-ignore-end lint/a11y/useSemanticElements: an <hr> would break the drag-handle styling and hit area */}
					</span>
				))}
			</div>
			<ScrollArea className="log-scroll">
				{sortAsc && (
					<div
						className={cn(
							"log-list-footer",
							!loadingOlder && !exhausted && "log-list-footer-idle",
						)}
						ref={sentinelRef}
					>
						{loadingOlder && <Loader2 className="log-list-spinner" />}
						{exhausted && <span>End of results</span>}
					</div>
				)}
				<ul className="log-list">
					{rendered.map((entry) => (
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
				{!sortAsc && (
					<div
						className={cn(
							"log-list-footer",
							!loadingOlder && !exhausted && "log-list-footer-idle",
						)}
						ref={sentinelRef}
					>
						{loadingOlder && <Loader2 className="log-list-spinner" />}
						{exhausted && <span>End of results</span>}
					</div>
				)}
			</ScrollArea>
		</div>
	);
}
