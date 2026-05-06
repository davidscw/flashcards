# Flashcards Deck Port — Design Spec

**Date:** 2026-05-06
**Status:** Approved for implementation planning

## Goal

Port the existing standalone `Flashcards.html` prototype (a bilingual ZH/EN "Body Wisdom Cards" deck of 64 cards + 8 companion-guide pages) into the project's Astro / Cloudflare Workers app. Preserve the prototype's look, typography, layout, parts structure, and print output. Drop the click-to-flip interaction and instead select language at the app-shell level.

## Scope changes vs. prototype

The port is faithful in look and content but diverges in three places:

1. **No flip.** Each card is single-sided. The card body, eyebrow row, and practices structure that lived on the prototype's "front" face become the only face.
2. **Language is global, not per-card.** A toggle in the deck's app shell selects ZH or EN for the whole deck. URL `?lang=zh|en` is the source of truth.
3. **Authoring chrome is dropped.** The dev "tweaks panel" (overlay slider, font scale, text-position toggle, image blur, trim/safe guides, "show only authored" filter, "All EN / All 繁體" / "Print" buttons) is not ported. The deck-wide flip-all controls are subsumed by the language toggle. The per-card developer label row above each card is also removed.

Otherwise the visual design — fonts, two-column layout, chapter background images with overlay, part dividers, companion-guide section, print page sizing — is unchanged.

## Architecture

### Routes

- `/flashcards` — single static page rendering the entire deck. Both languages embedded in HTML; CSS hides the inactive one based on `<html data-lang>`.
- Existing `/`, `/about`, `/blog/[…slug]`, `/rss.xml` are untouched.

### File layout (new and changed)

```
src/
  content.config.ts            # add `cards` and `guide` collections alongside existing `blog`
  content/
    cards/01.md … 64.md        # one card per file
    guide/G1.md … G8.md        # one guide entry per file
  components/
    Header.astro               # add "Flashcards" link
    FlashcardsShell.astro      # page chrome: title, lang toggle, deck container, blocking inline lang script
    PartDivider.astro          # roman-numeral chapter divider
    Card.astro                 # one card; both-language content side-by-side
    GuideCard.astro            # variant: handles prose | table | list-dense layouts
  pages/
    flashcards.astro           # loads collections, sorts by num, emits dividers + cards
  lib/
    parts.ts                   # PARTS array + partFor(num) — derives part from card number
  styles/
    flashcards.css             # all card/deck/print styles, lifted from the prototype
public/
  flashcards/images/           # the 5 chapter background images
```

### Implementation tech

Pure Astro components plus one tiny vanilla-JS module for the language toggle. **No React, Preact, or any framework runtime ships.** The prototype's React usage was shallow (one boolean per card to track flip state); without flip, there is no client state to manage.

## Content schema

Each card and guide entry is a single Markdown file. Body is empty; everything is in YAML frontmatter. The card's "part" (Foundations 1–18, Blossoming 19–36, Deepening 37–54, Offering 55–64) is **derived from `num`** at render time, not stored — preventing drift between number ranges and a denormalized field.

### Card schema (Zod)

```ts
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
    practices: z.array(z.object({
      labelZh: z.string(),
      textZh: z.string(),
      labelEn: z.string(),
      textEn: z.string(),
    })).length(2),
  }),
});
```

Body paragraphs may contain inline `<strong>…</strong>` HTML. This is preserved verbatim from source data and rendered with `set:html` at template time (matching the prototype's `dangerouslySetInnerHTML`). Authoring is closed (we control all input), so XSS is not in scope.

### Guide schema (discriminated union)

Guide entries fall into three layouts. `kind` is required on every guide file.

```ts
const base = {
  num: z.string().regex(/^G[1-9]\d*$/),
  titleZh: z.string(), titleEn: z.string(),
  pullQuoteZh: z.string(), pullQuoteEn: z.string(),
};
const guideProse     = z.object({ kind: z.literal("prose"),
  ...base, bodyZh: z.array(z.string()), bodyEn: z.array(z.string()) });
const guideListDense = z.object({ kind: z.literal("list-dense"),
  ...base, bodyZh: z.array(z.string()), bodyEn: z.array(z.string()) });
const guideTable     = z.object({ kind: z.literal("table"),
  ...base,
  headerZh: z.tuple([z.string(), z.string()]),
  headerEn: z.tuple([z.string(), z.string()]),
  rowsZh: z.array(z.tuple([z.string(), z.string()])),
  rowsEn: z.array(z.tuple([z.string(), z.string()])),
});
const guide = defineCollection({
  loader: glob({ base: "./src/content/guide", pattern: "*.md" }),
  schema: z.discriminatedUnion("kind", [guideProse, guideListDense, guideTable]),
});
```

Mapping from existing data: G1, G2, G4, G5, G8 → `prose`; G3, G6 → `table`; G7 → `list-dense`.

## Card component & language toggle

### Render strategy

Each `Card.astro` emits one card frame containing **two** content subtrees side-by-side in the DOM — one ZH, one EN. CSS hides whichever doesn't match `<html data-lang>`. The frame chrome (background image, overlay, two-column grid, eyebrow row layout, practice stack layout) is shared markup; only the language-specific text differs.

```astro
<article class="card">
  <div class="bg" style={`background-image:url(${part.bgImage})`} />
  <div class="overlay" />
  <div class="content lang-zh">
    {/* eyebrow (theme-tag-zh + num), title-zh, pull-quote-zh,
        body-zh paragraphs, practices.labelZh+textZh */}
  </div>
  <div class="content lang-en">
    {/* eyebrow (theme-tag-en + num), title-en, pull-quote-en,
        body-en paragraphs, practices.labelEn+textEn */}
  </div>
</article>
```

Visibility:

```css
:root[data-lang="zh"] .lang-en { display: none; }
:root[data-lang="en"] .lang-zh { display: none; }
```

### Toggle behavior

A blocking inline script in the page `<head>` runs before paint to avoid FOUC. It reads `?lang=` and sets `<html data-lang>`:

```html
<script is:inline>
  var p = new URLSearchParams(location.search);
  document.documentElement.setAttribute(
    "data-lang", p.get("lang") === "en" ? "en" : "zh"
  );
</script>
```

A small (~30 lines) module wired to the toggle button:

- Reads current `data-lang`, flips it.
- Updates `<html data-lang>`.
- Calls `history.replaceState({}, "", url-with-new-lang-param)` — toggle isn't navigation, so we don't add history entries.
- Updates the button's label and `aria-pressed` state.

**Default language: ZH.** Matches the prototype, where ZH was the authored front face. URL is the single source of truth — no localStorage.

### Removed from prototype

- `.flipper`, `.face.front/back`, `perspective`, flip transition, `.card.flipped`.
- `cursor: pointer` on the card frame; "click to flip" hint badge.
- The developer `card-label` row above each card.
- The tweaks panel (`tweaks-panel.jsx`) and all its controls.

## Print mode

Decision: **print both languages per card** (two pages per card → 144 pages for the cards section, 16 pages for the guide). Preserves the prototype's intent of a bilingual physical deck.

Implementation:

- The print stylesheet sets `:root[data-lang]` to a state that displays both `.lang-zh` and `.lang-en`, but each on a separate page break.
- Card markup is reordered for print: each card emits ZH first, EN second, with `page-break-after: always` between them. The two language subtrees that were `display: none` on screen become visible siblings on paper.
- Page sizing (`8.25in × 5.25in` landscape with `0.125"` bleed and `0.25"` safe area) is lifted unchanged from the prototype's `@media print` block.

## Data migration

72 entries with multi-paragraph strings, embedded HTML, Chinese punctuation, and YAML escaping rules — manual transcription would be error-prone. Use a one-shot Node script.

### Source files

- `/Users/wongsc/Downloads/flashcards 2/cards-data.jsx` — 64 cards as `window.CARDS = [...]`.
- `/Users/wongsc/Downloads/flashcards 2/Flashcards.html` — 8 guide entries as inline `const GUIDE_CARDS = [...]`.
- `/Users/wongsc/Downloads/flashcards 2/images/` — copy `01-foundations-print.png`, `02-blossoming-orchids-print.png`, `03-deepening-print.png`, `04-offering-print.png`, and `05-companion-guide.jpg`. All five files are present in source.

### Script (`scripts/migrate.mjs`, deleted after use)

1. **Cards.** Read `cards-data.jsx` as text. Rewrite trailer `window.CARDS =` → `export default`, write to a temp `.mjs`, dynamic-import it. (Avoids regex-parsing the JSX literal.)
2. **Guide.** Same idea — extract `const GUIDE_CARDS = [...]` block from `Flashcards.html` between known anchors into a temp `.mjs`, dynamic-import it.
3. **For each entry,** serialize frontmatter with `js-yaml` (`{ lineWidth: -1, noCompatMode: true, quotingType: '"' }`) and write `<num>.md` (zero-padded for cards) containing `---\n<yaml>\n---\n`. `js-yaml`'s double-quoted scalars round-trip Chinese punctuation, English colons, and embedded `<strong>` tags without manual escaping.
4. **Images.** Plain `cp` of the 5 image files to `public/flashcards/images/`.

### Verify

1. `npx astro check` — Zod runs against all 72 files; any schema mismatch surfaces with file path + field.
2. Eyeball 3 sample files (one short, one with multiple body paragraphs, one guide-table).
3. `npm run dev`, scan the deck visually, toggle ZH↔EN.

### Cleanup

- Delete `scripts/migrate.mjs`.
- Remove `js-yaml` from `devDependencies` (only used by the migration script).

### Authored-vs-stub caveat

The prototype's `isAuthored()` helper flags placeholder strings starting with `（請傳入`. During migration, log any entry that fails this check. Default action: migrate them anyway and surface the count to the author.

## Verification at end of implementation

1. `npm run check` (already configured: `astro build && tsc && wrangler deploy --dry-run`) passes.
2. Manual: `/flashcards` renders all 72 entries grouped under correct part dividers, in `num` order.
3. Manual: language toggle flips all visible content; URL updates to `?lang=…`; reloading the URL preserves selection.
4. Manual: visiting `/flashcards?lang=en` directly renders English first, no flash.
5. Manual: browser print preview shows both languages per card on separate pages.
6. Manual: existing `/`, `/about`, `/blog/*`, `/rss.xml` still render.
7. Manual: header shows "Flashcards" link on every page.

## Out of scope

- Per-card deep links (e.g., `/flashcards/03`).
- Keyboard navigation between cards.
- Search, filtering, or favoriting.
- localStorage persistence of language choice.
- Authoring UI for the cards.
- Conversion of inline `<strong>` HTML to markdown emphasis.
- Migration of any of the prototype's image-overlay or font-scale tuning controls.
- Per-card image overrides (the prototype's optional `data.bgImage`).
- A 5th "tweaks" or filter panel.
