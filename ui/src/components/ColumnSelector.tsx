import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Columns3, GripVertical, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { fetchFields } from "@/lib/api.ts";
import { DEFAULT_COLUMNS } from "@/lib/query.ts";

function ColumnRow({
	column,
	checked,
	removable,
	onToggle,
}: {
	column: string;
	checked: boolean;
	removable: boolean;
	onToggle: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable({ id: column });

	return (
		<div
			className="column-row"
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<button
				className="column-drag"
				aria-label={`Reorder ${column}`}
				{...attributes}
				{...listeners}
			>
				<GripVertical />
			</button>
			<Checkbox
				checked={checked}
				disabled={checked && !removable}
				id={`col-${column}`}
				onCheckedChange={onToggle}
			/>
			<label className="column-row-label" htmlFor={`col-${column}`}>
				{column}
			</label>
		</div>
	);
}

export function ColumnSelector({
	columns,
	onChange,
}: {
	columns: string[];
	onChange: (columns: string[]) => void;
}) {
	// Full display order of every known column; the checked subset, in this
	// order, is the visible column list.
	const [order, setOrder] = useState<string[]>(() => [...columns]);
	const [filter, setFilter] = useState("");

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	useEffect(() => {
		const abort = new AbortController();
		fetchFields(abort.signal)
			.then((fields) => {
				const known = [...DEFAULT_COLUMNS, ...fields];
				setOrder((current) => [
					...current,
					...known.filter((f) => !current.includes(f)),
				]);
			})
			.catch(() => {});
		return () => abort.abort();
	}, []);

	// Columns can change from outside (URL navigation); keep them present.
	const fullOrder = [...order, ...columns.filter((c) => !order.includes(c))];

	const needle = filter.trim().toLowerCase();
	const visible = needle
		? fullOrder.filter((c) => c.toLowerCase().includes(needle))
		: fullOrder;

	const toggle = (column: string) => {
		const next = columns.includes(column)
			? columns.filter((c) => c !== column)
			: fullOrder.filter((c) => columns.includes(c) || c === column);
		onChange(next);
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) {
			return;
		}
		const from = fullOrder.indexOf(String(active.id));
		const to = fullOrder.indexOf(String(over.id));
		if (from < 0 || to < 0) {
			return;
		}
		const reordered = arrayMove(fullOrder, from, to);
		setOrder(reordered);
		if (columns.includes(String(active.id))) {
			onChange(reordered.filter((c) => columns.includes(c)));
		}
	};

	return (
		<Popover onOpenChange={() => setFilter("")}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" aria-label="Choose columns">
					<Columns3 />
					Columns
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="column-selector">
				<div className="column-selector-filter">
					<Search className="field-filter-icon" />
					<Input
						className="field-filter-input"
						placeholder="Filter columns…"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
					/>
				</div>
				<div className="column-available-list">
					{visible.length === 0 && (
						<p className="column-selector-empty">No columns match.</p>
					)}
					<DndContext
						collisionDetection={closestCenter}
						onDragEnd={onDragEnd}
						sensors={sensors}
					>
						<SortableContext
							items={visible}
							strategy={verticalListSortingStrategy}
						>
							{visible.map((column) => (
								<ColumnRow
									checked={columns.includes(column)}
									column={column}
									key={column}
									onToggle={() => toggle(column)}
									removable={columns.length > 1}
								/>
							))}
						</SortableContext>
					</DndContext>
				</div>
			</PopoverContent>
		</Popover>
	);
}
