import clsx from "clsx";
import type { Level } from "@/domain/models.ts";

const levelClasses: Record<string, string> = {
	debug: "text-level-debug border-level-debug/40",
	info: "text-level-info border-level-info/40",
	warning: "text-level-warning border-level-warning/40",
	error: "text-level-error border-level-error/40",
	fatal: "text-level-fatal border-level-fatal/40",
	panic: "text-level-panic border-level-panic/40",
};

export function LevelBadge({ level }: { level: Level }) {
	return (
		<span
			className={clsx(
				"inline-block w-14 shrink-0 rounded border px-1 py-px text-center font-mono text-[10px] uppercase tracking-wide",
				levelClasses[level] ?? "text-muted-foreground border-border",
			)}
		>
			{level || "?"}
		</span>
	);
}
