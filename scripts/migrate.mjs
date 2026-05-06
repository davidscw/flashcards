import { readFile, writeFile, mkdir, cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const SRC = "/Users/wongsc/Downloads/flashcards 2";
const TMP = join(repo, ".migrate-tmp");

const yamlOpts = { lineWidth: -1, noCompatMode: true, quotingType: '"', forceQuotes: false };

async function loadCards() {
	const raw = await readFile(join(SRC, "cards-data.jsx"), "utf8");
	const start = raw.indexOf("window.CARDS");
	const arrayStart = raw.indexOf("[", start);
	const transformed =
		`const CARDS = ` + raw.slice(arrayStart) +
		`\nexport default CARDS;`;
	const tmpFile = join(TMP, "cards.mjs");
	await writeFile(tmpFile, transformed);
	const mod = await import(tmpFile + "?t=" + Date.now());
	return mod.default;
}

async function loadGuide() {
	const raw = await readFile(join(SRC, "Flashcards.html"), "utf8");
	const startMarker = "const GUIDE_CARDS = [";
	const start = raw.indexOf(startMarker);
	if (start < 0) throw new Error("GUIDE_CARDS marker not found");
	let depth = 0, i = start + startMarker.length - 1;
	for (; i < raw.length; i++) {
		const c = raw[i];
		if (c === "[") depth++;
		else if (c === "]") { depth--; if (depth === 0) { i++; break; } }
	}
	const arrayLiteral = raw.slice(start + "const GUIDE_CARDS = ".length, i);
	const tmpFile = join(TMP, "guide.mjs");
	await writeFile(tmpFile, `export default ${arrayLiteral};`);
	const mod = await import(tmpFile + "?t=" + Date.now());
	return mod.default;
}

function authoredFlag(c) {
	return c.bodyZh && c.bodyZh[0] && !c.bodyZh[0].startsWith("（請傳入");
}

async function writeMd(dir, name, frontmatter) {
	const yml = yaml.dump(frontmatter, yamlOpts);
	await writeFile(join(dir, name), `---\n${yml}---\n`);
}

async function main() {
	await mkdir(TMP, { recursive: true });
	const cardsDir = join(repo, "src/content/cards");
	const guideDir = join(repo, "src/content/guide");
	await mkdir(cardsDir, { recursive: true });
	await mkdir(guideDir, { recursive: true });

	// --- Cards ---
	const cards = await loadCards();
	let stubCount = 0;
	for (const c of cards) {
		if (!authoredFlag(c)) stubCount++;
		const fm = {
			num: c.num,
			conceptZh: c.conceptZh,
			conceptEn: c.conceptEn,
			titleZh: c.titleZh,
			titleEn: c.titleEn,
			pullQuoteZh: c.pullQuoteZh,
			pullQuoteEn: c.pullQuoteEn,
			bodyZh: c.bodyZh,
			bodyEn: c.bodyEn,
			practices: c.practices.map((p) => ({
				labelZh: p.labelZh, textZh: p.textZh,
				labelEn: p.labelEn, textEn: p.textEn,
			})),
		};
		const name = String(c.num).padStart(2, "0") + ".md";
		await writeMd(cardsDir, name, fm);
	}
	console.log(`Wrote ${cards.length} cards (${stubCount} stub/unauthored).`);

	// --- Guide ---
	const guide = await loadGuide();
	const KIND_BY_NUM = { G1: "prose", G2: "prose", G3: "table", G4: "prose", G5: "prose", G6: "table", G7: "list-dense", G8: "prose" };
	for (const g of guide) {
		const kind = g.kind ?? KIND_BY_NUM[g.num];
		if (!kind) throw new Error(`No kind for ${g.num}`);
		const fm = {
			kind,
			num: g.num,
			titleZh: g.titleZh, titleEn: g.titleEn,
			pullQuoteZh: g.pullQuoteZh, pullQuoteEn: g.pullQuoteEn,
		};
		if (kind === "table") {
			fm.headerZh = g.headerZh;
			fm.headerEn = g.headerEn;
			fm.rowsZh = g.rowsZh;
			fm.rowsEn = g.rowsEn;
		} else {
			fm.bodyZh = g.bodyZh;
			fm.bodyEn = g.bodyEn;
		}
		await writeMd(guideDir, `${g.num}.md`, fm);
	}
	console.log(`Wrote ${guide.length} guide entries.`);

	// --- Images ---
	const imagesOut = join(repo, "public/flashcards/images");
	await mkdir(imagesOut, { recursive: true });
	const imagesIn = join(SRC, "images");
	const imageFiles = [
		"01-foundations-print.png",
		"02-blossoming-orchids-print.png",
		"03-deepening-print.png",
		"04-offering-print.png",
		"05-companion-guide.jpg",
	];
	for (const f of imageFiles) {
		await cp(join(imagesIn, f), join(imagesOut, f));
	}
	console.log(`Copied ${imageFiles.length} images.`);

	await rm(TMP, { recursive: true, force: true });
	console.log("Done.");
}

main().catch((err) => { console.error(err); process.exit(1); });
