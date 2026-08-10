import type { ConnectionState } from "@/hooks/useLiveEntries.ts";
import { cn } from "@/lib/utils";

const connectionLabels: Record<ConnectionState, [string, string]> = {
	connecting: ["status-dot-waiting", "Connecting"],
	connected: ["status-dot-live", "Live"],
	closed: ["status-dot-closed", "Disconnected"],
};

export function ConnectionStatus({
	connection,
	paused,
	count,
}: {
	connection: ConnectionState;
	paused: boolean;
	count: number;
}) {
	const [dotClass, label] = connectionLabels[connection];

	return (
		<div className="status-indicator">
			<span
				className={cn("status-dot", paused ? "status-dot-waiting" : dotClass)}
			/>
			{paused ? "Paused" : label}
			<span className="status-count">{count}</span>
		</div>
	);
}
