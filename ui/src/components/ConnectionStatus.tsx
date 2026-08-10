import { Button } from "@/components/ui/button";
import type { ConnectionState } from "@/hooks/useLiveEntries.ts";
import { cn } from "@/lib/utils";

const connectionLabels: Record<ConnectionState, [string, string]> = {
	connecting: ["status-dot-waiting", "Connecting"],
	connected: ["status-dot-live", "Live"],
	closed: ["status-dot-closed", "Disconnected"],
};

// ConnectionStatus shows the stream state and toggles pause/resume on click.
export function ConnectionStatus({
	connection,
	paused,
	count,
	onToggle,
}: {
	connection: ConnectionState;
	paused: boolean;
	count: number;
	onToggle: () => void;
}) {
	const [dotClass, label] = connectionLabels[connection];

	return (
		<Button
			variant="outline"
			size="sm"
			className="status-button"
			onClick={onToggle}
			title={paused ? "Resume the live stream" : "Pause the view"}
		>
			<span
				className={cn("status-dot", paused ? "status-dot-waiting" : dotClass)}
			/>
			{paused ? "Paused" : label}
			<span className="status-count" title={`${count} entries loaded`}>
				{count}
			</span>
		</Button>
	);
}
