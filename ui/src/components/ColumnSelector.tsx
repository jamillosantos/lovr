import { Columns3 } from "lucide-react";
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

	const toggle = (column: string) => {
		const next = columns.includes(column)
			? columns.filter((c) => c !== column)
			: [...columns, column];
		onChange(next);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" aria-label="Choose columns">
					<Columns3 />
					Columns
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="column-selector">
				<DropdownMenuLabel>Columns</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{available.map((column) => (
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
