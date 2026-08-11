import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

export interface Settings {
	// Display
	/** "local", "utc" or an IANA zone. */
	timezone: string;
	/** 12-hour clock with AM/PM. */
	hour12: boolean;
	/** Omit the date part for entries from today. */
	hideDateToday: boolean;
	/** Show millisecond precision. */
	subsecond: boolean;
	density: "comfortable" | "compact";
	/** Wrap long messages in the list instead of truncating. */
	wrapMessages: boolean;
	/** Textures on chart segments (colorblind assist). */
	chartTextures: boolean;

	// Stream
	historyPageSize: number;
	histogramRefreshSec: number;
	/** Snap back to the newest entries when a live batch arrives. */
	followMode: boolean;
	/** Pause automatically when scrolling away from the top (resumes at top). */
	autoPauseOnScroll: boolean;

	// Search & data
	/** Preset id applied when the URL carries no range ("all" for none). */
	defaultRange: string;
	/** Level aliases, e.g. {"warn": "warning"}. */
	levelAliases: Record<string, string>;
}

export const DEFAULT_SETTINGS: Settings = {
	timezone: "utc",
	hour12: false,
	hideDateToday: false,
	subsecond: true,
	density: "comfortable",
	wrapMessages: false,
	chartTextures: false,
	historyPageSize: 100,
	histogramRefreshSec: 10,
	followMode: false,
	autoPauseOnScroll: false,
	defaultRange: "all",
	levelAliases: { warn: "warning", err: "error", critical: "fatal" },
};

const STORAGE_KEY = "lovr-settings";

// sanitize merges a parsed value over the defaults, keeping types sane.
export function sanitizeSettings(raw: unknown): Settings {
	const out: Settings = {
		...DEFAULT_SETTINGS,
		levelAliases: { ...DEFAULT_SETTINGS.levelAliases },
	};
	if (typeof raw !== "object" || raw === null) {
		return out;
	}
	const source = raw as Record<string, unknown>;
	for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[]) {
		const value = source[key];
		if (value === undefined) {
			continue;
		}
		const defaultValue = DEFAULT_SETTINGS[key];
		if (typeof defaultValue === "boolean" && typeof value === "boolean") {
			(out as unknown as Record<string, unknown>)[key] = value;
		} else if (typeof defaultValue === "number" && typeof value === "number") {
			if (Number.isFinite(value) && value > 0) {
				(out as unknown as Record<string, unknown>)[key] = value;
			}
		} else if (typeof defaultValue === "string" && typeof value === "string") {
			(out as unknown as Record<string, unknown>)[key] = value;
		} else if (key === "levelAliases" && typeof value === "object") {
			const aliases: Record<string, string> = {};
			for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
				if (typeof v === "string") {
					aliases[k.toLowerCase()] = v.toLowerCase();
				}
			}
			out.levelAliases = aliases;
		}
	}
	if (out.density !== "compact" && out.density !== "comfortable") {
		out.density = "comfortable";
	}
	return out;
}

function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		return raw ? sanitizeSettings(JSON.parse(raw)) : { ...DEFAULT_SETTINGS };
	} catch {
		return { ...DEFAULT_SETTINGS };
	}
}

const SettingsContext = createContext<{
	settings: Settings;
	update: (patch: Partial<Settings>) => void;
	replace: (settings: Settings) => void;
}>({
	settings: DEFAULT_SETTINGS,
	update: () => {},
	replace: () => {},
});

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<Settings>(loadSettings);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}, [settings]);

	const update = (patch: Partial<Settings>) =>
		setSettings((current) => ({ ...current, ...patch }));

	const replace = (next: Settings) => setSettings(next);

	return (
		<SettingsContext.Provider value={{ settings, update, replace }}>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings() {
	return useContext(SettingsContext);
}
