import { describe, expect, test } from "bun:test";
import { lastToken, replaceLastToken, splitToken } from "./autocomplete.ts";
import {
	appendTerm,
	DEFAULT_COLUMNS,
	fieldTerm,
	stateFromSearch,
	stateURL,
} from "./query.ts";

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

describe("stateFromSearch", () => {
	test("reads q and defaults cols", () => {
		expect(stateFromSearch("?q=level%3Aerror+timeout")).toEqual({
			q: "level:error timeout",
			cols: DEFAULT_COLUMNS,
			range: null,
			groupBy: "level",
		});
	});
	test("reads cols", () => {
		expect(stateFromSearch("?cols=timestamp,level,message,service")).toEqual({
			q: "",
			cols: ["timestamp", "level", "message", "service"],
			range: null,
			groupBy: "level",
		});
	});
	test("reads the time range", () => {
		expect(stateFromSearch("?range=1h").range).toEqual({ preset: "1h" });
	});
	test("empty when missing", () => {
		expect(stateFromSearch("")).toEqual({
			q: "",
			cols: DEFAULT_COLUMNS,
			range: null,
			groupBy: "level",
		});
	});
});

describe("stateURL", () => {
	test("encodes the query and drops default cols", () => {
		expect(
			stateURL("/", {
				q: 'msg:"a b"',
				cols: [...DEFAULT_COLUMNS],
				range: null,
				groupBy: "level",
			}),
		).toBe("/?q=msg%3A%22a+b%22");
	});
	test("drops all parameters at defaults", () => {
		expect(
			stateURL("/", {
				q: "  ",
				cols: [...DEFAULT_COLUMNS],
				range: null,
				groupBy: "level",
			}),
		).toBe("/");
	});
	test("persists custom cols", () => {
		expect(
			stateURL("/", {
				q: "",
				cols: ["timestamp", "message", "service"],
				range: null,
				groupBy: "level",
			}),
		).toBe("/?cols=timestamp%2Cmessage%2Cservice");
	});
	test("round-trips", () => {
		const state = {
			q: 'level:error msg:"failed to process" -service:billing',
			cols: ["timestamp", "level", "message", "status"],
			range: { preset: "24h" },
			groupBy: "service",
		};
		expect(stateFromSearch(stateURL("/", state).slice(1))).toEqual(state);
	});
});
