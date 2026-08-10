import { format } from "date-fns";
import { ChartColumnBig } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	fetchFields,
	fetchHistogram,
	type HistogramResponse,
} from "@/lib/api.ts";
import { resolveRange, type TimeRange } from "@/lib/timerange.ts";

const CHART_HEIGHT = 96;
const REFRESH_MS = 10_000;
const SEGMENT_GAP = 2;
const BAR_GAP = 2;

const LEVEL_COLORS: Record<string, string> = {
	debug: "var(--chart-level-debug)",
	info: "var(--chart-level-info)",
	warning: "var(--chart-level-warning)",
	error: "var(--chart-level-error)",
	fatal: "var(--chart-level-fatal)",
	panic: "var(--chart-level-fatal)",
};

// groupColor keeps color bound to the group name (never its rank): levels map
// to their semantic hues, other values to the categorical palette by the
// group's position in the alphabetically sorted set.
function groupColor(group: string, groupBy: string, sorted: string[]): string {
	if (groupBy === "level") {
		return LEVEL_COLORS[group] ?? "var(--chart-cat-0)";
	}
	const index = sorted.indexOf(group);
	return `var(--chart-cat-${((index % 6) + 6) % 6})`;
}

// roundedTopBar draws a bar with only its data end (the top) rounded.
function roundedTopBar(
	x: number,
	y: number,
	w: number,
	h: number,
	r: number,
): string {
	const radius = Math.min(r, w / 2, h);
	return [
		`M ${x} ${y + h}`,
		`L ${x} ${y + radius}`,
		`Q ${x} ${y} ${x + radius} ${y}`,
		`L ${x + w - radius} ${y}`,
		`Q ${x + w} ${y} ${x + w} ${y + radius}`,
		`L ${x + w} ${y + h}`,
		"Z",
	].join(" ");
}

export function Histogram({
	query,
	range,
	refresh,
	paused,
	groupBy,
	onGroupByChange,
	onRangeSelect,
}: {
	query: string;
	range: TimeRange;
	refresh: number;
	paused: boolean;
	groupBy: string;
	onGroupByChange: (groupBy: string) => void;
	onRangeSelect: (from: string, to: string) => void;
}) {
	const [data, setData] = useState<HistogramResponse | null>(null);
	const [fields, setFields] = useState<string[]>([]);
	const [hover, setHover] = useState<number | null>(null);
	const [width, setWidth] = useState(0);
	const [drag, setDrag] = useState<{ start: number; current: number } | null>(
		null,
	);
	const containerRef = useRef<HTMLDivElement>(null);
	const dataRef = useRef(data);
	dataRef.current = data;

	const rangeKey = JSON.stringify(range);

	useEffect(() => {
		const abort = new AbortController();
		fetchFields(abort.signal)
			.then(setFields)
			.catch(() => {});
		return () => abort.abort();
	}, []);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) {
			return;
		}
		const observer = new ResizeObserver(() =>
			setWidth(el.getBoundingClientRect().width),
		);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	useEffect(() => {
		if (paused || width === 0) {
			return;
		}
		const abort = new AbortController();
		const buckets = Math.max(20, Math.min(120, Math.floor(width / 14)));
		const load = () => {
			const resolved = resolveRange(range);
			fetchHistogram(
				{
					q: query,
					since: resolved.since,
					until: resolved.until,
					buckets,
					groupBy: groupBy === "none" ? "" : groupBy,
				},
				abort.signal,
			)
				.then(setData)
				.catch(() => {});
		};
		load();
		const timer = setInterval(load, REFRESH_MS);
		return () => {
			abort.abort();
			clearInterval(timer);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: range keyed by value
	}, [query, rangeKey, refresh, paused, groupBy, width]);

	const buckets = data?.buckets ?? [];
	const groups = data?.groups ?? [];
	const sortedGroups = [...groups].sort();
	const maxTotal = Math.max(
		1,
		...buckets.map((b) =>
			Object.values(b.counts ?? {}).reduce((a, c) => a + c, 0),
		),
	);

	const slot = buckets.length > 0 ? width / buckets.length : 0;
	const barWidth = Math.max(2, slot - BAR_GAP);
	const usableHeight = CHART_HEIGHT - 2;

	const hovered = hover !== null && drag === null ? buckets[hover] : undefined;

	// startDrag brushes a time selection; on release wider than a few pixels
	// it becomes the custom time range.
	const startDrag = (downEvent: React.MouseEvent<SVGSVGElement>) => {
		const rect = downEvent.currentTarget.getBoundingClientRect();
		const clamp = (clientX: number) =>
			Math.max(0, Math.min(rect.width, clientX - rect.left));
		const start = clamp(downEvent.clientX);
		setDrag({ start, current: start });

		const onMove = (event: MouseEvent) => {
			setDrag({ start, current: clamp(event.clientX) });
		};
		const onUp = (event: MouseEvent) => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			setDrag(null);
			const end = clamp(event.clientX);
			const current = dataRef.current;
			if (!current || Math.abs(end - start) < 5 || rect.width === 0) {
				return;
			}
			const t0 = new Date(current.start).getTime();
			const t1 = new Date(current.end).getTime();
			const at = (x: number) => new Date(t0 + (x / rect.width) * (t1 - t0));
			const [a, b] = start < end ? [start, end] : [end, start];
			onRangeSelect(at(a).toISOString(), at(b).toISOString());
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	return (
		<div className="histogram">
			<div className="histogram-chart" ref={containerRef}>
				{buckets.length === 0 ? (
					<div className="histogram-empty">No data in range</div>
				) : (
					// biome-ignore lint/a11y/noSvgWithoutTitle: decorated by the tooltip layer
					<svg
						className="histogram-svg"
						height={CHART_HEIGHT}
						onMouseDown={startDrag}
						onMouseLeave={() => setHover(null)}
						onMouseMove={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							const index = Math.floor(
								((event.clientX - rect.left) / rect.width) * buckets.length,
							);
							setHover(Math.max(0, Math.min(buckets.length - 1, index)));
						}}
						width={width}
					>
						{hover !== null && drag === null && (
							<rect
								className="histogram-hover-band"
								height={CHART_HEIGHT}
								width={slot}
								x={hover * slot}
								y={0}
							/>
						)}
						{drag !== null && (
							<rect
								className="histogram-brush"
								height={CHART_HEIGHT}
								width={Math.abs(drag.current - drag.start)}
								x={Math.min(drag.start, drag.current)}
								y={0}
							/>
						)}
						{buckets.map((bucket, i) => {
							const x = i * slot + BAR_GAP / 2;
							let yBottom = CHART_HEIGHT;
							return groups.map((group) => {
								const count = bucket.counts?.[group] ?? 0;
								if (count === 0) {
									return null;
								}
								const h = Math.max(
									1,
									(count / maxTotal) *
										(usableHeight - SEGMENT_GAP * groups.length),
								);
								const y = yBottom - h;
								const isTop = groups.every(
									(g2) =>
										groups.indexOf(g2) <= groups.indexOf(group) ||
										(bucket.counts?.[g2] ?? 0) === 0,
								);
								const el = isTop ? (
									<path
										d={roundedTopBar(x, y, barWidth, h, 3)}
										fill={groupColor(group, groupBy, sortedGroups)}
										key={group}
									/>
								) : (
									<rect
										fill={groupColor(group, groupBy, sortedGroups)}
										height={h}
										key={group}
										width={barWidth}
										x={x}
										y={y}
									/>
								);
								yBottom = y - SEGMENT_GAP;
								return el;
							});
						})}
					</svg>
				)}
				{hovered && (
					<div
						className="histogram-tooltip"
						style={{
							left: `${Math.min(width - 180, Math.max(0, (hover ?? 0) * slot - 80))}px`,
						}}
					>
						<div className="histogram-tooltip-time">
							{format(new Date(hovered.start), "MMM d HH:mm:ss")}
						</div>
						{groups.map((group) => (
							<div className="histogram-tooltip-row" key={group}>
								<span
									className="histogram-swatch"
									style={{
										background: groupColor(group, groupBy, sortedGroups),
									}}
								/>
								<span className="histogram-tooltip-label">{group}</span>
								<span className="histogram-tooltip-count">
									{hovered.counts?.[group] ?? 0}
								</span>
							</div>
						))}
					</div>
				)}
			</div>

			<div className="histogram-footer">
				{data && (
					<span className="histogram-axis">
						{format(new Date(data.start), "MMM d HH:mm")}
					</span>
				)}
				<div className="histogram-legend">
					{groups.length > 1 &&
						groups.map((group) => (
							<span className="histogram-legend-item" key={group}>
								<span
									className="histogram-swatch"
									style={{
										background: groupColor(group, groupBy, sortedGroups),
									}}
								/>
								{group}
							</span>
						))}
				</div>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							aria-label="Group histogram by"
							className="histogram-groupby"
							size="sm"
							variant="ghost"
						>
							<ChartColumnBig />
							{groupBy === "none" ? "No grouping" : `By ${groupBy}`}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="column-selector">
						<DropdownMenuRadioGroup
							onValueChange={onGroupByChange}
							value={groupBy}
						>
							<DropdownMenuRadioItem value="none">
								No grouping
							</DropdownMenuRadioItem>
							{["level", ...fields.filter((f) => f !== "level")].map(
								(field) => (
									<DropdownMenuRadioItem key={field} value={field}>
										{field}
									</DropdownMenuRadioItem>
								),
							)}
						</DropdownMenuRadioGroup>
					</DropdownMenuContent>
				</DropdownMenu>
				{data && (
					<span className="histogram-axis">
						{format(new Date(data.end), "MMM d HH:mm")}
					</span>
				)}
			</div>
		</div>
	);
}
