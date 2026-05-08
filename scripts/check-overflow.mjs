import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4321/flashcards";
const PAGE_W_IN = 8.75;
const PAGE_H_IN = 5.75;

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: Math.ceil(PAGE_W_IN * 96), height: Math.ceil(PAGE_H_IN * 96) },
	deviceScaleFactor: 1,
});
const page = await context.newPage();
await page.goto(URL, { waitUntil: "networkidle", timeout: 120_000 });
await page.emulateMedia({ media: "print" });
await page.evaluate(async () => {
	if (document.fonts?.ready) await document.fonts.ready;
});

const findings = await page.evaluate(() => {
	const TOL = 0.5;
	const results = [];
	const wraps = Array.from(document.querySelectorAll(".card-wrap"));
	for (const wrap of wraps) {
		const card = wrap.querySelector(".card");
		if (!card) continue;
		const cardBox = card.getBoundingClientRect();
		const lang = wrap.classList.contains("lang-zh") ? "zh" : "en";
		const id =
			wrap.getAttribute("data-card-num") ||
			wrap.getAttribute("data-guide-num") ||
			"?";

		const content = card.querySelector(".content");
		if (content) {
			const overV = content.scrollHeight - content.clientHeight;
			const overH = content.scrollWidth - content.clientWidth;
			if (overV > TOL || overH > TOL) {
				results.push({
					id, lang, kind: "content-scroll",
					overV: Math.round(overV), overH: Math.round(overH),
				});
			}
		}

		const descendants = card.querySelectorAll(".content *");
		for (const el of descendants) {
			const r = el.getBoundingClientRect();
			if (r.width === 0 || r.height === 0) continue;
			const dBottom = r.bottom - cardBox.bottom;
			const dRight = r.right - cardBox.right;
			const dTop = cardBox.top - r.top;
			const dLeft = cardBox.left - r.left;
			if (dBottom > TOL || dRight > TOL || dTop > TOL || dLeft > TOL) {
				const path = (() => {
					const parts = [];
					let cur = el;
					while (cur && cur !== card && parts.length < 4) {
						const cls = (cur.className || "").toString().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
						parts.unshift(cur.tagName.toLowerCase() + (cls ? "." + cls : ""));
						cur = cur.parentElement;
					}
					return parts.join(" > ");
				})();
				const text = (el.textContent || "").trim().slice(0, 60);
				results.push({
					id, lang, kind: "element-out",
					path,
					over: {
						top: dTop > TOL ? Math.round(dTop) : 0,
						right: dRight > TOL ? Math.round(dRight) : 0,
						bottom: dBottom > TOL ? Math.round(dBottom) : 0,
						left: dLeft > TOL ? Math.round(dLeft) : 0,
					},
					text,
				});
			}
		}
	}
	return results;
});

await browser.close();

if (findings.length === 0) {
	console.log("No overflow detected across all cards.");
} else {
	const byCard = new Map();
	for (const f of findings) {
		const key = `${f.id} (${f.lang})`;
		if (!byCard.has(key)) byCard.set(key, []);
		byCard.get(key).push(f);
	}
	console.log(`Overflow findings on ${byCard.size} card(s):\n`);
	for (const [key, list] of byCard) {
		console.log(`# Card ${key}`);
		for (const f of list) {
			if (f.kind === "content-scroll") {
				console.log(`  - .content overflows: vertical=${f.overV}px, horizontal=${f.overH}px`);
			} else {
				const o = f.over;
				const dirs = [
					o.top ? `top+${o.top}` : null,
					o.right ? `right+${o.right}` : null,
					o.bottom ? `bottom+${o.bottom}` : null,
					o.left ? `left+${o.left}` : null,
				].filter(Boolean).join(", ");
				console.log(`  - ${f.path} → outside card by ${dirs}  | "${f.text}"`);
			}
		}
		console.log();
	}
	process.exitCode = 1;
}
