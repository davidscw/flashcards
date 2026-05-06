type Lang = "zh" | "en";

const root = document.documentElement;

function currentLang(): Lang {
	return root.getAttribute("data-lang") === "en" ? "en" : "zh";
}

function applyLang(lang: Lang) {
	root.setAttribute("data-lang", lang);
	try {
		localStorage.setItem("lang", lang);
	} catch {}
	const url = new URL(location.href);
	url.searchParams.set("lang", lang);
	history.replaceState({}, "", url.toString());
	document.querySelectorAll<HTMLElement>("[data-lang-toggle]").forEach(syncButton);
}

function syncButton(btn: HTMLElement) {
	const lang = currentLang();
	btn.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
	btn.setAttribute("data-lang-current", lang);
}

document.querySelectorAll<HTMLElement>("[data-lang-toggle]").forEach((btn) => {
	syncButton(btn);
	btn.addEventListener("click", () => applyLang(currentLang() === "en" ? "zh" : "en"));
});
