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
// term the caret is in, so the value lights up while editing the key. Empty
// when the caret is not inside a fielded term.
export function activeTermIndexes(
	tokens: HighlightToken[],
	caret: number,
): Set<number> {
	const partTypes = new Set(["modifier", "key", "colon", "value", "phrase"]);

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
	if (at < 0) {
		return new Set();
	}

	let start = at;
	while (
		start > 0 &&
		partTypes.has((tokens[start - 1] as HighlightToken).type)
	) {
		start--;
	}
	let end = at;
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
	return hasKey ? group : new Set();
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
