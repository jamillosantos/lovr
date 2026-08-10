import { format } from "date-fns";
import { Copy, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Entry, Field } from "@/domain/models.ts";

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

function FieldMenuContent({
	field,
	onAddToSearch,
}: {
	field: Field;
	onAddToSearch?: (field: Field) => void;
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
			<DropdownMenuItem
				onSelect={() => navigator.clipboard.writeText(field.key)}
			>
				<Copy />
				Copy key
			</DropdownMenuItem>
			{scalar && onAddToSearch && (
				<DropdownMenuItem onSelect={() => onAddToSearch(field)}>
					<Search />
					Add to search
				</DropdownMenuItem>
			)}
		</DropdownMenuContent>
	);
}

// ArrayFieldRow renders one menu per item (searchable individually) plus a
// whole-value menu on the key.
function ArrayFieldRow({
	field,
	items,
	onAddToSearch,
}: {
	field: Field;
	items: unknown[];
	onAddToSearch: (field: Field) => void;
}) {
	return (
		<div className="detail-field detail-field-static">
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<dt
						className="detail-field-key detail-field-key-clickable"
						aria-label={`Actions for ${field.key}`}
					>
						{field.key}:
					</dt>
				</DropdownMenuTrigger>
				<FieldMenuContent field={field} />
			</DropdownMenu>
			<dd className="detail-field-value detail-field-items">
				{items.map((item, index) => (
					<DropdownMenu key={`${fieldValueText(item)}-${index}`}>
						<DropdownMenuTrigger asChild>
							<button className="detail-field-item">
								{fieldValueText(item)}
							</button>
						</DropdownMenuTrigger>
						<FieldMenuContent
							field={{ key: field.key, value: item }}
							onAddToSearch={onAddToSearch}
						/>
					</DropdownMenu>
				))}
			</dd>
		</div>
	);
}

function FieldRow({
	field,
	onAddToSearch,
}: {
	field: Field;
	onAddToSearch: (field: Field) => void;
}) {
	if (Array.isArray(field.value)) {
		return (
			<ArrayFieldRow
				field={field}
				items={field.value}
				onAddToSearch={onAddToSearch}
			/>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<div className="detail-field" aria-label={`Actions for ${field.key}`}>
					<dt className="detail-field-key">{field.key}:</dt>
					<dd className="detail-field-value">
						<FieldValue value={field.value} />
					</dd>
				</div>
			</DropdownMenuTrigger>
			<FieldMenuContent field={field} onAddToSearch={onAddToSearch} />
		</DropdownMenu>
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

export function LogDetail({
	entry,
	onClose,
	onAddToSearch,
}: {
	entry: Entry;
	onClose: () => void;
	onAddToSearch: (field: Field) => void;
}) {
	const [fieldFilter, setFieldFilter] = useState("");

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
		<aside className="detail-panel">
			<header className="detail-header">
				<div className="detail-header-meta">
					<div className="detail-header-row">
						<LevelBadge level={entry.level} />
						<time className="detail-time">
							{format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss.SSS XXX")}
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
											onAddToSearch={onAddToSearch}
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
