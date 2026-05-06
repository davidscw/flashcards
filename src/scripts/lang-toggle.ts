const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>("[data-lang-toggle]");

function labelFor(lang: string): string {
	return lang === "en" ? "繁體中文" : "English";
}

function apply(lang: "zh" | "en") {
	root.setAttribute("data-lang", lang);
	if (button) {
		button.textContent = labelFor(lang);
		button.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
	}
	const url = new URL(location.href);
	url.searchParams.set("lang", lang);
	history.replaceState({}, "", url.toString());
}

if (button) {
	const initial = root.getAttribute("data-lang") === "en" ? "en" : "zh";
	button.textContent = labelFor(initial);
	button.setAttribute("aria-pressed", initial === "en" ? "true" : "false");
	button.addEventListener("click", () => {
		const next = root.getAttribute("data-lang") === "en" ? "zh" : "en";
		apply(next);
	});
}
