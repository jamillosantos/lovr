import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/lib/settings.tsx";

export function ThemeToggle() {
	const { settings, update } = useSettings();
	const dark =
		settings.theme === "dark" ||
		(settings.theme === "system" &&
			window.matchMedia("(prefers-color-scheme: dark)").matches);

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={() => update({ theme: dark ? "light" : "dark" })}
			aria-label="Toggle theme"
		>
			{dark ? <Sun /> : <Moon />}
		</Button>
	);
}
