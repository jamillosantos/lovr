import { describe, expect, test } from "bun:test";
import type { Entry } from "@/domain/models.ts";
import { mergeLive, mergeOlder } from "./entries.ts";

function entry(id: string): Entry {
	return {
		$id: id,
		timestamp: "2026-08-10T18:00:00Z",
		level: "info",
		message: `message ${id}`,
	};
}

describe("mergeLive", () => {
	test("prepends new entries", () => {
		const got = mergeLive([entry("b"), entry("a")], [entry("c")]);
		expect(got.map((e) => e.$id)).toEqual(["c", "b", "a"]);
	});
	test("re-delivered entries move to the front without duplicating", () => {
		const got = mergeLive([entry("b"), entry("a")], [entry("c"), entry("b")]);
		expect(got.map((e) => e.$id)).toEqual(["c", "b", "a"]);
	});
	test("trims the tail at the cap", () => {
		const got = mergeLive([entry("b"), entry("a")], [entry("c")], 2);
		expect(got.map((e) => e.$id)).toEqual(["c", "b"]);
	});
});

describe("mergeOlder", () => {
	test("appends older entries", () => {
		const got = mergeOlder([entry("c"), entry("b")], [entry("a")]);
		expect(got.map((e) => e.$id)).toEqual(["c", "b", "a"]);
	});
	test("drops entries already loaded (boundary overlap)", () => {
		const got = mergeOlder([entry("c"), entry("b")], [entry("b"), entry("a")]);
		expect(got.map((e) => e.$id)).toEqual(["c", "b", "a"]);
	});
});
