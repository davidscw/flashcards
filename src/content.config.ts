import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

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

export const collections = { cards, guide };
