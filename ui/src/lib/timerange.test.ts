import { describe, expect, test } from "bun:test";
import {
	rangeFromParams,
	rangeLabel,
	rangeToParams,
	resolveRange,
	type TimeRange,
} from "./timerange.ts";

const NOW = () => new Date("2026-08-10T12:00:00Z");

describe("resolveRange", () => {
	test("all time resolves to nothing", () => {
		expect(resolveRange(null, NOW)).toEqual({});
	});
	test("presets resolve relative to now", () => {
		expect(resolveRange({ preset: "15m" }, NOW)).toEqual({
			since: "2026-08-10T11:45:00.000Z",
		});
		expect(resolveRange({ preset: "7d" }, NOW)).toEqual({
			since: "2026-08-03T12:00:00.000Z",
		});
	});
	test("absolute ranges pass through", () => {
		expect(
			resolveRange(
				{ from: "2026-08-01T00:00:00Z", to: "2026-08-02T00:00:00Z" },
				NOW,
			),
		).toEqual({
			since: "2026-08-01T00:00:00Z",
			until: "2026-08-02T00:00:00Z",
		});
	});
	test("unknown preset falls back to all time", () => {
		expect(resolveRange({ preset: "nope" }, NOW)).toEqual({});
	});
});

describe("range URL round-trip", () => {
	const roundTrip = (range: TimeRange): TimeRange => {
		const params = new URLSearchParams();
		rangeToParams(range, params);
		return rangeFromParams(params);
	};

	test("all time", () => {
		expect(roundTrip(null)).toBeNull();
	});
	test("preset", () => {
		expect(roundTrip({ preset: "1h" })).toEqual({ preset: "1h" });
	});
	test("absolute", () => {
		const range = {
			from: "2026-08-01T00:00:00.000Z",
			to: "2026-08-02T00:00:00.000Z",
		};
		expect(roundTrip(range)).toEqual(range);
	});
	test("open-ended absolute", () => {
		expect(roundTrip({ from: "2026-08-01T00:00:00.000Z" })).toEqual({
			from: "2026-08-01T00:00:00.000Z",
			to: undefined,
		});
	});
});

describe("rangeLabel", () => {
	test("all time", () => {
		expect(rangeLabel(null)).toBe("All time");
	});
	test("preset", () => {
		expect(rangeLabel({ preset: "24h" })).toBe("Last 24 hours");
	});
});
