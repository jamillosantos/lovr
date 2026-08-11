import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App.tsx";
import { SettingsProvider } from "@/lib/settings.tsx";

const elem = document.getElementById("root");
if (!elem) {
	throw new Error("Root element not found");
}

const app = (
	<StrictMode>
		<SettingsProvider>
			<App />
		</SettingsProvider>
	</StrictMode>
);

if (import.meta.hot) {
	if (!import.meta.hot.data.root) {
		import.meta.hot.data.root = createRoot(elem);
	}
	import.meta.hot.data.root.render(app);
} else {
	createRoot(elem).render(app);
}
