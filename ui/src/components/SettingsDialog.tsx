import { Search, Settings } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { availableTimezones } from "@/lib/datetime.ts";
import { useSettings } from "@/lib/settings.tsx";
import { cn } from "@/lib/utils";

export function SettingsDialog() {
	const { settings, update } = useSettings();
	const [filter, setFilter] = useState("");
	const [open, setOpen] = useState(false);

	const needle = filter.trim().toLowerCase();
	const zones = availableTimezones().filter(
		(z) => !needle || z.toLowerCase().includes(needle),
	);

	const options: [string, string][] = [
		["local", `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`],
		["utc", "UTC"],
	];

	const pick = (timezone: string) => {
		update({ timezone });
	};

	return (
		<Dialog onOpenChange={setOpen} open={open}>
			<DialogTrigger asChild>
				<Button aria-label="Settings" size="icon-sm" variant="ghost">
					<Settings />
				</Button>
			</DialogTrigger>
			<DialogContent className="settings-dialog">
				<DialogHeader>
					<DialogTitle>Settings</DialogTitle>
					<DialogDescription>
						Timezone used for every displayed date.
					</DialogDescription>
				</DialogHeader>

				<div className="settings-options">
					{options.map(([value, label]) => (
						<button
							className={cn(
								"settings-option",
								settings.timezone === value && "settings-option-active",
							)}
							key={value}
							onClick={() => pick(value)}
							type="button"
						>
							{label}
						</button>
					))}
				</div>

				<div className="settings-zone-filter">
					<Search className="field-filter-icon" />
					<Input
						className="field-filter-input"
						placeholder="Filter timezones…"
						value={filter}
						onChange={(event) => setFilter(event.target.value)}
					/>
				</div>
				<div className="settings-zones">
					{zones.map((z) => (
						<button
							className={cn(
								"settings-option",
								settings.timezone === z && "settings-option-active",
							)}
							key={z}
							onClick={() => pick(z)}
							type="button"
						>
							{z}
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
