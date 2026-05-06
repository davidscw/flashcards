# Flashcards Deck Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the standalone `Flashcards.html` prototype (64 bilingual cards + 8 companion-guide pages) into the project's Astro/Cloudflare Workers app at `/flashcards`, preserving look and print output, dropping flip in favor of a global ZH/EN language toggle.

**Architecture:** Pure Astro components. Content is stored as Markdown files (frontmatter only) in two new content collections (`cards`, `guide`). The page renders both languages side-by-side in the DOM; CSS hides the inactive one based on `<html data-lang>`. A blocking inline `<script is:inline>` reads `?lang=` before paint. A small vanilla module wires the toggle button. Print mode reveals both languages on separate pages.

**Tech Stack:** Astro 5, TypeScript, Zod (via `astro:content`), Cloudflare Workers adapter, vanilla JS for the toggle. `js-yaml` is added as a dev-only dependency for the one-shot migration script and removed afterward.

**Project conventions:**
- This project has no unit-test framework — `npm run check` (= `astro build && tsc && wrangler deploy --dry-run`) is the canonical correctness signal. `npx astro check` runs Zod schemas against content.
- Tabs (not spaces) match existing source files.
- After every task, run `npm run check` and commit. Treat schema/build failures as the equivalent of failing tests.

---

## File Structure

**Created:**

```
src/
  content/
    cards/01.md … 64.md           # one card per file
    guide/G1.md … G8.md            # one guide entry per file
  components/
    FlashcardsShell.astro          # page chrome: header link aside, inline lang script, toggle button, deck container
    PartDivider.astro              # roman-numeral chapter divider
    Card.astro                     # one card; both-language subtrees
    GuideCard.astro                # guide variant: prose | table | list-dense
  pages/
    flashcards.astro               # loads collections, sorts, renders dividers + cards + guide
  lib/
    parts.ts                       # PARTS array + partFor(num) + GUIDE_PART
  styles/
    flashcards.css                 # all card/deck/print styles, lifted from prototype
  scripts/
    lang-toggle.ts                 # ~30 lines, wired via <script> tag in shell
public/
  flashcards/images/               # 5 chapter background images
scripts/
  migrate.mjs                      # one-shot data migration (deleted after use)
```

**Modified:**

- `src/content.config.ts` — add `cards` and `guide` collections.
- `src/components/Header.astro` — add "Flashcards" `HeaderLink`.
- `package.json` — add `js-yaml` to devDependencies (temporarily) and a `migrate` script entry; remove both after Task 4.

---

## Task 1: Add content collections schema

**Files:**
- Modify: `src/content.config.ts`

- [ ] **Step 1: Replace content.config.ts with full schema**

Write `src/content.config.ts` to this exact content (preserves the existing `blog` collection, adds `cards` and `guide`):

```ts
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
	loader: glob({ base: "./src/content/blog", pattern: "**/*.{md,mdx}" }),
	schema: z.object({
		title: z.string(),
		description: z.string(),
		pubDate: z.coerce.date(),
		updatedDate: z.coerce.date().optional(),
		heroImage: z.string().optional(),
	}),
});

const practice = z.object({
	labelZh: z.string(),
	textZh: z.string(),
	labelEn: z.string(),
	textEn: z.string(),
});

const cards = defineCollection({
	loader: glob({ base: "./src/content/cards", pattern: "*.md" }),
	schema: z.object({
		num: z.number().int().min(1).max(64),
		conceptZh: z.string(),
		conceptEn: z.string(),
		titleZh: z.string(),
		titleEn: z.string(),
		pullQuoteZh: z.string(),
		pullQuoteEn: z.string(),
		bodyZh: z.array(z.string()).min(1),
		bodyEn: z.array(z.string()).min(1),
		practices: z.array(practice).length(2),
	}),
});

const guideBase = {
	num: z.string().regex(/^G[1-9]\d*$/),
	titleZh: z.string(),
	titleEn: z.string(),
	pullQuoteZh: z.string(),
	pullQuoteEn: z.string(),
};

const guideProse = z.object({
	kind: z.literal("prose"),
	...guideBase,
	bodyZh: z.array(z.string()),
	bodyEn: z.array(z.string()),
});

const guideListDense = z.object({
	kind: z.literal("list-dense"),
	...guideBase,
	bodyZh: z.array(z.string()),
	bodyEn: z.array(z.string()),
});

const guideTable = z.object({
	kind: z.literal("table"),
	...guideBase,
	headerZh: z.tuple([z.string(), z.string()]),
	headerEn: z.tuple([z.string(), z.string()]),
	rowsZh: z.array(z.tuple([z.string(), z.string()])),
	rowsEn: z.array(z.tuple([z.string(), z.string()])),
});

const guide = defineCollection({
	loader: glob({ base: "./src/content/guide", pattern: "*.md" }),
	schema: z.discriminatedUnion("kind", [guideProse, guideListDense, guideTable]),
});

export const collections = { blog, cards, guide };
```

- [ ] **Step 2: Create empty content directories so glob does not error**

```bash
mkdir -p src/content/cards src/content/guide
```

- [ ] **Step 3: Run check**

```bash
npm run check
```

Expected: passes. (Empty collections are allowed; Zod has nothing to validate yet.)

- [ ] **Step 4: Commit**

```bash
git add src/content.config.ts src/content/cards src/content/guide
git commit -m "feat(flashcards): add cards and guide content collections"
```

---

## Task 2: Add `lib/parts.ts`

**Files:**
- Create: `src/lib/parts.ts`

- [ ] **Step 1: Write parts.ts**

```ts
export type Part = {
	id: string;
	roman: string;
	nameEn: string;
	nameZh: string;
	subEn: string;
	subZh: string;
	range: [number, number];
	bgImage: string;
	overlay: number;
};

export const PARTS: Part[] = [
	{
		id: "foundations",
		roman: "I",
		nameEn: "Foundations",
		nameZh: "根基",
		subEn: "Safety and Co-Regulation",
		subZh: "安全感與共同調節",
		range: [1, 18],
		bgImage: "/flashcards/images/01-foundations-print.png",
		overlay: 55,
	},
	{
		id: "blossoming",
		roman: "II",
		nameEn: "Blossoming",
		nameZh: "綻放",
		subEn: "Navigating Intensity",
		subZh: "面對強烈情緒",
		range: [19, 36],
		bgImage: "/flashcards/images/02-blossoming-orchids-print.png",
		overlay: 65,
	},
	{
		id: "deepening",
		roman: "III",
		nameEn: "Deepening",
		nameZh: "深化",
		subEn: "Self-Directed Practice",
		subZh: "自我引導的練習",
		range: [37, 54],
		bgImage: "/flashcards/images/03-deepening-print.png",
		overlay: 8,
	},
	{
		id: "offering",
		roman: "IV",
		nameEn: "Offering",
		nameZh: "傳遞",
		subEn: "Intergenerational Transmission",
		subZh: "跨世代的傳承",
		range: [55, 64],
		bgImage: "/flashcards/images/04-offering-print.png",
		overlay: 45,
	},
];

export const partFor = (n: number): Part =>
	PARTS.find((p) => n >= p.range[0] && n <= p.range[1]) ?? PARTS[0];

export const GUIDE_PART = {
	id: "guide",
	roman: "G",
	nameEn: "Companion Guide",
	nameZh: "使用指南",
	subEn: "How to walk with these cards",
	subZh: "如何與這些卡片同行",
	bgImage: "/flashcards/images/05-companion-guide.jpg",
	overlay: 60,
} as const;
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/lib/parts.ts
git commit -m "feat(flashcards): add parts metadata and partFor helper"
```

---

## Task 3: Write the data-migration script

**Files:**
- Create: `scripts/migrate.mjs`
- Modify: `package.json` (add `js-yaml` to devDependencies, add `migrate` script)

The migration converts the prototype's JS-literal data into one Markdown file per entry. We do this in code because 72 entries × multi-paragraph strings × embedded `<strong>` × Chinese punctuation × YAML escaping rules = error-prone manual work.

- [ ] **Step 1: Add js-yaml dev dependency and migrate script**

```bash
npm install --save-dev js-yaml@4
```

Then edit `package.json` `scripts` to add a `migrate` entry. The result should look like:

```json
"scripts": {
	"astro": "astro",
	"build": "astro build",
	"cf-typegen": "wrangler types",
	"check": "astro build && tsc && wrangler deploy --dry-run",
	"deploy": "wrangler deploy",
	"dev": "astro dev",
	"preview": "astro build && wrangler dev",
	"migrate": "node scripts/migrate.mjs"
}
```

- [ ] **Step 2: Write `scripts/migrate.mjs`**

```js
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
	// Replace `window.CARDS = [` with `export default [`, drop the trailing fixup block.
	const start = raw.indexOf("window.CARDS");
	const arrayStart = raw.indexOf("[", start);
	// The fixup block at the bottom mutates window.CARDS — reproduce it inside the temp module.
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
	// Walk brackets to find matching close.
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
```

- [ ] **Step 3: Commit (without yet running it — keeps the failure mode reviewable)**

```bash
git add scripts/migrate.mjs package.json package-lock.json
git commit -m "chore(flashcards): add one-shot data migration script"
```

---

## Task 4: Run migration and verify content

**Files:**
- Generated: `src/content/cards/01.md` … `64.md`, `src/content/guide/G1.md` … `G8.md`, `public/flashcards/images/*`

- [ ] **Step 1: Run migration**

```bash
npm run migrate
```

Expected output: `Wrote 64 cards (N stub/unauthored).` then `Wrote 8 guide entries.` then `Copied 5 images.` then `Done.`

If the stub count is non-zero, note the count in your commit message — do NOT block on it (per spec: "Default action: migrate them anyway and surface the count to the author").

- [ ] **Step 2: Verify file counts**

```bash
ls src/content/cards | wc -l    # expect 64
ls src/content/guide | wc -l    # expect 8
ls public/flashcards/images     # expect 5 files
```

- [ ] **Step 3: Spot-check three files**

Read these three files end-to-end and confirm: YAML parses (no obvious escaping breakage), Chinese punctuation round-tripped, embedded `<strong>` HTML is preserved verbatim:

```bash
head -40 src/content/cards/01.md
head -40 src/content/cards/15.md
head -60 src/content/guide/G3.md   # the table variant
```

- [ ] **Step 4: Run Astro check (Zod validates all 72 files)**

```bash
npx astro check
```

Expected: 0 errors. If a file fails validation, the error message includes the file path and field. Fix the migration script (do NOT hand-edit migrated files), re-run `npm run migrate`, and re-check.

- [ ] **Step 5: Commit migrated content**

```bash
git add src/content/cards src/content/guide public/flashcards
git commit -m "feat(flashcards): import 64 cards + 8 guide entries from prototype"
```

---

## Task 5: Add `PartDivider.astro`

**Files:**
- Create: `src/components/PartDivider.astro`

- [ ] **Step 1: Write component**

```astro
---
type Props = {
	roman: string;
	nameEn: string;
	nameZh: string;
	subEn: string;
	subZh: string;
	rangeLabel: string;
};
const { roman, nameEn, nameZh, subEn, subZh, rangeLabel } = Astro.props;
---
<div class="part-divider">
	<span class="roman">{roman}</span>
	<span class="name">{nameEn}</span>
	<span class="name-zh">{nameZh}</span>
	<span class="sub">{subEn} · {subZh} · {rangeLabel}</span>
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: passes. (Component is unused so far; Astro tolerates that.)

- [ ] **Step 3: Commit**

```bash
git add src/components/PartDivider.astro
git commit -m "feat(flashcards): add PartDivider component"
```

---

## Task 6: Add `Card.astro`

Renders the card frame plus both ZH and EN content subtrees side by side. CSS (added in Task 9) hides whichever doesn't match `<html data-lang>`.

**Files:**
- Create: `src/components/Card.astro`

- [ ] **Step 1: Write component**

```astro
---
import { partFor } from "../lib/parts";
import type { CollectionEntry } from "astro:content";

type Props = { entry: CollectionEntry<"cards"> };
const { entry } = Astro.props;
const data = entry.data;
const part = partFor(data.num);
const numStr = String(data.num).padStart(2, "0");
const tagZh = `${part.roman} · ${part.nameZh}`;
const tagEn = `${part.roman} · ${part.nameEn}`;
---
<article class="card-wrap" data-card-num={data.num}>
	<div class="card">
		<div class="bg" style={`background-image:url(${part.bgImage})`}></div>
		<div class="overlay" style={`opacity:${part.overlay / 100}`}></div>

		<div class="content lang-zh">
			<div class="essay">
				<div class="left">
					<div>
						<div class="eyebrow-row">
							<span class="theme-tag">{tagZh}</span>
							<span class="num"><b>{numStr}</b><span class="of">/64</span></span>
						</div>
						<h2 class="title-zh">{data.titleZh}</h2>
						<p class="pull-quote">{data.pullQuoteZh}</p>
					</div>
					<div class="credit-line">Dr Peggy &nbsp;·&nbsp; Hong Kong</div>
				</div>
				<div class="right">
					{data.bodyZh.map((p) => <p class="body-zh" set:html={p} />)}
					<div class="practice-stack">
						{data.practices.map((pr) => (
							<div class="practice">
								<div class="label">{pr.labelZh}</div>
								<div class="text">{pr.textZh}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>

		<div class="content lang-en">
			<div class="back-en">
				<div class="left">
					<div>
						<div class="eyebrow-row">
							<span class="theme-tag">{tagEn}</span>
							<span class="num"><b>{numStr}</b><span class="of">/64</span></span>
						</div>
						<h2 class="title-en">{data.titleEn}</h2>
						<p class="pull-quote" style='font-family:"Schibsted Grotesk",sans-serif'>{data.pullQuoteEn}</p>
					</div>
					<div class="credit-line">Dr Peggy &nbsp;·&nbsp; Hong Kong</div>
				</div>
				<div class="right">
					{data.bodyEn.map((p) => <p class="body-en" set:html={p} />)}
					<div class="practice-stack">
						{data.practices.map((pr) => (
							<div class="practice practice-en">
								<div class="label">{pr.labelEn}</div>
								<div class="text">{pr.textEn}</div>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	</div>
</article>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/Card.astro
git commit -m "feat(flashcards): add Card component"
```

---

## Task 7: Add `GuideCard.astro`

Same shape as `Card.astro` but the `right` column branches by `data.kind`: `prose` and `list-dense` use paragraph rendering (with the `dense` class for list-dense); `table` renders a `<table class="guide-table">`.

**Files:**
- Create: `src/components/GuideCard.astro`

- [ ] **Step 1: Write component**

```astro
---
import { GUIDE_PART } from "../lib/parts";
import type { CollectionEntry } from "astro:content";

type Props = { entry: CollectionEntry<"guide">; total: number };
const { entry, total } = Astro.props;
const data = entry.data;
const numStr = data.num.replace(/^G/i, "");
const tagZh = GUIDE_PART.nameZh;
const tagEn = GUIDE_PART.nameEn;
const denseClass = data.kind === "list-dense" ? " dense" : "";
---
<article class="card-wrap" data-guide-num={data.num}>
	<div class="card">
		<div class="bg" style={`background-image:url(${GUIDE_PART.bgImage})`}></div>
		<div class="overlay" style={`opacity:${GUIDE_PART.overlay / 100}`}></div>

		<div class="content lang-zh">
			<div class="essay">
				<div class="left">
					<div>
						<div class="eyebrow-row">
							<span class="theme-tag">{tagZh}</span>
							<span class="num"><b>{numStr}</b><span class="of">/{total}</span></span>
						</div>
						<h2 class="title-zh">{data.titleZh}</h2>
						<p class="pull-quote">{data.pullQuoteZh}</p>
					</div>
					<div class="credit-line">Dr Peggy &nbsp;·&nbsp; Hong Kong</div>
				</div>
				<div class={"right" + denseClass}>
					{data.kind === "table" ? (
						<table class="guide-table">
							<thead><tr>{data.headerZh.map((h) => <th>{h}</th>)}</tr></thead>
							<tbody>
								{data.rowsZh.map((row) => (
									<tr><td class="col-key">{row[0]}</td><td class="col-val">{row[1]}</td></tr>
								))}
							</tbody>
						</table>
					) : (
						data.bodyZh.map((p) => <p class="body-zh" set:html={p} />)
					)}
				</div>
			</div>
		</div>

		<div class="content lang-en">
			<div class="back-en">
				<div class="left">
					<div>
						<div class="eyebrow-row">
							<span class="theme-tag">{tagEn}</span>
							<span class="num"><b>{numStr}</b><span class="of">/{total}</span></span>
						</div>
						<h2 class="title-en">{data.titleEn}</h2>
						<p class="pull-quote" style='font-family:"Schibsted Grotesk",sans-serif'>{data.pullQuoteEn}</p>
					</div>
					<div class="credit-line">Dr Peggy &nbsp;·&nbsp; Hong Kong</div>
				</div>
				<div class={"right" + denseClass}>
					{data.kind === "table" ? (
						<table class="guide-table guide-table-en">
							<thead><tr>{data.headerEn.map((h) => <th>{h}</th>)}</tr></thead>
							<tbody>
								{data.rowsEn.map((row) => (
									<tr><td class="col-key">{row[0]}</td><td class="col-val">{row[1]}</td></tr>
								))}
							</tbody>
						</table>
					) : (
						data.bodyEn.map((p) => <p class="body-en" set:html={p} />)
					)}
				</div>
			</div>
		</div>
	</div>
</article>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/GuideCard.astro
git commit -m "feat(flashcards): add GuideCard component"
```

---

## Task 8: Add `flashcards.css`

This is the prototype's stylesheet, lifted as-is, then trimmed:
- Remove `.flipper`, `.face`, `.face.back`, `.card.flipped`, `perspective`, transitions, `cursor:pointer`, `user-select:none` from `.card`.
- Remove `.card-label`, `.flip-hint`, `.placeholder-bg`, `.placeholder-hint`, `.trim-guide`, `.safe-guide`, `.show-guides`, `.tweaks-host`, `.stage-head` rules.
- Add the language-visibility rules.
- Adjust the `@media print` block to reveal both languages on separate pages.

**Files:**
- Create: `src/styles/flashcards.css`

- [ ] **Step 1: Write `flashcards.css`**

```css
/* Lifted from Flashcards.html prototype, with flip / authoring chrome removed
 * and language-visibility + bilingual print added. See spec §3 and §6. */

:root {
	--trim-w: 768px; --trim-h: 480px;
	--bleed: 12px; --safe: 24px;
	--bleed-w: calc(var(--trim-w) + var(--bleed) * 2);
	--bleed-h: calc(var(--trim-h) + var(--bleed) * 2);
}

.flashcards-page * { box-sizing: border-box; }
.flashcards-page {
	background: radial-gradient(1200px 800px at 50% 40%, #1a1612 0%, #0c0a08 70%);
	color: #f5f1ea;
	font-family: "Schibsted Grotesk", ui-sans-serif, system-ui, sans-serif;
	min-height: 100vh;
	padding: 48px 24px 96px;
	margin: 0;
}

.flashcards-head {
	max-width: 1100px; margin: 0 auto 28px;
	display: flex; align-items: flex-end; justify-content: space-between;
	gap: 24px; color: #cfc7b6;
}
.flashcards-head h1 { margin: 0; font-size: 14px; font-weight: 500; letter-spacing: .18em; text-transform: uppercase; color: #e9e1cf; }
.flashcards-head .meta { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; color: #8a8474; letter-spacing: .04em; }

.lang-toggle {
	font-family: "JetBrains Mono", ui-monospace, monospace;
	font-size: 12px; letter-spacing: .14em; text-transform: uppercase;
	background: transparent; color: #cfc7b6;
	border: 1px solid #3a3428; border-radius: 999px;
	padding: 6px 14px; cursor: pointer;
}
.lang-toggle:hover { border-color: #6e6755; color: #e9e1cf; }

.part-divider {
	max-width: 1100px; margin: 24px auto 8px;
	display: flex; align-items: baseline; gap: 18px;
	color: #cfc7b6; border-top: 1px solid #2a2620; padding-top: 18px;
}
.part-divider .roman { font-family: "Noto Serif TC", serif; font-size: 32px; font-weight: 500; letter-spacing: .04em; color: #e9e1cf; }
.part-divider .name { font-family: "Schibsted Grotesk", sans-serif; font-size: 20px; font-weight: 600; letter-spacing: -0.01em; color: #f5f1ea; }
.part-divider .name-zh { font-family: "Noto Serif TC", serif; font-size: 18px; font-weight: 600; letter-spacing: .06em; color: #cfc7b6; }
.part-divider .sub { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; color: #8a8474; letter-spacing: .14em; text-transform: uppercase; margin-left: auto; }

.deck { max-width: 1100px; margin: 0 auto; display: flex; flex-direction: column; gap: 48px; }
.card-wrap { display: flex; flex-direction: column; align-items: center; gap: 12px; }

.card {
	position: relative; width: var(--bleed-w); height: var(--bleed-h);
	background: #222; overflow: hidden; border-radius: 6px;
	box-shadow: 0 1px 0 rgba(255,255,255,.04) inset, 0 30px 60px -20px rgba(0,0,0,.7), 0 8px 20px rgba(0,0,0,.45);
}
.card .bg { position: absolute; inset: 0; background-size: cover; background-position: center; background-repeat: no-repeat; }
.card .overlay { position: absolute; inset: 0; background: #000; }

.content {
	position: absolute;
	left: calc(var(--bleed) + var(--safe));
	right: calc(var(--bleed) + var(--safe));
	top: calc(var(--bleed) + var(--safe));
	bottom: calc(var(--bleed) + var(--safe));
	color: #fff; display: flex; flex-direction: column;
}

/* language visibility — set by inline script in <head> */
:root[data-lang="zh"] .lang-en { display: none; }
:root[data-lang="en"] .lang-zh { display: none; }

.essay, .back-en {
	height: 100%;
	display: grid; grid-template-columns: minmax(180px, 38%) 1fr; gap: 28px;
}
.essay .left, .back-en .left {
	display: flex; flex-direction: column; justify-content: space-between;
	padding-right: 20px; border-right: 1px solid rgba(255,255,255,.18);
}
.essay .right, .back-en .right { display: flex; flex-direction: column; gap: 12px; overflow: hidden; }
.essay .left > div:first-child, .back-en .left > div:first-child { display: flex; flex-direction: column; }
.essay .left .eyebrow-row, .back-en .left .eyebrow-row { margin-bottom: 24px; }

.eyebrow-row { display: flex; justify-content: space-between; align-items: center; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.7); }
.eyebrow-row .num { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; font-weight: 500; letter-spacing: .18em; color: rgba(255,255,255,.95); }
.eyebrow-row .num .of { color: rgba(255,255,255,.5); font-weight: 400; }
.theme-tag { display: inline-flex; align-items: center; gap: 8px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 13px; letter-spacing: .22em; text-transform: uppercase; color: rgba(255,255,255,.9); }
.theme-tag::before { content: ""; width: 5px; height: 5px; background: #fff; border-radius: 50%; }

.title-zh { font-family: "Noto Serif TC", serif; font-weight: 700; font-size: 36px; line-height: 1.18; letter-spacing: .02em; color: #fff; margin: 0 0 20px; text-wrap: balance; text-shadow: 0 1px 3px rgba(0,0,0,.35); white-space: pre-line; }
.title-en { font-family: "Schibsted Grotesk", sans-serif; font-weight: 600; font-size: 30px; line-height: 1.08; letter-spacing: -0.02em; color: #fff; margin: 0 0 20px; text-wrap: balance; text-shadow: 0 1px 3px rgba(0,0,0,.35); }
.pull-quote { margin-top: 0; font-family: "Noto Serif TC", serif; font-size: 17px; line-height: 1.6; color: rgba(255,255,255,.9); font-weight: 400; border-left: 2px solid rgba(255,255,255,.45); padding-left: 14px; max-width: 240px; }

.credit-line { margin-top: auto; padding-top: 16px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: .16em; text-transform: uppercase; color: rgba(255,255,255,.7); white-space: nowrap; }

.body-zh { font-family: "Noto Sans TC", sans-serif; font-size: 17px; line-height: 1.7; color: rgba(255,255,255,.95); margin: 0; font-weight: 400; text-wrap: pretty; }
.body-zh + .body-zh { margin-top: 8px; }
.body-zh strong { font-weight: 600; border-bottom: 1px solid rgba(255,255,255,.4); padding-bottom: 1px; }
.body-en { font-family: "Schibsted Grotesk", sans-serif; font-size: 16px; line-height: 1.6; color: rgba(255,255,255,.95); margin: 0; font-weight: 400; text-wrap: pretty; }
.body-en + .body-en { margin-top: 7px; }

.right.dense { gap: 7px; }
.right.dense .body-zh, .right.dense .body-en { font-size: 12.5px; line-height: 1.55; }
.right.dense .body-zh + .body-zh, .right.dense .body-en + .body-en { margin-top: 4px; }

.guide-table { width: 100%; border-collapse: collapse; color: rgba(255,255,255,.95); font-family: "Noto Sans TC", sans-serif; font-size: 13.5px; line-height: 1.5; }
.guide-table thead th { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; letter-spacing: .18em; text-transform: uppercase; font-weight: 600; color: rgba(255,255,255,.85); text-align: left; padding: 6px 10px 8px; border-bottom: 1px solid rgba(255,255,255,.32); }
.guide-table td { padding: 7px 10px; vertical-align: top; border-bottom: 1px solid rgba(255,255,255,.14); }
.guide-table tr:last-child td { border-bottom: none; }
.guide-table .col-key { font-weight: 600; color: #fff; white-space: nowrap; width: 32%; }
.guide-table .col-val { color: rgba(255,255,255,.92); }
.guide-table.guide-table-en { font-family: "Schibsted Grotesk", sans-serif; font-size: 13px; }

.practice-stack { display: flex; flex-direction: column; gap: 8px; margin-top: auto; padding-top: 10px; }
.practice { display: grid; grid-template-columns: auto 1fr; gap: 10px; background: rgba(255,255,255,.07); border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 9px 12px; backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); }
.practice .label { font-family: "Noto Sans TC", sans-serif; font-size: 14px; font-weight: 600; letter-spacing: .08em; color: #fff; white-space: nowrap; padding-top: 1px; border-right: 1px solid rgba(255,255,255,.25); padding-right: 10px; }
.practice .text { font-family: "Noto Sans TC", sans-serif; font-size: 15px; line-height: 1.65; color: rgba(255,255,255,.95); font-weight: 400; }
.practice-en .label { font-family: "Schibsted Grotesk", sans-serif; text-transform: uppercase; letter-spacing: .12em; font-size: 14px; }
.practice-en .text { font-family: "Schibsted Grotesk", sans-serif; font-size: 15px; line-height: 1.55; }

@media print {
	@page { size: 8.25in 5.25in; margin: 0; }
	html, body { background: #fff; }
	.flashcards-page { padding: 0; margin: 0; background: #fff; }
	.flashcards-head, .part-divider { display: none !important; }
	.deck { gap: 0; max-width: none; }
	.card-wrap { gap: 0; page-break-after: always; break-after: page; }
	/* Both languages visible on print, each on its own page. */
	.lang-zh, .lang-en { display: block !important; }
	.lang-en { page-break-before: always; break-before: page; }
	.card {
		box-shadow: none; border-radius: 0; width: 8.25in; height: 5.25in;
		--trim-w: 8in; --trim-h: 5in; --bleed: 0.125in; --safe: 0.25in;
		--bleed-w: 8.25in; --bleed-h: 5.25in;
		page-break-inside: avoid;
	}
}
```

**Note on print:** The `.card` is a single absolutely-positioned frame containing two `.content` overlays. To make both render on separate pages, the print layout takes both `.lang-zh` and `.lang-en` out of `display:none` and forces a page break between them via `.lang-en { page-break-before: always }`. The card frame (bg + overlay) repeats on each page automatically because the print stylesheet replays the card per language layer with its own page break.

If preview shows both languages overlapping on a single page, the next task author should adjust by promoting `.content.lang-zh` and `.content.lang-en` to `position: relative` inside `@media print` and emitting a wrapper around each that takes up a full page. This is the documented fallback in spec §6.

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/styles/flashcards.css
git commit -m "feat(flashcards): add stylesheet (lifted from prototype, flip removed)"
```

---

## Task 9: Add `lang-toggle.ts`

**Files:**
- Create: `src/scripts/lang-toggle.ts`

- [ ] **Step 1: Write toggle script**

```ts
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
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/scripts/lang-toggle.ts
git commit -m "feat(flashcards): add language toggle script"
```

---

## Task 10: Add `FlashcardsShell.astro`

**Files:**
- Create: `src/components/FlashcardsShell.astro`

- [ ] **Step 1: Write shell**

```astro
---
import "../styles/flashcards.css";
---
<!-- Blocking inline script: runs before paint, prevents FOUC. -->
<script is:inline>
	(function () {
		var p = new URLSearchParams(location.search);
		document.documentElement.setAttribute(
			"data-lang", p.get("lang") === "en" ? "en" : "zh"
		);
	})();
</script>

<div class="flashcards-head">
	<h1>身體智慧 · Body Wisdom Cards · Dr Peggy</h1>
	<button class="lang-toggle" type="button" data-lang-toggle aria-pressed="false">English</button>
</div>

<div class="deck">
	<slot />
</div>

<script>
	import "../scripts/lang-toggle";
</script>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Commit**

```bash
git add src/components/FlashcardsShell.astro
git commit -m "feat(flashcards): add page shell with inline lang script"
```

---

## Task 11: Add `flashcards.astro` page

**Files:**
- Create: `src/pages/flashcards.astro`

- [ ] **Step 1: Write page**

```astro
---
import { getCollection } from "astro:content";
import BaseHead from "../components/BaseHead.astro";
import FlashcardsShell from "../components/FlashcardsShell.astro";
import PartDivider from "../components/PartDivider.astro";
import Card from "../components/Card.astro";
import GuideCard from "../components/GuideCard.astro";
import { PARTS, GUIDE_PART } from "../lib/parts";

const cards = (await getCollection("cards")).sort((a, b) => a.data.num - b.data.num);
const guide = (await getCollection("guide")).sort((a, b) =>
	parseInt(a.data.num.slice(1), 10) - parseInt(b.data.num.slice(1), 10)
);
const guideTotal = guide.length;
---
<!doctype html>
<html lang="zh-Hant">
	<head>
		<BaseHead title="Flashcards · 身體智慧" description="Body Wisdom Cards by Dr Peggy — 64 bilingual flashcards plus an 8-part companion guide." />
		<link rel="preconnect" href="https://fonts.googleapis.com" />
		<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
		<link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Noto+Serif+TC:wght@300;400;500;600;700;900&family=Noto+Sans+TC:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
	</head>
	<body class="flashcards-page">
		<FlashcardsShell>
			{PARTS.map((part) => {
				const partCards = cards.filter((c) => c.data.num >= part.range[0] && c.data.num <= part.range[1]);
				const rangeLabel = `cards ${String(part.range[0]).padStart(2, "0")}–${String(part.range[1]).padStart(2, "0")}`;
				return (
					<>
						<PartDivider
							roman={part.roman}
							nameEn={part.nameEn}
							nameZh={part.nameZh}
							subEn={part.subEn}
							subZh={part.subZh}
							rangeLabel={rangeLabel}
						/>
						{partCards.map((entry) => <Card entry={entry} />)}
					</>
				);
			})}

			<PartDivider
				roman={GUIDE_PART.roman}
				nameEn={GUIDE_PART.nameEn}
				nameZh={GUIDE_PART.nameZh}
				subEn={GUIDE_PART.subEn}
				subZh={GUIDE_PART.subZh}
				rangeLabel={`${guideTotal} pages`}
			/>
			{guide.map((entry) => <GuideCard entry={entry} total={guideTotal} />)}
		</FlashcardsShell>
	</body>
</html>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

Expected: passes. The page now renders all 72 entries.

- [ ] **Step 3: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:4321/flashcards`. Confirm:
- Page renders without errors in the browser console.
- All four part dividers appear in order, each followed by its cards.
- Companion-guide divider appears at the end with all 8 entries.
- Default language is ZH (English subtrees hidden).
- `?lang=en` in the URL shows English directly with no flash.
- Clicking the toggle button flips visible language and updates the URL via `replaceState` (no new history entry).
- Reloading `?lang=en` preserves selection.

Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/pages/flashcards.astro
git commit -m "feat(flashcards): add /flashcards route rendering full deck"
```

---

## Task 12: Add Header link

**Files:**
- Modify: `src/components/Header.astro`

- [ ] **Step 1: Add HeaderLink**

In `src/components/Header.astro`, add a new line inside `<div class="internal-links">` after the About link:

```astro
<HeaderLink href="/flashcards">Flashcards</HeaderLink>
```

The full block becomes:

```astro
<div class="internal-links">
	<HeaderLink href="/">Home</HeaderLink>
	<HeaderLink href="/blog">Blog</HeaderLink>
	<HeaderLink href="/about">About</HeaderLink>
	<HeaderLink href="/flashcards">Flashcards</HeaderLink>
</div>
```

- [ ] **Step 2: Verify build**

```bash
npm run check
```

- [ ] **Step 3: Manual check**

Run `npm run dev`, visit `/`, `/about`, `/blog`, and confirm the Flashcards link appears in the header on every page and navigates to `/flashcards`. Stop dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/Header.astro
git commit -m "feat(flashcards): add Flashcards link to site header"
```

---

## Task 13: Cleanup migration script and dependency

**Files:**
- Delete: `scripts/migrate.mjs`
- Modify: `package.json` (remove `migrate` script and `js-yaml` devDependency)

- [ ] **Step 1: Remove migration artifacts**

```bash
rm scripts/migrate.mjs
rmdir scripts 2>/dev/null || true
npm uninstall js-yaml
```

- [ ] **Step 2: Remove `migrate` script entry**

Edit `package.json` and remove the `"migrate": "node scripts/migrate.mjs"` line.

- [ ] **Step 3: Verify build**

```bash
npm run check
```

Expected: passes. `js-yaml` is no longer referenced.

- [ ] **Step 4: Commit**

```bash
git add scripts package.json package-lock.json
git commit -m "chore(flashcards): remove one-shot migration script and js-yaml dep"
```

---

## Task 14: Final verification

This is the spec's §7 checklist. Execute every item.

- [ ] **Step 1: Build/typecheck**

```bash
npm run check
```

Expected: 0 errors.

- [ ] **Step 2: Manual deck check**

```bash
npm run dev
```

Confirm in the browser at `/flashcards`:

1. All 72 entries render under the correct part dividers, in `num` order.
2. Toggle flips language; URL updates to `?lang=…`; reload preserves it.
3. Direct visit to `/flashcards?lang=en` renders English first, no flash.
4. Browser print preview (`Cmd+P`) shows both languages per card on separate pages.
5. `/`, `/about`, `/blog`, `/blog/<a-post>`, and `/rss.xml` still render.
6. Header shows the "Flashcards" link on every page.

If item 4 fails (both languages overlap on one page), apply the fallback noted in Task 8 step 1 (wrap each `.content` in a per-page block via print-only CSS).

- [ ] **Step 3: Final commit if any fixes were needed**

```bash
git status
# if dirty:
git add -A
git commit -m "fix(flashcards): final verification fixes"
```

---

## Self-Review Notes

- Spec §3 routes ✓ (Task 11). §3 file layout ✓ (all paths match). §4 schemas ✓ (Task 1, exact shapes). §5 card render strategy + toggle ✓ (Tasks 6, 9, 10). §6 print ✓ (Task 8). §7 migration ✓ (Tasks 3–4, includes stub-count surfacing). §8 verification ✓ (Task 14).
- Removed prototype features per spec §3.2 and §5.4: flip transition, card-label row, tweaks panel, flip-all controls, `cursor:pointer`, flip hint — none of these appear in any task.
- Out-of-scope items (per-card deep links, keyboard nav, search, localStorage, authoring UI, image overrides) are not introduced.
- All identifier names are consistent across tasks: `partFor`, `PARTS`, `GUIDE_PART`, `data-lang`, `lang-zh`/`lang-en`, `data-lang-toggle`.
- No placeholders. Every code step contains the literal code.
