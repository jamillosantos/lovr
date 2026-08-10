import { describe, expect, test } from "bun:test";
import { lastToken, replaceLastToken, splitToken } from "./autocomplete.ts";
import { appendTerm, fieldTerm, queryFromSearch, searchURL } from "./query.ts";

describe("lastToken", () => {
	test("empty input", () => {
		expect(lastToken("")).toEqual({ start: 0, text: "" });
	});
	test("single word", () => {
		expect(lastToken("serv")).toEqual({ start: 0, text: "serv" });
	});
	test("after a space", () => {
		expect(lastToken("level:error ser")).toEqual({ start: 12, text: "ser" });
	});
	test("trailing space means empty token", () => {
		expect(lastToken("level:error ")).toEqual({ start: 12, text: "" });
	});
});

describe("splitToken", () => {
	test("bare word", () => {
		expect(splitToken("serv")).toEqual({
			modifier: "",
			field: null,
			prefix: "serv",
		});
	});
	test("field with prefix", () => {
		expect(splitToken("service:ga")).toEqual({
			modifier: "",
			field: "service",
			prefix: "ga",
		});
	});
	test("field without prefix", () => {
		expect(splitToken("service:")).toEqual({
			modifier: "",
			field: "service",
			prefix: "",
		});
	});
	test("negated token keeps the modifier", () => {
		expect(splitToken("-level:debug")).toEqual({
			modifier: "-",
			field: "level",
			prefix: "debug",
		});
	});
	test("dotted field", () => {
		expect(splitToken("nested.host:db")).toEqual({
			modifier: "",
			field: "nested.host",
			prefix: "db",
		});
	});
});

describe("replaceLastToken", () => {
	test("replaces the trailing token only", () => {
		expect(replaceLastToken("level:error ser", "service:")).toBe(
			"level:error service:",
		);
	});
	test("appends when input ends with space", () => {
		expect(replaceLastToken("level:error ", "service:")).toBe(
			"level:error service:",
		);
	});
});

describe("fieldTerm", () => {
	test("plain values stay bare", () => {
		expect(fieldTerm("service", "gateway")).toBe("service:gateway");
	});
	test("values with spaces get quoted", () => {
		expect(fieldTerm("msg", "failed to process")).toBe(
			'msg:"failed to process"',
		);
	});
	test("quotes inside values are escaped", () => {
		expect(fieldTerm("msg", 'say "hi"')).toBe('msg:"say \\"hi\\""');
	});
	test("numbers stay bare", () => {
		expect(fieldTerm("status", 404)).toBe("status:404");
	});
});

describe("appendTerm", () => {
	test("appends with a space", () => {
		expect(appendTerm("level:error", "status:404")).toBe(
			"level:error status:404",
		);
	});
	test("no leading space on empty query", () => {
		expect(appendTerm("", "status:404")).toBe("status:404");
	});
});

describe("queryFromSearch", () => {
	test("reads q", () => {
		expect(queryFromSearch("?q=level%3Aerror+timeout")).toBe(
			"level:error timeout",
		);
	});
	test("empty when missing", () => {
		expect(queryFromSearch("")).toBe("");
	});
});

describe("searchURL", () => {
	test("encodes the query", () => {
		expect(searchURL("/", 'msg:"a b"')).toBe("/?q=msg%3A%22a+b%22");
	});
	test("drops the parameter when empty", () => {
		expect(searchURL("/", "  ")).toBe("/");
	});
	test("round-trips", () => {
		const q = 'level:error msg:"failed to process" -service:billing';
		expect(queryFromSearch(searchURL("/", q).slice(1))).toBe(q);
	});
});
