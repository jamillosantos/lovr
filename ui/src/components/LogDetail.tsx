import { Copy, EyeOff, Search, SearchX, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Entry, Field } from "@/domain/models.ts";
import { formatFullTimestamp } from "@/lib/datetime.ts";
import { useSettings } from "@/lib/settings.tsx";

function FieldValue({ value }: { value: unknown }) {
	if (typeof value === "object" && value !== null) {
		return (
			<pre className="detail-value-block">{JSON.stringify(value, null, 2)}</pre>
		);
	}
	return <span className="detail-value">{String(value)}</span>;
}

function fieldValueText(value: unknown): string {
	if (typeof value === "object" && value !== null) {
		return JSON.stringify(value, null, 2);
	}
	return String(value);
}

export type SearchAction = "add" | "exclude" | "add-key" | "exclude-key";

// KeyMenuContent holds key-oriented actions, opened by clicking a field key.
function KeyMenuContent({
	field,
	onSearchAction,
}: {
	field: Field;
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	return (
		<DropdownMenuContent align="start">
			<DropdownMenuItem
				onSelect={() => navigator.clipboard.writeText(field.key)}
			>
				<Copy />
				Copy key
			</DropdownMenuItem>
			<DropdownMenuItem
				onSelect={() =>
					navigator.clipboard.writeText(fieldValueText(field.value))
				}
			>
				<Copy />
				Copy value
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem onSelect={() => onSearchAction(field, "add-key")}>
				<Search />
				Add to search
			</DropdownMenuItem>
			<DropdownMenuItem onSelect={() => onSearchAction(field, "exclude-key")}>
				<EyeOff />
				Exclude entries with key
			</DropdownMenuItem>
		</DropdownMenuContent>
	);
}

// ValueMenuContent holds value-oriented actions, opened by clicking a value
// (or an array item).
function ValueMenuContent({
	field,
	onSearchAction,
}: {
	field: Field;
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	const scalar = typeof field.value !== "object" || field.value === null;

	return (
		<DropdownMenuContent align="start">
			<DropdownMenuItem
				onSelect={() =>
					navigator.clipboard.writeText(fieldValueText(field.value))
				}
			>
				<Copy />
				Copy value
			</DropdownMenuItem>
			{scalar && <DropdownMenuSeparator />}
			{scalar && (
				<DropdownMenuItem onSelect={() => onSearchAction(field, "add")}>
					<Search />
					Add to search
				</DropdownMenuItem>
			)}
			{scalar && (
				<DropdownMenuItem onSelect={() => onSearchAction(field, "exclude")}>
					<SearchX />
					Exclude value
				</DropdownMenuItem>
			)}
		</DropdownMenuContent>
	);
}

// FieldKey renders a field key as the trigger of the key menu.
function FieldKey({
	field,
	onSearchAction,
}: {
	field: Field;
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<dt
					className="detail-field-key detail-field-key-clickable"
					aria-label={`Actions for ${field.key}`}
				>
					{field.key}:
				</dt>
			</DropdownMenuTrigger>
			<KeyMenuContent field={field} onSearchAction={onSearchAction} />
		</DropdownMenu>
	);
}

// ArrayFieldRow renders one menu per item (searchable individually) plus a
// whole-value menu on the key.
function ArrayFieldRow({
	field,
	items,
	onSearchAction,
}: {
	field: Field;
	items: unknown[];
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	return (
		<div className="detail-field detail-field-static">
			<FieldKey field={field} onSearchAction={onSearchAction} />
			<dd className="detail-field-value detail-field-items">
				{items.map((item, index) => (
					<DropdownMenu key={`${fieldValueText(item)}-${index}`}>
						<DropdownMenuTrigger asChild>
							<button className="detail-field-item">
								{fieldValueText(item)}
							</button>
						</DropdownMenuTrigger>
						<ValueMenuContent
							field={{ key: field.key, value: item }}
							onSearchAction={onSearchAction}
						/>
					</DropdownMenu>
				))}
			</dd>
		</div>
	);
}

function FieldRow({
	field,
	onSearchAction,
}: {
	field: Field;
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	if (Array.isArray(field.value)) {
		return (
			<ArrayFieldRow
				field={field}
				items={field.value}
				onSearchAction={onSearchAction}
			/>
		);
	}

	return (
		<div className="detail-field detail-field-static">
			<FieldKey field={field} onSearchAction={onSearchAction} />
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<dd
						className="detail-field-value detail-field-value-clickable"
						aria-label={`Actions for the value of ${field.key}`}
					>
						<FieldValue value={field.value} />
					</dd>
				</DropdownMenuTrigger>
				<ValueMenuContent field={field} onSearchAction={onSearchAction} />
			</DropdownMenu>
		</div>
	);
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section>
			<h3 className="detail-section-title">{title}</h3>
			{children}
		</section>
	);
}

const MIN_DETAIL_WIDTH = 320;
const MAX_DETAIL_WIDTH = 1200;

export function LogDetail({
	entry,
	onClose,
	onSearchAction,
}: {
	entry: Entry;
	onClose: () => void;
	onSearchAction: (field: Field, action: SearchAction) => void;
}) {
	const { settings, update } = useSettings();
	const [fieldFilter, setFieldFilter] = useState("");

	// Width during a drag lives locally; it persists to settings on mouseup.
	const [width, setWidth] = useState(settings.detailWidth);
	const widthRef = useRef(width);
	widthRef.current = width;
	useEffect(() => {
		setWidth(settings.detailWidth);
	}, [settings.detailWidth]);

	const startResize = (event: React.MouseEvent<HTMLSpanElement>) => {
		event.preventDefault();
		const panel = event.currentTarget.parentElement;
		if (!panel) {
			return;
		}
		const startX = event.clientX;
		const startWidth = panel.getBoundingClientRect().width;
		const onMove = (move: MouseEvent) => {
			// The handle sits on the left edge: dragging left grows the panel.
			const next = Math.max(
				MIN_DETAIL_WIDTH,
				Math.min(MAX_DETAIL_WIDTH, startWidth + startX - move.clientX),
			);
			setWidth(Math.round(next));
		};
		const onUp = () => {
			window.removeEventListener("mousemove", onMove);
			window.removeEventListener("mouseup", onUp);
			update({ detailWidth: widthRef.current });
		};
		window.addEventListener("mousemove", onMove);
		window.addEventListener("mouseup", onUp);
	};

	const resetWidth = () => {
		setWidth(0);
		update({ detailWidth: 0 });
	};

	const sortedFields = useMemo(
		() => [...(entry.fields ?? [])].sort((a, b) => a.key.localeCompare(b.key)),
		[entry.fields],
	);

	const visibleFields = useMemo(() => {
		const needle = fieldFilter.trim().toLowerCase();
		if (!needle) {
			return sortedFields;
		}
		return sortedFields.filter(
			(field) =>
				field.key.toLowerCase().includes(needle) ||
				fieldValueText(field.value).toLowerCase().includes(needle),
		);
	}, [sortedFields, fieldFilter]);

	return (
		<aside
			className="detail-panel"
			style={width > 0 ? { width, maxWidth: "none" } : undefined}
		>
			<span
				aria-hidden
				className="detail-resize"
				onDoubleClick={resetWidth}
				onMouseDown={startResize}
			/>
			<header className="detail-header">
				<div className="detail-header-meta">
					<div className="detail-header-row">
						<LevelBadge level={entry.level} />
						<time className="detail-time">
							{formatFullTimestamp(
								entry.timestamp,
								settings.timezone,
								settings,
							)}
						</time>
					</div>
					<p className="detail-message">{entry.message}</p>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close details"
				>
					<X />
				</Button>
			</header>
			<Separator />

			<ScrollArea className="log-scroll">
				<div className="detail-body">
					{sortedFields.length > 0 && (
						<Section title="Fields">
							<div className="detail-fields-filter">
								<Search className="field-filter-icon" />
								<Input
									className="field-filter-input"
									placeholder="Filter fields…"
									value={fieldFilter}
									onChange={(event) => setFieldFilter(event.target.value)}
								/>
							</div>
							{visibleFields.length > 0 ? (
								<dl className="detail-fields">
									{visibleFields.map((field) => (
										<FieldRow
											field={field}
											key={field.key}
											onSearchAction={onSearchAction}
										/>
									))}
								</dl>
							) : (
								<p className="detail-fields-empty">No fields match.</p>
							)}
						</Section>
					)}

					{entry.caller && (
						<Section title="Caller">
							<p className="detail-caller">{entry.caller}</p>
						</Section>
					)}

					{entry.stacktrace && (
						<Section title="Stacktrace">
							<pre className="detail-stacktrace">{entry.stacktrace}</pre>
						</Section>
					)}
				</div>
			</ScrollArea>
		</aside>
	);
}
