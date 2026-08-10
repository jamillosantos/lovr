import { Columns3, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { fetchFields } from "@/lib/api.ts";
import { DEFAULT_COLUMNS } from "@/lib/query.ts";

export function ColumnSelector({
	columns,
	onChange,
}: {
	columns: string[];
	onChange: (columns: string[]) => void;
}) {
	const [fields, setFields] = useState<string[]>([]);
	const [filter, setFilter] = useState("");

	useEffect(() => {
		const abort = new AbortController();
		fetchFields(abort.signal)
			.then(setFields)
			.catch(() => {});
		return () => abort.abort();
	}, []);

	const available = [
		...DEFAULT_COLUMNS,
		...fields.filter((f) => !DEFAULT_COLUMNS.includes(f)),
	];
	const needle = filter.trim().toLowerCase();
	const visible = needle
		? available.filter((c) => c.toLowerCase().includes(needle))
		: available;

	const toggle = (column: string) => {
		const next = columns.includes(column)
			? columns.filter((c) => c !== column)
			: [...columns, column];
		onChange(next);
	};

	return (
		<DropdownMenu onOpenChange={() => setFilter("")}>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" aria-label="Choose columns">
					<Columns3 />
					Columns
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="column-selector">
				<DropdownMenuLabel>Columns</DropdownMenuLabel>
				<div className="column-selector-filter">
					<Search className="field-filter-icon" />
					<Input
						autoFocus
						className="field-filter-input"
						placeholder="Filter columns…"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
						// Keep typing from triggering the menu's typeahead focus.
						onKeyDown={(event) => event.stopPropagation()}
					/>
				</div>
				<DropdownMenuSeparator />
				{visible.length === 0 && (
					<DropdownMenuLabel className="column-selector-empty">
						No columns match.
					</DropdownMenuLabel>
				)}
				{visible.map((column) => (
					<DropdownMenuCheckboxItem
						checked={columns.includes(column)}
						disabled={columns.includes(column) && columns.length === 1}
						key={column}
						onCheckedChange={() => toggle(column)}
						onSelect={(event) => event.preventDefault()}
					>
						{column}
					</DropdownMenuCheckboxItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
