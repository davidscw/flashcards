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
