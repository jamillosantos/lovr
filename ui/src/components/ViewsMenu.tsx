import { Bookmark, Check, Save, Trash2 } from "lucide-react";
import { useState } from "react";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
	loadViews,
	persistViews,
	removeView,
	sameViewState,
	upsertView,
	type View,
} from "@/lib/views.ts";

export function ViewsMenu({
	currentView,
	onApply,
	activeName,
	onActiveChange,
}: {
	/** Captures the current state as a view (without a name). */
	currentView: () => Omit<View, "name">;
	onApply: (view: View) => void;
	/** Name of the last applied/saved view, if any. */
	activeName: string | null;
	onActiveChange: (name: string | null) => void;
}) {
	const [views, setViews] = useState<View[]>(loadViews);
	const [name, setName] = useState("");
	const [open, setOpen] = useState(false);
	const [confirmUpdate, setConfirmUpdate] = useState(false);

	const active = activeName
		? views.find((v) => v.name === activeName)
		: undefined;
	// The active view is dirty when the current state drifted from what was
	// saved — that is when overriding it makes sense.
	const dirty = active !== undefined && !sameViewState(currentView(), active);

	const save = () => {
		const trimmed = name.trim();
		if (!trimmed) {
			return;
		}
		const next = upsertView(views, { ...currentView(), name: trimmed });
		setViews(next);
		persistViews(next);
		onActiveChange(trimmed);
		setName("");
	};

	const updateActive = () => {
		if (!active) {
			return;
		}
		const next = upsertView(views, { ...currentView(), name: active.name });
		setViews(next);
		persistViews(next);
	};

	const remove = (viewName: string) => {
		const next = removeView(views, viewName);
		setViews(next);
		persistViews(next);
		if (viewName === activeName) {
			onActiveChange(null);
		}
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button aria-label="Views" size="sm" variant="outline">
					<Bookmark />
					<span className="views-trigger-label">{activeName ?? "Views"}</span>
					{dirty && (
						<span
							className="views-dirty-dot"
							title="Changed since the view was applied"
						/>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="views-menu">
				{active && dirty && (
					<Button
						className="views-update"
						onClick={() => {
							setOpen(false);
							setConfirmUpdate(true);
						}}
						size="sm"
						variant="secondary"
					>
						<Save />
						<span className="views-update-label">Update “{active.name}”</span>
					</Button>
				)}
				{views.length === 0 && (
					<p className="views-empty">No saved views yet.</p>
				)}
				{views.map((view) => (
					<div
						className={cn(
							"views-row",
							view.name === activeName && "views-row-active",
						)}
						key={view.name}
					>
						<button
							className="views-apply"
							onClick={() => {
								onApply(view);
								setOpen(false);
							}}
							type="button"
						>
							<span className="views-check">
								{view.name === activeName && <Check />}
							</span>
							<span className="views-apply-name">{view.name}</span>
							{view.q && <span className="views-apply-q">{view.q}</span>}
						</button>
						<Button
							aria-label={`Delete view ${view.name}`}
							className="views-delete"
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
			<AlertDialog onOpenChange={setConfirmUpdate} open={confirmUpdate}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Update “{activeName}”?</AlertDialogTitle>
						<AlertDialogDescription>
							The saved view will be overwritten with the current search,
							time range, columns, sorting and chart grouping. This cannot
							be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={updateActive}>
							Update view
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Popover>
	);
}
