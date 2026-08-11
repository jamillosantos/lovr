import { Bookmark, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	loadViews,
	persistViews,
	removeView,
	upsertView,
	type View,
} from "@/lib/views.ts";

export function ViewsMenu({
	currentView,
	onApply,
}: {
	/** Captures the current state as a view (without a name). */
	currentView: () => Omit<View, "name">;
	onApply: (view: View) => void;
}) {
	const [views, setViews] = useState<View[]>(loadViews);
	const [name, setName] = useState("");
	const [open, setOpen] = useState(false);

	const save = () => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		const next = upsertView(views, { ...currentView(), name: trimmed });
		setViews(next);
		persistViews(next);
		setName("");
	};

	const remove = (viewName: string) => {
		const next = removeView(views, viewName);
		setViews(next);
		persistViews(next);
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button aria-label="Views" size="sm" variant="outline">
					<Bookmark />
					Views
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="views-menu">
				{views.length === 0 && (
					<p className="views-empty">No saved views yet.</p>
				)}
				{views.map((view) => (
					<div className="views-row" key={view.name}>
						<button
							className="views-apply"
							onClick={() => {
								onApply(view);
								setOpen(false);
							}}
							type="button"
						>
							{view.name}
						</button>
						<Button
							aria-label={`Delete view ${view.name}`}
							onClick={() => remove(view.name)}
							size="icon-xs"
							variant="ghost"
						>
							<Trash2 />
						</Button>
					</div>
				))}
				<form
					className="views-save"
					onSubmit={(event) => {
						event.preventDefault();
						save();
					}}
				>
					<Input
						className="views-name-input"
						placeholder="Save current as…"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
					<Button
						aria-label="Save view"
						disabled={!name.trim()}
						size="icon-sm"
						type="submit"
						variant="outline"
					>
						<Save />
					</Button>
				</form>
			</PopoverContent>
		</Popover>
	);
}
