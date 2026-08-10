import { Badge } from "@/components/ui/badge";
import type { Level } from "@/domain/models.ts";
import { cn } from "@/lib/utils";

const KNOWN_LEVELS = ["debug", "info", "warning", "error", "fatal", "panic"];

export function LevelBadge({ level }: { level: Level }) {
	const levelClass = KNOWN_LEVELS.includes(level)
		? `level-badge-${level}`
		: "level-badge-unknown";
	return (
		<Badge variant="outline" className={cn("level-badge", levelClass)}>
			{level || "?"}
		</Badge>
	);
}
