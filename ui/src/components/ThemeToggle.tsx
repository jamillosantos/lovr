import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
	const [dark, setDark] = useState(() =>
		document.documentElement.classList.contains("dark"),
	);

	const toggle = () => {
		const next = !dark;
		setDark(next);
		document.documentElement.classList.toggle("dark", next);
		localStorage.setItem("theme", next ? "dark" : "light");
	};

	return (
		<Button
			variant="ghost"
			size="icon-sm"
			onClick={toggle}
			aria-label="Toggle theme"
		>
			{dark ? <Sun /> : <Moon />}
		</Button>
	);
}
