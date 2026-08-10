export type Level =
	| "debug"
	| "info"
	| "warning"
	| "error"
	| "fatal"
	| "panic"
	| (string & {});

export interface Field {
	key: string;
	value: unknown;
}

export interface Entry {
	$id: string;
	timestamp: string;
	level: Level;
	message: string;
	fields?: Field[];
	caller?: string;
	stacktrace?: string;
}

export interface SearchResponse {
	count: number;
	entries: Entry[] | null;
}

export interface BatchEntries {
	entries?: Entry[];
	err?: unknown;
}
