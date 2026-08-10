import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchBar({
	value,
	onChange,
	onSubmit,
}: {
	value: string;
	onChange: (value: string) => void;
	onSubmit: () => void;
}) {
	return (
		<form
			className="search-form"
			onSubmit={(event) => {
				event.preventDefault();
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
				/>
			</div>
		</form>
	);
}
