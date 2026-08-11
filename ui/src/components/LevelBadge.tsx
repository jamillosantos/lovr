import { Badge } from "@/components/ui/badge";
import type { Level } from "@/domain/models.ts";
import { canonicalLevel } from "@/lib/levels.ts";
import { useSettings } from "@/lib/settings.tsx";
import { cn } from "@/lib/utils";

const KNOWN_LEVELS = ["debug", "info", "warning", "error", "fatal", "panic"];

export function LevelBadge({ level }: { level: Level }) {
	const { settings } = useSettings();
	const canonical = canonicalLevel(level, settings.levelAliases);
	const levelClass = KNOWN_LEVELS.includes(canonical)
		? `level-badge-${canonical}`
		: "level-badge-unknown";
	return (
		<Badge variant="outline" className={cn("level-badge", levelClass)}>
			{level || "?"}
		</Badge>
	);
}
