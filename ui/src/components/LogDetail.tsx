import { format } from "date-fns";
import { X } from "lucide-react";
import { LevelBadge } from "@/components/LevelBadge.tsx";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { Entry } from "@/domain/models.ts";

function FieldValue({ value }: { value: unknown }) {
	if (typeof value === "object" && value !== null) {
		return (
			<pre className="detail-value-block">{JSON.stringify(value, null, 2)}</pre>
		);
	}
	return <span className="detail-value">{String(value)}</span>;
}

function Section({
	title,
	children,
}: {
	title: string;
	children: React.ReactNode;
}) {
	return (
		<section>
			<h3 className="detail-section-title">{title}</h3>
			{children}
		</section>
	);
}

export function LogDetail({
	entry,
	onClose,
}: {
	entry: Entry;
	onClose: () => void;
}) {
	return (
		<aside className="detail-panel">
			<header className="detail-header">
				<div className="detail-header-meta">
					<div className="detail-header-row">
						<LevelBadge level={entry.level} />
						<time className="detail-time">
							{format(new Date(entry.timestamp), "yyyy-MM-dd HH:mm:ss.SSS XXX")}
						</time>
					</div>
					<p className="detail-message">{entry.message}</p>
				</div>
				<Button
					variant="ghost"
					size="icon-sm"
					onClick={onClose}
					aria-label="Close details"
				>
					<X />
				</Button>
			</header>
			<Separator />

			<ScrollArea className="log-scroll">
				<div className="detail-body">
					{entry.fields && entry.fields.length > 0 && (
						<Section title="Fields">
							<dl className="detail-fields">
								{entry.fields.map((field) => (
									<div className="detail-field" key={field.key}>
										<dt className="detail-field-key">{field.key}:</dt>
										<dd>
											<FieldValue value={field.value} />
										</dd>
									</div>
								))}
							</dl>
						</Section>
					)}

					{entry.caller && (
						<Section title="Caller">
							<p className="detail-caller">{entry.caller}</p>
						</Section>
					)}

					{entry.stacktrace && (
						<Section title="Stacktrace">
							<pre className="detail-stacktrace">{entry.stacktrace}</pre>
						</Section>
					)}
				</div>
			</ScrollArea>
		</aside>
	);
}
