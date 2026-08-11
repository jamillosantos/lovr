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
import { formatShortPoint, formatTooltipTime } from "@/lib/datetime.ts";
import { canonicalLevel } from "@/lib/levels.ts";
import { useSettings } from "@/lib/settings.tsx";
import { resolveRange, type TimeRange } from "@/lib/timerange.ts";

const CHART_HEIGHT = 96;
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
function groupColor(
	group: string,
	groupBy: string,
	sorted: string[],
	aliases: Record<string, string>,
): string {
	if (groupBy === "level") {
		return LEVEL_COLORS[canonicalLevel(group, aliases)] ?? "var(--chart-cat-0)";
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
	const { settings } = useSettings();
	const [data, setData] = useState<HistogramResponse | null>(null);
	const [fields, setFields] = useState<string[]>([]);
	const [hover, setHover] = useState<number | null>(null);
	const [hoverY, setHoverY] = useState<number | null>(null);
	const [hoverX, setHoverX] = useState(0);
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
		const timer = setInterval(load, settings.histogramRefreshSec * 1000);
		return () => {
			abort.abort();
			clearInterval(timer);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: range keyed by value
	}, [
		query,
		rangeKey,
		refresh,
		paused,
		groupBy,
		width,
		settings.histogramRefreshSec,
	]);

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
						onMouseLeave={() => {
							setHover(null);
							setHoverY(null);
						}}
						onMouseMove={(event) => {
							const rect = event.currentTarget.getBoundingClientRect();
							const index = Math.floor(
								((event.clientX - rect.left) / rect.width) * buckets.length,
							);
							setHover(Math.max(0, Math.min(buckets.length - 1, index)));
							setHoverY(event.clientY - rect.top);
							setHoverX(event.clientX - rect.left);
						}}
						width={width}
					>
						<defs>
							<pattern
								height="5"
								id="hatch-0"
								patternTransform="rotate(45)"
								patternUnits="userSpaceOnUse"
								width="5"
							>
								<line className="histogram-hatch" x1="0" x2="0" y1="0" y2="5" />
							</pattern>
							<pattern
								height="5"
								id="hatch-1"
								patternTransform="rotate(135)"
								patternUnits="userSpaceOnUse"
								width="5"
							>
								<line className="histogram-hatch" x1="0" x2="0" y1="0" y2="5" />
							</pattern>
						</defs>
						{hover !== null && drag === null && (
							<rect
								className="histogram-hover-band"
								height={CHART_HEIGHT}
								width={slot}
								x={hover * slot}
								y={0}
							/>
						)}
						{maxTotal > 1 &&
							[1, 0.5].map((frac) => {
								const y =
									CHART_HEIGHT - (usableHeight - SEGMENT_GAP) * frac + 1;
								return (
									<g key={frac}>
										<line
											className="histogram-gridline"
											x1={0}
											x2={width}
											y1={y}
											y2={y}
										/>
										<text className="histogram-grid-label" x={2} y={y - 2}>
											{Math.round(maxTotal * frac)}
										</text>
									</g>
								);
							})}
						{hoverY !== null && drag === null && (
							<g className="histogram-crosshair">
								<line x1={0} x2={width} y1={hoverY} y2={hoverY} />
								<text
									className="histogram-grid-label"
									textAnchor="end"
									x={width - 2}
									y={hoverY - 3}
								>
									{Math.max(
										0,
										Math.round(
											((CHART_HEIGHT - hoverY) / (usableHeight - SEGMENT_GAP)) *
												maxTotal,
										),
									)}
								</text>
							</g>
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
								const fill = groupColor(
									group,
									groupBy,
									sortedGroups,
									settings.levelAliases,
								);
								const texture = settings.chartTextures
									? `url(#hatch-${groups.indexOf(group) % 2})`
									: null;
								const el = (
									<g key={group}>
										{isTop ? (
											<path
												d={roundedTopBar(x, y, barWidth, h, 3)}
												fill={fill}
											/>
										) : (
											<rect
												fill={fill}
												height={h}
												width={barWidth}
												x={x}
												y={y}
											/>
										)}
										{texture &&
											(isTop ? (
												<path
													d={roundedTopBar(x, y, barWidth, h, 3)}
													fill={texture}
												/>
											) : (
												<rect
													fill={texture}
													height={h}
													width={barWidth}
													x={x}
													y={y}
												/>
											))}
									</g>
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
							// Keep the panel beside the pointer, flipping at the edge.
							left: `${
								hoverX + 196 > width ? Math.max(0, hoverX - 192) : hoverX + 16
							}px`,
							top: `${Math.max(2, Math.min((hoverY ?? 0) + 10, CHART_HEIGHT - 20))}px`,
						}}
					>
						<div className="histogram-tooltip-time">
							{formatTooltipTime(hovered.start, settings.timezone)}
						</div>
						{groups.map((group) => (
							<div className="histogram-tooltip-row" key={group}>
								<span
									className="histogram-swatch"
									style={{
										background: groupColor(
											group,
											groupBy,
											sortedGroups,
											settings.levelAliases,
										),
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
						{formatShortPoint(data.start, settings.timezone)}
					</span>
				)}
				<div className="histogram-legend">
					{groups.length > 1 &&
						groups.map((group) => (
							<span className="histogram-legend-item" key={group}>
								<span
									className="histogram-swatch"
									style={{
										background: groupColor(
											group,
											groupBy,
											sortedGroups,
											settings.levelAliases,
										),
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
						{formatShortPoint(data.end, settings.timezone)}
					</span>
				)}
			</div>
		</div>
	);
}
