import { Download, Search, Settings, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { availableTimezones } from "@/lib/datetime.ts";
import {
	type Settings as SettingsType,
	sanitizeSettings,
	useSettings,
} from "@/lib/settings.tsx";
import { PRESETS } from "@/lib/timerange.ts";
import { cn } from "@/lib/utils";

function Toggle({
	label,
	checked,
	onChange,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
}) {
	return (
		<label className="settings-toggle">
			<Checkbox
				checked={checked}
				onCheckedChange={(v) => onChange(v === true)}
			/>
			{label}
		</label>
	);
}

function NumberField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
}) {
	return (
		<label className="settings-number">
			<span>{label}</span>
			<Input
				className="settings-number-input"
				min={1}
				onChange={(event) => {
					const parsed = Number(event.target.value);
					if (Number.isFinite(parsed) && parsed > 0) {
						onChange(parsed);
					}
				}}
				type="number"
				value={value}
			/>
		</label>
	);
}

function aliasesToText(aliases: Record<string, string>): string {
	return Object.entries(aliases)
		.map(([k, v]) => `${k}=${v}`)
		.join("\n");
}

function textToAliases(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const [k, v] = line.split("=").map((s) => s.trim().toLowerCase());
		if (k && v) {
			out[k] = v;
		}
	}
	return out;
}

export function SettingsDialog() {
	const { settings, update, replace } = useSettings();
	const [filter, setFilter] = useState("");
	const [open, setOpen] = useState(false);
	const [aliasText, setAliasText] = useState(() =>
		aliasesToText(settings.levelAliases),
	);
	const fileRef = useRef<HTMLInputElement>(null);

	const needle = filter.trim().toLowerCase();
	const zones = availableTimezones().filter(
		(z) => !needle || z.toLowerCase().includes(needle),
	);

	const tzOptions: [string, string][] = [
		["local", `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`],
		["utc", "UTC"],
	];

	const exportSettings = () => {
		const blob = new Blob([JSON.stringify(settings, null, 2)], {
			type: "application/json",
		});
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "lovr-settings.json";
		a.click();
		URL.revokeObjectURL(url);
	};

	const importSettings = (file: File) => {
		file.text().then((text) => {
			try {
				const next: SettingsType = sanitizeSettings(JSON.parse(text));
				replace(next);
				setAliasText(aliasesToText(next.levelAliases));
			} catch {
				// Ignore malformed files.
			}
		});
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
						Stored in this browser (localStorage).
					</DialogDescription>
				</DialogHeader>

				<Tabs className="settings-body" defaultValue="display">
					<TabsList className="settings-tabs">
						<TabsTrigger value="display">Display</TabsTrigger>
						<TabsTrigger value="stream">Stream</TabsTrigger>
						<TabsTrigger value="search">Search & data</TabsTrigger>
					</TabsList>
					<TabsContent className="settings-tab" value="display">
						<div className="settings-options">
							{(["system", "light", "dark"] as const).map((t) => (
								<button
									className={cn(
										"settings-option",
										settings.theme === t && "settings-option-active",
									)}
									key={t}
									onClick={() => update({ theme: t })}
									type="button"
								>
									{t === "system"
										? "System theme"
										: `${t[0]?.toUpperCase()}${t.slice(1)} theme`}
								</button>
							))}
						</div>
						<Toggle
							checked={settings.showChart}
							label="Show the histogram chart"
							onChange={(showChart) => update({ showChart })}
						/>
						<div className="settings-options">
							{tzOptions.map(([value, label]) => (
								<button
									className={cn(
										"settings-option",
										settings.timezone === value && "settings-option-active",
									)}
									key={value}
									onClick={() => update({ timezone: value })}
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
						{needle && (
							<div className="settings-zones">
								{zones.map((z) => (
									<button
										className={cn(
											"settings-option",
											settings.timezone === z && "settings-option-active",
										)}
										key={z}
										onClick={() => update({ timezone: z })}
										type="button"
									>
										{z}
									</button>
								))}
							</div>
						)}

						<Toggle
							checked={settings.hour12}
							label="12-hour clock"
							onChange={(hour12) => update({ hour12 })}
						/>
						<Toggle
							checked={settings.hideDateToday}
							label="Hide the date for entries from today"
							onChange={(hideDateToday) => update({ hideDateToday })}
						/>
						<Toggle
							checked={settings.subsecond}
							label="Millisecond precision"
							onChange={(subsecond) => update({ subsecond })}
						/>
						<Toggle
							checked={settings.wrapMessages}
							label="Wrap long messages"
							onChange={(wrapMessages) => update({ wrapMessages })}
						/>
						<Toggle
							checked={settings.chartTextures}
							label="Chart textures (colorblind assist)"
							onChange={(chartTextures) => update({ chartTextures })}
						/>
						<div className="settings-options">
							{(["comfortable", "compact"] as const).map((d) => (
								<button
									className={cn(
										"settings-option",
										settings.density === d && "settings-option-active",
									)}
									key={d}
									onClick={() => update({ density: d })}
									type="button"
								>
									{d === "comfortable" ? "Comfortable rows" : "Compact rows"}
								</button>
							))}
						</div>
					</TabsContent>

					<TabsContent className="settings-tab" value="stream">
						<NumberField
							label="History page size"
							onChange={(historyPageSize) => update({ historyPageSize })}
							value={settings.historyPageSize}
						/>
						<NumberField
							label="Chart refresh (seconds)"
							onChange={(histogramRefreshSec) =>
								update({ histogramRefreshSec })
							}
							value={settings.histogramRefreshSec}
						/>
						<Toggle
							checked={settings.followMode}
							label="Follow mode: snap to newest entries"
							onChange={(followMode) => update({ followMode })}
						/>
						<Toggle
							checked={settings.autoPauseOnScroll}
							label="Auto-pause when scrolling (resumes at top)"
							onChange={(autoPauseOnScroll) => update({ autoPauseOnScroll })}
						/>
					</TabsContent>

					<TabsContent className="settings-tab" value="search">
						<div className="settings-options settings-options-wrap">
							<button
								className={cn(
									"settings-option",
									settings.defaultRange === "all" && "settings-option-active",
								)}
								onClick={() => update({ defaultRange: "all" })}
								type="button"
							>
								Default: All time
							</button>
							{PRESETS.map((preset) => (
								<button
									className={cn(
										"settings-option",
										settings.defaultRange === preset.id &&
											"settings-option-active",
									)}
									key={preset.id}
									onClick={() => update({ defaultRange: preset.id })}
									type="button"
								>
									{preset.label}
								</button>
							))}
						</div>
						<label className="settings-aliases">
							<span>Level aliases (alias=level per line)</span>
							<textarea
								className="settings-aliases-input"
								onChange={(event) => {
									setAliasText(event.target.value);
									update({ levelAliases: textToAliases(event.target.value) });
								}}
								rows={3}
								value={aliasText}
							/>
						</label>
					</TabsContent>

					<div className="settings-io">
						<Button onClick={exportSettings} size="sm" variant="outline">
							<Download />
							Export JSON
						</Button>
						<Button
							onClick={() => fileRef.current?.click()}
							size="sm"
							variant="outline"
						>
							<Upload />
							Restore
						</Button>
						<input
							accept="application/json"
							className="settings-file"
							onChange={(event) => {
								const file = event.target.files?.[0];
								if (file) {
									importSettings(file);
								}
								event.target.value = "";
							}}
							ref={fileRef}
							type="file"
						/>
					</div>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
