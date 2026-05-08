import { chromium } from "playwright";

const URL = process.env.URL || "http://localhost:4321/flashcards";
const PAGE_W_IN = 8.75;
const PAGE_H_IN = 5.75;

// Targets: { id (data-guide-num), lang (zh|en), selector (relative to card-wrap), defaultLineHeight }
const TARGETS = [
	{ id: "G2", lang: "zh", innerSel: ".body-zh",                   lh: 1.4  },
	{ id: "G3", lang: "zh", innerSel: ".guide-table",               lh: 1.42 },
	{ id: "G3", lang: "en", innerSel: ".guide-table.guide-table-en", lh: 1.38 },
	{ id: "G4", lang: "zh", innerSel: ".body-zh",                   lh: 1.5  },
	{ id: "G5", lang: "zh", innerSel: ".body-zh",                   lh: 1.42 },
	{ id: "G6", lang: "en", innerSel: ".guide-table.guide-table-en", lh: 1.42 },
	{ id: "G7", lang: "en", innerSel: ".body-en",                   lh: 1.4  },
];

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

// Helpers in browser
async function setOverride(target, fontPx) {
	await page.evaluate(
		({ id, lang, innerSel, fontPx, lh }) => {
			const styleId = `__probe_${id}_${lang}`;
			let el = document.getElementById(styleId);
			if (!el) {
				el = document.createElement("style");
				el.id = styleId;
				document.head.appendChild(el);
			}
			const wrapSel = `[data-guide-num="${id}"].lang-${lang}`;
			el.textContent = `
${wrapSel} ${innerSel} { font-size: ${fontPx}px !important; line-height: ${lh} !important; }
${wrapSel} ${innerSel} * { font-size: inherit !important; }
`;
		},
		{ ...target, fontPx },
	);
}

async function hasOverflow(target) {
	return await page.evaluate(
		({ id, lang }) => {
			const TOL = 0.5;
			const wrap = document.querySelector(`[data-guide-num="${id}"].lang-${lang}`);
			if (!wrap) return { overflow: false, by: 0 };
			const card = wrap.querySelector(".card");
			const cardBox = card.getBoundingClientRect();
			let maxOver = 0;
			const els = card.querySelectorAll(".content, .content *");
			for (const el of els) {
				const r = el.getBoundingClientRect();
				if (r.width === 0 || r.height === 0) continue;
				const dBottom = r.bottom - cardBox.bottom;
				const dRight = r.right - cardBox.right;
				if (dBottom > TOL && dBottom > maxOver) maxOver = dBottom;
				if (dRight > TOL && dRight > maxOver) maxOver = dRight;
			}
			const content = card.querySelector(".content");
			if (content) {
				const ov = Math.max(
					content.scrollHeight - content.clientHeight,
					content.scrollWidth - content.clientWidth,
				);
				if (ov > maxOver) maxOver = ov;
			}
			return { overflow: maxOver > TOL, by: Math.round(maxOver) };
		},
		target,
	);
}

async function findMax(target) {
	// Coarse step (0.5px) descending from a generous max, then refine to 0.25.
	const HIGH = 18;
	const LOW = 7;
	let lastFit = null;

	// Coarse pass: 0.5 step
	for (let f = HIGH; f >= LOW; f -= 0.5) {
		await setOverride(target, f);
		const { overflow, by } = await hasOverflow(target);
		if (!overflow) {
			lastFit = f;
			break;
		}
	}
	if (lastFit === null) return { fit: null, note: "no fit found down to 7px" };

	// Refine upward from lastFit by 0.25 to push it as high as possible
	let best = lastFit;
	for (let f = lastFit + 0.25; f <= HIGH; f += 0.25) {
		await setOverride(target, f);
		const { overflow } = await hasOverflow(target);
		if (overflow) break;
		best = f;
	}
	return { fit: best };
}

const results = [];
for (const t of TARGETS) {
	process.stdout.write(`${t.id} ${t.lang} ${t.innerSel} ... `);
	const r = await findMax(t);
	results.push({ ...t, ...r });
	console.log(r.fit !== null ? `max ${r.fit}px / lh ${t.lh}` : r.note);
	// Clear override before next
	await page.evaluate(({ id, lang }) => {
		const el = document.getElementById(`__probe_${id}_${lang}`);
		if (el) el.remove();
	}, t);
}

await browser.close();

console.log("\nSummary (max font-size with current line-height, no overflow):");
for (const r of results) {
	console.log(`  ${r.id} ${r.lang.padEnd(2)}  ${r.innerSel.padEnd(34)}  font-size: ${r.fit}px  line-height: ${r.lh}`);
}
