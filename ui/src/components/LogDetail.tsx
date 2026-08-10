import { format } from "date-fns";
import { X } from "lucide-react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import type { Entry } from "@/domain/models.ts";

function FieldValue({ value }: { value: unknown }) {
	if (typeof value === "object" && value !== null) {
		return (
			<pre className="whitespace-pre-wrap break-all">
				{JSON.stringify(value, null, 2)}
			</pre>
		);
	}
	return <span className="break-all">{String(value)}</span>;
}

export function LogDetail({
	entry,
	onClose,
}: {
	entry: Entry;
	onClose: () => void;
}) {
	return (
		<aside className="flex w-full max-w-xl shrink-0 flex-col overflow-y-auto border-border border-l bg-card">
			<header className="flex items-start justify-between gap-2 border-border border-b p-4">
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2">
						<LevelBadge level={entry.level} />
						<time className="font-mono text-muted-foreground text-xs">
							{format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss.SSS XXX")}
						</time>
					</div>
					<p className="font-medium text-sm">{entry.message}</p>
				</div>
				<button
					className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
					onClick={onClose}
					aria-label="Close details"
				>
					<X size={16} />
				</button>
			</header>

			<div className="flex flex-col gap-4 p-4 text-sm">
				{entry.fields && entry.fields.length > 0 && (
					<section>
						<h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Fields
						</h3>
						<dl className="flex flex-col gap-1 font-mono text-xs">
							{entry.fields.map((field) => (
								<div className="flex gap-2" key={field.key}>
									<dt className="shrink-0 text-muted-foreground">
										{field.key}:
									</dt>
									<dd>
										<FieldValue value={field.value} />
									</dd>
								</div>
							))}
						</dl>
					</section>
				)}

				{entry.caller && (
					<section>
						<h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Caller
						</h3>
						<p className="font-mono text-xs">{entry.caller}</p>
					</section>
				)}

				{entry.stacktrace && (
					<section>
						<h3 className="mb-2 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
							Stacktrace
						</h3>
						<pre className="overflow-x-auto rounded bg-background p-2 font-mono text-xs leading-relaxed">
							{entry.stacktrace}
						</pre>
					</section>
				)}
			</div>
		</aside>
	);
}
