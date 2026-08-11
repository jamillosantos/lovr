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
	total,
	onToggle,
}: {
	connection: ConnectionState;
	paused: boolean;
	count: number;
	/** Total matches for the current query; null while unknown. */
	total: number | null;
	onToggle: () => void;
}) {
	const [dotClass, label] = connectionLabels[connection];
	const detail =
		total !== null
			? `${count.toLocaleString()} of ${total.toLocaleString()} matching entries loaded`
			: `${count.toLocaleString()} entries loaded`;

	return (
		<Button
			variant="outline"
			size="sm"
			className="status-button"
			onClick={onToggle}
			title={`${detail}. ${paused ? "Click to resume the live stream." : "Click to pause the view."}`}
		>
			<span
				className={cn("status-dot", paused ? "status-dot-waiting" : dotClass)}
			/>
			{paused ? "Paused" : label}
			<span className="status-count">
				{count.toLocaleString()}
				{total !== null && (
					<span className="status-total"> / {total.toLocaleString()}</span>
				)}
			</span>
		</Button>
	);
}
