import { getImage } from "astro:assets";
import foundationsBg from "../assets/flashcards/01-foundations-print.png";
import blossomingBg from "../assets/flashcards/02-blossoming-orchids-print.png";
import deepeningBg from "../assets/flashcards/03-deepening-print.png";
import offeringBg from "../assets/flashcards/04-offering-print.png";
import guideBg from "../assets/flashcards/05-companion-guide.jpg";

export type Part = {
	id: string;
	roman: string;
	nameEn: string;
	nameZh: string;
	subEn: string;
	subZh: string;
	range: [number, number];
	bgImage: ImageMetadata;
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
		bgImage: foundationsBg,
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
		bgImage: blossomingBg,
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
		bgImage: deepeningBg,
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
		bgImage: offeringBg,
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
	bgImage: guideBg,
	overlay: 60,
} as const;

export type OptimizedBg = { src: string; width: number; height: number };

export const optimizeBg = async (src: ImageMetadata): Promise<OptimizedBg> => {
	const width = 1600;
	const img = await getImage({ src, format: "webp", width });
	const height = Math.round(width * (src.height / src.width));
	return { src: img.src, width, height };
};
