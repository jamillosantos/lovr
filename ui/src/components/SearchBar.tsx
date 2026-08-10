import { Search } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export function SearchBar({ onSubmit }: { onSubmit: (query: string) => void }) {
	const [value, setValue] = useState("");

	return (
		<form
			className="search-form"
			onSubmit={(event) => {
				event.preventDefault();
				onSubmit(value);
			}}
		>
			<div className="search-field">
				<Search className="search-field-icon" />
				<Input
					className="search-field-input"
					placeholder="Search… (e.g. timeout, level:error, nested.host:db1)"
					value={value}
					onChange={(event) => setValue(event.target.value)}
				/>
			</div>
		</form>
	);
}
