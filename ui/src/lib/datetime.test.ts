import { describe, expect, test } from "bun:test";
import {
	formatFullTimestamp,
	formatListTimestamp,
	formatShortPoint,
	formatTooltipTime,
} from "./datetime.ts";

const ISO = "2026-08-10T18:07:03.123Z";

describe("timezone formatting", () => {
	test("utc", () => {
		expect(formatListTimestamp(ISO, "utc")).toBe("08-10 18:07:03.123");
		expect(formatFullTimestamp(ISO, "utc")).toBe(
			"2026-08-10 18:07:03.123 GMT+0",
		);
		expect(formatShortPoint(ISO, "utc")).toBe("Aug 10 18:07");
		expect(formatTooltipTime(ISO, "utc")).toBe("Aug 10 18:07:03");
	});

	test("named zone", () => {
		expect(formatListTimestamp(ISO, "America/Sao_Paulo")).toBe(
			"08-10 15:07:03.123",
		);
		expect(formatFullTimestamp(ISO, "America/Sao_Paulo")).toContain("GMT-3");
		expect(formatListTimestamp(ISO, "Asia/Tokyo")).toBe("08-11 03:07:03.123");
	});

	test("midnight stays 00", () => {
		expect(formatListTimestamp("2026-08-10T00:00:00.000Z", "utc")).toBe(
			"08-10 00:00:00.000",
		);
	});

	test("12-hour clock", () => {
		expect(formatListTimestamp(ISO, "utc", { hour12: true })).toBe(
			"08-10 06:07:03.123 PM",
		);
	});

	test("no subseconds", () => {
		expect(formatListTimestamp(ISO, "utc", { subsecond: false })).toBe(
			"08-10 18:07:03",
		);
	});

	test("hide date for today", () => {
		const now = () => new Date("2026-08-10T20:00:00Z");
		expect(formatListTimestamp(ISO, "utc", { hideDateToday: true }, now)).toBe(
			"18:07:03.123",
		);
		// A different day keeps the date.
		const later = () => new Date("2026-08-11T20:00:00Z");
		expect(
			formatListTimestamp(ISO, "utc", { hideDateToday: true }, later),
		).toBe("08-10 18:07:03.123");
	});
});

import { DEFAULT_SETTINGS, sanitizeSettings } from "./settings.tsx";

describe("sanitizeSettings", () => {
	test("merges valid values over defaults", () => {
		const out = sanitizeSettings({
			timezone: "utc",
			historyPageSize: 50,
			density: "compact",
			levelAliases: { WARN: "WARNING" },
			junk: "ignored",
		});
		expect(out.timezone).toBe("utc");
		expect(out.historyPageSize).toBe(50);
		expect(out.density).toBe("compact");
		expect(out.levelAliases).toEqual({ warn: "warning" });
		expect(out.followMode).toBe(DEFAULT_SETTINGS.followMode);
	});
	test("rejects invalid types", () => {
		const out = sanitizeSettings({
			historyPageSize: -5,
			hour12: "yes",
			density: "weird",
		});
		expect(out.historyPageSize).toBe(DEFAULT_SETTINGS.historyPageSize);
		expect(out.hour12).toBe(false);
		expect(out.density).toBe("comfortable");
	});
	test("non-object input yields defaults", () => {
		expect(sanitizeSettings("nope")).toEqual({
			...DEFAULT_SETTINGS,
			levelAliases: { ...DEFAULT_SETTINGS.levelAliases },
		});
	});
});

import { canonicalLevel } from "./levels.ts";

describe("canonicalLevel", () => {
	test("aliases resolve", () => {
		const aliases = { warn: "warning", err: "error" };
		expect(canonicalLevel("warn", aliases)).toBe("warning");
		expect(canonicalLevel("WARN", aliases)).toBe("warning");
		expect(canonicalLevel("info", aliases)).toBe("info");
	});
});
