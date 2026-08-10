import { Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { SearchHelp } from "@/components/SearchHelp.tsx";
import { Input } from "@/components/ui/input";
import { fetchFields, fetchFieldValues } from "@/lib/api.ts";
import { lastToken, replaceLastToken, splitToken } from "@/lib/autocomplete.ts";
import { fieldTerm } from "@/lib/query.ts";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 8;
const VALUES_DEBOUNCE_MS = 150;

interface Suggestion {
	kind: "field" | "value";
	insert: string;
	label: string;
	count?: number;
}

export function SearchBar({
	value,
	onChange,
	onSubmit,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	const [fields, setFields] = useState<string[]>([]);
	const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
	const [active, setActive] = useState(0);
	const [open, setOpen] = useState(false);
	const focusedRef = useRef(false);

	useEffect(() => {
		const abort = new AbortController();
		fetchFields(abort.signal)
			.then(setFields)
			.catch(() => {});
		return () => abort.abort();
	}, []);

	useEffect(() => {
		if (!focusedRef.current) {
			return;
		}
		const token = lastToken(value);
		if (!token.text) {
			setOpen(false);
			return;
		}
		const { modifier, field, prefix } = splitToken(token.text);

		if (field === null) {
			const needle = prefix.toLowerCase();
			const matches = fields
				.filter((f) => f.toLowerCase().startsWith(needle) && f !== needle)
				.slice(0, MAX_SUGGESTIONS)
				.map<Suggestion>((f) => ({
					kind: "field",
					insert: `${modifier}${f}:`,
					label: `${f}:`,
				}));
			setSuggestions(matches);
			setActive(0);
			setOpen(matches.length > 0);
			return;
		}

		const abort = new AbortController();
		const timer = setTimeout(() => {
			fetchFieldValues(field, prefix, abort.signal)
				.then((values) => {
					const matches = values
						.filter((v) => v.value !== prefix)
						.slice(0, MAX_SUGGESTIONS)
						.map<Suggestion>((v) => ({
							kind: "value",
							insert: modifier + fieldTerm(field, v.value),
							label: v.value,
							count: v.count,
						}));
					setSuggestions(matches);
					setActive(0);
					setOpen(matches.length > 0);
				})
				.catch(() => {});
		}, VALUES_DEBOUNCE_MS);
		return () => {
			abort.abort();
			clearTimeout(timer);
		};
	}, [value, fields]);

	const apply = (suggestion: Suggestion) => {
		onChange(replaceLastToken(value, suggestion.insert));
		if (suggestion.kind === "value") {
			setOpen(false);
		}
	};

	return (
		<form
			className="search-form"
			onSubmit={(event) => {
				event.preventDefault();
				setOpen(false);
				onSubmit();
			}}
		>
			<div className="search-field">
				<Search className="search-field-icon" />
				<Input
					className="search-field-input"
					placeholder="Search… (e.g. timeout, level:error, nested.host:db1)"
					value={value}
					onChange={(event) => onChange(event.target.value)}
					onFocus={() => {
						focusedRef.current = true;
					}}
					onBlur={() => {
						focusedRef.current = false;
						setOpen(false);
					}}
					onKeyDown={(event) => {
						if (!open) {
							return;
						}
						switch (event.key) {
							case "ArrowDown":
								event.preventDefault();
								setActive((a) => (a + 1) % suggestions.length);
								break;
							case "ArrowUp":
								event.preventDefault();
								setActive(
									(a) => (a - 1 + suggestions.length) % suggestions.length,
								);
								break;
							case "Tab":
							case "Enter": {
								const suggestion = suggestions[active];
								if (suggestion) {
									event.preventDefault();
									apply(suggestion);
								}
								break;
							}
							case "Escape":
								setOpen(false);
								break;
						}
					}}
				/>
				<SearchHelp />
				{open && (
					<ul className="search-suggestions">
						{suggestions.map((suggestion, index) => (
							<li key={suggestion.insert}>
								<button
									type="button"
									className={cn(
										"search-suggestion",
										index === active && "search-suggestion-active",
									)}
									// Runs before the input's blur, which would close the list.
									onMouseDown={(event) => {
										event.preventDefault();
										apply(suggestion);
									}}
									onMouseEnter={() => setActive(index)}
								>
									<span>{suggestion.label}</span>
									{suggestion.count !== undefined && (
										<span className="search-suggestion-count">
											{suggestion.count}
										</span>
									)}
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</form>
	);
}
