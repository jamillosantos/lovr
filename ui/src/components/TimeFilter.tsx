import { Clock } from "lucide-react";
import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { useSettings } from "@/lib/settings.tsx";
import {
	isPreset,
	PRESETS,
	rangeLabel,
	type TimeRange,
} from "@/lib/timerange.ts";
import { cn } from "@/lib/utils";

// combine merges a picked day with an HH:mm time into an ISO instant.
function combine(day: Date, time: string, fallback: string): string {
	const [h, m] = (time || fallback).split(":").map(Number);
	const result = new Date(day);
	result.setHours(h ?? 0, m ?? 0, 0, 0);
	return result.toISOString();
}

export function TimeFilter({
	range,
	onChange,
}: {
	range: TimeRange;
	onChange: (range: TimeRange) => void;
}) {
	const { settings } = useSettings();
	const [open, setOpen] = useState(false);
	const [days, setDays] = useState<DateRange | undefined>();
	const [fromTime, setFromTime] = useState("");
	const [toTime, setToTime] = useState("");

	const applyCustom = () => {
		if (!days?.from) {
			return;
		}
		const from = combine(days.from, fromTime, "00:00");
		const to = combine(days.to ?? days.from, toTime, "23:59");
		onChange({ from, to });
		setOpen(false);
	};

	const pick = (next: TimeRange) => {
		onChange(next);
		setOpen(false);
	};

	return (
		<Popover onOpenChange={setOpen} open={open}>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm" aria-label="Time range">
					<Clock />
					{rangeLabel(range, settings.timezone)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="time-filter">
				<div className="time-filter-presets">
					<button
						className={cn(
							"time-filter-preset",
							range === null && "time-filter-preset-active",
						)}
						onClick={() => pick(null)}
						type="button"
					>
						All time
					</button>
					{PRESETS.map((preset) => (
						<button
							className={cn(
								"time-filter-preset",
								isPreset(range) &&
									range.preset === preset.id &&
									"time-filter-preset-active",
							)}
							key={preset.id}
							onClick={() => pick({ preset: preset.id })}
							type="button"
						>
							{preset.label}
						</button>
					))}
				</div>
				<Separator orientation="vertical" className="time-filter-separator" />
				<div className="time-filter-custom">
					<Calendar
						mode="range"
						numberOfMonths={1}
						onSelect={setDays}
						selected={days}
					/>
					<div className="time-filter-times">
						<label className="time-filter-time">
							<span>From</span>
							<Input
								className="time-filter-time-input"
								onChange={(event) => setFromTime(event.target.value)}
								type="time"
								value={fromTime}
							/>
						</label>
						<label className="time-filter-time">
							<span>To</span>
							<Input
								className="time-filter-time-input"
								onChange={(event) => setToTime(event.target.value)}
								type="time"
								value={toTime}
							/>
						</label>
					</div>
					<Button
						className="time-filter-apply"
						disabled={!days?.from}
						onClick={applyCustom}
						size="sm"
					>
						Apply range
					</Button>
				</div>
			</PopoverContent>
		</Popover>
	);
}
