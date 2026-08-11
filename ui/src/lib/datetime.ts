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

export interface FormatOptions {
	/** 12-hour clock with AM/PM suffix. */
	hour12?: boolean;
	/** Omit the date part for entries from today. */
	hideDateToday?: boolean;
	/** Include millisecond precision. */
	subsecond?: boolean;
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

function timeOf(
	p: Record<string, string>,
	{ hour12 = false, subsecond = true }: FormatOptions,
): string {
	let out = `${h(p.hour ?? "")}:${p.minute}:${p.second}`;
	if (subsecond) {
		out += `.${p.fractionalSecond}`;
	}
	if (hour12 && p.dayPeriod) {
		out += ` ${p.dayPeriod}`;
	}
	return out;
}

// isToday reports whether the instant falls on today's date in the timezone.
function isToday(iso: string, timezone: string, now: () => Date): boolean {
	const opts: Intl.DateTimeFormatOptions = {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	};
	const a = parts(iso, timezone, opts);
	const b = parts(now().toISOString(), timezone, opts);
	return a.year === b.year && a.month === b.month && a.day === b.day;
}

// formatListTimestamp: MM-dd HH:mm:ss.SSS (parts subject to options).
export function formatListTimestamp(
	iso: string,
	timezone: string,
	options: FormatOptions = {},
	now: () => Date = () => new Date(),
): string {
	const p = parts(iso, timezone, { ...BASE, hour12: options.hour12 ?? false });
	const time = timeOf(p, options);
	if (options.hideDateToday && isToday(iso, timezone, now)) {
		return time;
	}
	return `${p.month}-${p.day} ${time}`;
}

// formatFullTimestamp: yyyy-MM-dd HH:mm:ss.SSS <offset>
export function formatFullTimestamp(
	iso: string,
	timezone: string,
	options: FormatOptions = {},
): string {
	const p = parts(iso, timezone, {
		...BASE,
		hour12: options.hour12 ?? false,
		timeZoneName: "shortOffset",
	});
	return `${p.year}-${p.month}-${p.day} ${timeOf(p, options)} ${p.timeZoneName}`;
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
