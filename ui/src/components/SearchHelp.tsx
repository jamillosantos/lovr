import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";

const examples: [string, string][] = [
	["error timeout", "all terms must match (AND)"],
	["level:error", "match a field"],
	["nested.host:db1", "nested fields use dots"],
	['message:"failed to process"', "exact phrase"],
	["-level:debug", "exclude matches"],
	["status:>499", "numeric ranges (>, >=, <, <=)"],
	["message:*onnect*", "wildcards match inside words"],
	["_exists_:user_id", "entries having a key (alias for user_id:*)"],
	["level:error OR level:fatal", "OR combines alternatives (uppercase)"],
	["(level:error OR level:fatal) service:billing", "parentheses group for precedence"],
];

export function SearchHelp() {
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					className="search-help-trigger"
					aria-label="Search syntax help"
					tabIndex={-1}
				>
					<CircleHelp />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="search-help">
				<h3 className="search-help-title">Search syntax</h3>
				<dl className="search-help-list">
					{examples.map(([example, description]) => (
						<div className="search-help-row" key={example}>
							<dt className="search-help-example">{example}</dt>
							<dd className="search-help-description">{description}</dd>
						</div>
					))}
				</dl>
			</PopoverContent>
		</Popover>
	);
}
