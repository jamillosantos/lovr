import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useState,
} from "react";

// "local" follows the browser, "utc" is UTC, anything else is an IANA zone.
export type TimezoneSetting = string;

export interface Settings {
	timezone: TimezoneSetting;
}

const STORAGE_KEY = "lovr-settings";

const DEFAULT_SETTINGS: Settings = { timezone: "local" };

function loadSettings(): Settings {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) {
			return DEFAULT_SETTINGS;
		}
		return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
	} catch {
		return DEFAULT_SETTINGS;
	}
}

const SettingsContext = createContext<{
	settings: Settings;
	update: (patch: Partial<Settings>) => void;
}>({ settings: DEFAULT_SETTINGS, update: () => {} });

export function SettingsProvider({ children }: { children: ReactNode }) {
	const [settings, setSettings] = useState<Settings>(loadSettings);

	useEffect(() => {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
	}, [settings]);

	const update = (patch: Partial<Settings>) =>
		setSettings((current) => ({ ...current, ...patch }));

	return (
		<SettingsContext.Provider value={{ settings, update }}>
			{children}
		</SettingsContext.Provider>
	);
}

export function useSettings() {
	return useContext(SettingsContext);
}
