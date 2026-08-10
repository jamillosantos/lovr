// Tokenizer for search query syntax highlighting.

export interface HighlightToken {
	text: string;
	type:
		| "ws"
		| "key"
		| "colon"
		| "value"
		| "phrase"
		| "operator"
		| "modifier"
		| `paren-${number}`;
}

const PAREN_COLORS = 5;

// matchParen returns the offsets of the parenthesis pair the caret touches
// (the character at the caret, or just before it), or null. Parentheses
// inside double quotes do not count.
export function matchParen(
	input: string,
	caret: number,
): [number, number] | null {
	const isParen = (index: number) =>
		index >= 0 &&
		index < input.length &&
		(input[index] === "(" || input[index] === ")") &&
		!insideQuotes(input, index);

	let at = -1;
	if (isParen(caret)) {
		at = caret;
	} else if (isParen(caret - 1)) {
		at = caret - 1;
	} else {
		return null;
	}

	const stack: number[] = [];
	let inQuotes = false;
	for (let i = 0; i < input.length; i++) {
		const ch = input[i];
		if (ch === '"') {
			inQuotes = !inQuotes;
			continue;
		}
		if (inQuotes) {
			continue;
		}
		if (ch === "(") {
			stack.push(i);
		} else if (ch === ")") {
			const open = stack.pop();
			if (open === undefined) {
				continue;
			}
			if (i === at || open === at) {
				return [open, i];
			}
		}
	}
	return null;
}

// activeTermIndexes returns the indexes of the VALUE tokens of the key:value
// term the caret is in, so the value lights up while editing the key. For
// value lists (key:(a OR b)) the whole parenthesized span lights up, whether
// the caret is on the key or inside the list. Empty when the caret is not
// inside a fielded term.
export function activeTermIndexes(
	tokens: HighlightToken[],
	caret: number,
): Set<number> {
	const partTypes = new Set(["modifier", "key", "colon", "value", "phrase"]);
	const isParen = (i: number) =>
		i >= 0 &&
		i < tokens.length &&
		(tokens[i] as HighlightToken).type.startsWith("paren-");
	const parenChar = (i: number) => (tokens[i] as HighlightToken).text;

	// closeOf finds the index of the matching ")" for an "(" token.
	const closeOf = (open: number): number => {
		let depth = 0;
		for (let i = open; i < tokens.length; i++) {
			if (!isParen(i)) {
				continue;
			}
			if (parenChar(i) === "(") {
				depth++;
			} else {
				depth--;
				if (depth === 0) {
					return i;
				}
			}
		}
		return -1;
	};

	let offset = 0;
	let at = -1;
	for (let i = 0; i < tokens.length; i++) {
		const token = tokens[i] as HighlightToken;
		const end = offset + token.text.length;
		if (partTypes.has(token.type) && caret >= offset && caret <= end) {
			at = i;
			// Prefer a token the caret is strictly inside; ending here only
			// wins when nothing follows.
			if (caret < end) {
				break;
			}
		}
		offset = end;
	}

	// enclosingList walks up the parens around tokenAt looking for an opener
	// preceded by key+colon; the whole balanced span is the highlight.
	const enclosingList = (tokenAt: number): Set<number> => {
		let open = -1;
		let depth = 0;
		for (let i = tokenAt; i >= 0; i--) {
			if (!isParen(i)) {
				continue;
			}
			if (parenChar(i) === ")" && i !== tokenAt) {
				depth++;
			} else if (parenChar(i) === "(") {
				if (depth === 0) {
					open = i;
					if (i > 0 && (tokens[i - 1] as HighlightToken).type === "colon") {
						break;
					}
				} else {
					depth--;
				}
			}
		}
		if (open <= 0 || (tokens[open - 1] as HighlightToken).type !== "colon") {
			return new Set();
		}
		const close = closeOf(open);
		if (close < 0) {
			return new Set();
		}
		const span = new Set<number>();
		for (let i = open; i <= close; i++) {
			span.add(i);
		}
		return span;
	};

	if (at < 0) {
		// The caret is not on a term token (e.g. on a paren or whitespace):
		// it may still be inside a value list.
		let offset2 = 0;
		let tokenAt = -1;
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i] as HighlightToken;
			const tokenEnd = offset2 + token.text.length;
			if (caret >= offset2 && caret <= tokenEnd) {
				tokenAt = i;
				if (caret < tokenEnd) {
					break;
				}
			}
			offset2 = tokenEnd;
		}
		return tokenAt < 0 ? new Set() : enclosingList(tokenAt);
	}

	let start = at;
	let end = at;
	while (
		start > 0 &&
		partTypes.has((tokens[start - 1] as HighlightToken).type)
	) {
		start--;
	}
	while (
		end < tokens.length - 1 &&
		partTypes.has((tokens[end + 1] as HighlightToken).type)
	) {
		end++;
	}

	const group = new Set<number>();
	let hasKey = false;
	for (let i = start; i <= end; i++) {
		const type = (tokens[i] as HighlightToken).type;
		if (type === "value" || type === "phrase") {
			group.add(i);
		}
		if (type === "key") {
			hasKey = true;
		}
	}
	if (!hasKey) {
		// A bare word: it may be a member of a value list (key:(a OR b)).
		return enclosingList(at);
	}

	// A value list directly after the term (key:(a OR b)): light the whole
	// parenthesized span.
	if (
		(tokens[end] as HighlightToken).type === "colon" &&
		isParen(end + 1) &&
		parenChar(end + 1) === "("
	) {
		const close = closeOf(end + 1);
		if (close > 0) {
			for (let i = end + 1; i <= close; i++) {
				group.add(i);
			}
		}
	}
	return group;
}

function insideQuotes(input: string, index: number): boolean {
	let inQuotes = false;
	for (let i = 0; i < index; i++) {
		if (input[i] === '"') {
			inQuotes = !inQuotes;
		}
	}
	return inQuotes;
}

export function tokenizeForHighlight(input: string): HighlightToken[] {
	const tokens: HighlightToken[] = [];
	let depth = 0;
	let i = 0;

	const push = (text: string, type: HighlightToken["type"]) => {
		if (text) {
			tokens.push({ text, type });
		}
	};

	while (i < input.length) {
		const ch = input[i] as string;

		if (ch === " " || ch === "\t") {
			let j = i;
			while (j < input.length && (input[j] === " " || input[j] === "\t")) {
				j++;
			}
			push(input.slice(i, j), "ws");
			i = j;
			continue;
		}

		if (ch === "(") {
			push(
				ch,
				`paren-${((depth % PAREN_COLORS) + PAREN_COLORS) % PAREN_COLORS}`,
			);
			depth++;
			i++;
			continue;
		}
		if (ch === ")") {
			depth--;
			push(
				ch,
				`paren-${((depth % PAREN_COLORS) + PAREN_COLORS) % PAREN_COLORS}`,
			);
			i++;
			continue;
		}

		if (ch === '"') {
			let j = i + 1;
			while (j < input.length && input[j] !== '"') {
				j++;
			}
			if (j < input.length) {
				j++;
			}
			push(input.slice(i, j), "phrase");
			i = j;
			continue;
		}

		// A word: up to whitespace, parenthesis or quote.
		let j = i;
		while (j < input.length && !' \t()"'.includes(input[j] as string)) {
			j++;
		}
		const word = input.slice(i, j);
		i = j;

		if (word === "OR") {
			push(word, "operator");
			continue;
		}

		let rest = word;
		if (rest.startsWith("+") || rest.startsWith("-")) {
			push(rest.slice(0, 1), "modifier");
			rest = rest.slice(1);
		}

		const colon = rest.indexOf(":");
		if (colon > 0) {
			push(rest.slice(0, colon), "key");
			push(":", "colon");
			push(rest.slice(colon + 1), "value");
		} else {
			push(rest, "value");
		}
	}

	return tokens;
}
