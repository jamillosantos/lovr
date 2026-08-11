import { describe, expect, test } from "bun:test";
import {
	removeView,
	sameViewState,
	sanitizeViews,
	upsertView,
	type View,
} from "./views.ts";

const view = (name: string, q = ""): View => ({
	name,
	q,
	range: null,
	cols: ["timestamp", "level", "message"],
	columnWidths: {},
	sortAsc: false,
	groupBy: "level",
});

describe("sanitizeViews", () => {
	test("keeps valid views sorted", () => {
		const out = sanitizeViews([view("b"), view("a")]);
		expect(out.map((v) => v.name)).toEqual(["a", "b"]);
	});
	test("drops invalid entries", () => {
		const out = sanitizeViews([
			view("ok"),
			{ name: "" },
			{ name: "no-cols", cols: [] },
			"junk",
			null,
		]);
		expect(out.map((v) => v.name)).toEqual(["ok"]);
	});
	test("sanitizes widths and ranges", () => {
		const out = sanitizeViews([
			{
				name: "x",
				q: "level:error",
				cols: ["timestamp"],
				columnWidths: { timestamp: 120, bad: 5, junk: "y" },
				range: { preset: "1h" },
			},
		]);
		expect(out[0]?.columnWidths).toEqual({ timestamp: 120 });
		expect(out[0]?.range).toEqual({ preset: "1h" });
		expect(out[0]?.sortAsc).toBe(false);
		expect(out[0]?.groupBy).toBe("level");
	});
	test("non-array yields empty", () => {
		expect(sanitizeViews({})).toEqual([]);
	});
});

describe("sanitizeViews sort/group", () => {
	test("keeps sortAsc and groupBy", () => {
		const out = sanitizeViews([
			{ ...view("x"), sortAsc: true, groupBy: "service" },
		]);
		expect(out[0]?.sortAsc).toBe(true);
		expect(out[0]?.groupBy).toBe("service");
	});
});

describe("upsertView / removeView", () => {
	test("replaces by name case-insensitively and sorts", () => {
		let views = upsertView([], view("Errors", "level:error"));
		views = upsertView(views, view("All"));
		views = upsertView(views, view("errors", "level:fatal"));
		expect(views.map((v) => v.name)).toEqual(["All", "errors"]);
		expect(views[1]?.q).toBe("level:fatal");
	});
	test("removes by exact name", () => {
		const views = upsertView([], view("a"));
		expect(removeView(views, "a")).toEqual([]);
		expect(removeView(views, "b")).toHaveLength(1);
	});
});

describe("sameViewState", () => {
	test("equal states match", () => {
		expect(sameViewState(view("a"), view("b"))).toBe(true);
	});
	test("any drift breaks equality", () => {
		expect(sameViewState(view("a"), { ...view("a"), q: "x" })).toBe(false);
		expect(sameViewState(view("a"), { ...view("a"), sortAsc: true })).toBe(
			false,
		);
		expect(
			sameViewState(view("a"), { ...view("a"), columnWidths: { m: 100 } }),
		).toBe(false);
	});
});
