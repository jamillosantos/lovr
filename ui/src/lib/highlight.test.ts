import { describe, expect, test } from "bun:test";
import {
	activeTermIndexes,
	matchParen,
	tokenizeForHighlight,
} from "./highlight.ts";

const types = (q: string) =>
	tokenizeForHighlight(q).map((t) => `${t.type}:${t.text}`);

describe("tokenizeForHighlight", () => {
	test("fielded term", () => {
		expect(types("level:error")).toEqual([
			"key:level",
			"colon::",
			"value:error",
		]);
	});

	test("bare word is a value", () => {
		expect(types("timeout")).toEqual(["value:timeout"]);
	});

	test("modifier and OR", () => {
		expect(types("-level:debug OR x")).toEqual([
			"modifier:-",
			"key:level",
			"colon::",
			"value:debug",
			"ws: ",
			"operator:OR",
			"ws: ",
			"value:x",
		]);
	});

	test("quoted phrases stay whole", () => {
		expect(types('message:"a (OR) b"')).toEqual([
			"key:message",
			"colon::",
			'phrase:"a (OR) b"',
		]);
	});

	test("rainbow parens cycle by depth", () => {
		expect(types("((a) (b))")).toEqual([
			"paren-0:(",
			"paren-1:(",
			"value:a",
			"paren-1:)",
			"ws: ",
			"paren-1:(",
			"value:b",
			"paren-1:)",
			"paren-0:)",
		]);
	});

	test("unbalanced close does not crash", () => {
		expect(types("a)")).toEqual(["value:a", "paren-4:)"]);
	});

	test("matchParen finds the pair at or before the caret", () => {
		//        0123456789
		const q = "(a (b) c)";
		expect(matchParen(q, 0)).toEqual([0, 8]);
		expect(matchParen(q, 3)).toEqual([3, 5]);
		expect(matchParen(q, 6)).toEqual([3, 5]); // caret just after ")"
		expect(matchParen(q, 9)).toEqual([0, 8]);
		expect(matchParen(q, 2)).toBeNull();
	});

	test("matchParen ignores quoted parens and unmatched ones", () => {
		expect(matchParen('"(a" (b)', 1)).toBeNull();
		expect(matchParen("(a", 0)).toBeNull();
		const withQuotes = '("x)" a)';
		expect(matchParen(withQuotes, 0)).toEqual([0, 7]);
	});

	test("caret in a key highlights only its value tokens", () => {
		// tokens: key(level) colon value(error) ws value(x)
		const q = "level:error x";
		const tokens = tokenizeForHighlight(q);
		// Caret inside "level" -> only the "error" value token (index 2).
		expect([...activeTermIndexes(tokens, 2)]).toEqual([2]);
		// Caret inside "error" -> same.
		expect([...activeTermIndexes(tokens, 8)]).toEqual([2]);
		// Caret in the bare word "x" -> no key, nothing highlighted.
		expect([...activeTermIndexes(tokens, 13)]).toEqual([]);
	});

	test("caret in a key highlights a quoted value", () => {
		const tokens = tokenizeForHighlight('message:"a b"');
		expect([...activeTermIndexes(tokens, 3)]).toEqual([2]);
	});

	test("round-trips text", () => {
		const q = ' (level:(error OR fatal)  -msg:"x y")  status:>499 ';
		expect(
			tokenizeForHighlight(q)
				.map((t) => t.text)
				.join(""),
		).toBe(q);
	});
});
