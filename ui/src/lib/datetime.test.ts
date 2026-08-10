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
});
