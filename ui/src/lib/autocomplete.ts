// Helpers to autocomplete the last token of a search query.

export interface Token {
	start: number;
	text: string;
}

// lastToken returns the trailing non-whitespace run of the input (which is
// what the user is currently typing) and where it starts.
export function lastToken(input: string): Token {
	const text = input.match(/(\S*)$/)?.[1] ?? "";
	return { start: input.length - text.length, text };
}

export interface TokenParts {
	// Leading + or - (bluge query syntax modifiers), preserved on replacement.
	modifier: string;
	// The field name when the token is field:prefix, null for a bare word.
	field: string | null;
	prefix: string;
}

export function splitToken(text: string): TokenParts {
	const modifier = /^[+-]/.test(text) ? text.slice(0, 1) : "";
	const rest = text.slice(modifier.length);
	const colon = rest.indexOf(":");
	if (colon < 0) {
		return { modifier, field: null, prefix: rest };
	}
	return {
		modifier,
		field: rest.slice(0, colon),
		prefix: rest.slice(colon + 1),
	};
}

export function replaceLastToken(input: string, replacement: string): string {
	return input.slice(0, lastToken(input).start) + replacement;
}
