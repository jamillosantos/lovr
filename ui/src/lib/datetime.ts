// Timezone-aware date formatting built on Intl (no extra dependency). The
// timezone setting is "local", "utc" or an IANA zone name.

function zone(timezone: string): string | undefined {
	if (timezone === "local") {
		return undefined;
	}
	if (timezone === "utc") {
		return "UTC";
	}
	return timezone;
}

function parts(
	iso: string,
	timezone: string,
	options: Intl.DateTimeFormatOptions,
): Record<string, string> {
	const fmt = new Intl.DateTimeFormat("en-US", {
		timeZone: zone(timezone),
		...options,
	});
	const out: Record<string, string> = {};
	for (const part of fmt.formatToParts(new Date(iso))) {
		out[part.type] = part.value;
	}
	return out;
}

const BASE: Intl.DateTimeFormatOptions = {
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
	hour: "2-digit",
	minute: "2-digit",
	second: "2-digit",
	hour12: false,
	fractionalSecondDigits: 3,
};

function h(value: string): string {
	// Intl emits "24" for midnight with hour12: false + h23 not forced.
	return value === "24" ? "00" : value;
}

// formatListTimestamp: MM-dd HH:mm:ss.SSS
export function formatListTimestamp(iso: string, timezone: string): string {
	const p = parts(iso, timezone, BASE);
	return `${p.month}-${p.day} ${h(p.hour ?? "")}:${p.minute}:${p.second}.${p.fractionalSecond}`;
}

// formatFullTimestamp: yyyy-MM-dd HH:mm:ss.SSS <offset>
export function formatFullTimestamp(iso: string, timezone: string): string {
	const p = parts(iso, timezone, { ...BASE, timeZoneName: "shortOffset" });
	return `${p.year}-${p.month}-${p.day} ${h(p.hour ?? "")}:${p.minute}:${p.second}.${p.fractionalSecond} ${p.timeZoneName}`;
}

// formatShortPoint: MMM d HH:mm (chart axis / range labels)
export function formatShortPoint(iso: string, timezone: string): string {
	const p = parts(iso, timezone, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: false,
	});
	return `${p.month} ${p.day} ${h(p.hour ?? "")}:${p.minute}`;
}

// formatTooltipTime: MMM d HH:mm:ss
export function formatTooltipTime(iso: string, timezone: string): string {
	const p = parts(iso, timezone, {
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hour12: false,
	});
	return `${p.month} ${p.day} ${h(p.hour ?? "")}:${p.minute}:${p.second}`;
}

// timezones lists the zones offered by the settings dialog.
export function availableTimezones(): string[] {
	try {
		return Intl.supportedValuesOf("timeZone");
	} catch {
		return ["UTC"];
	}
}
