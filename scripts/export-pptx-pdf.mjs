import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = Number(process.env.PORT || 4321);
const BASE = `http://localhost:${PORT}`;
const PATHNAME = process.env.PPTX_PATH || "/flashcards/pptx";
const OUT_PATH = resolve(process.env.PPTX_OUT || "dist/flashcards-pptx.pdf");
const PAGE_RANGES = process.env.PPTX_PAGES || undefined;

async function isServerUp() {
	try {
		const res = await fetch(`${BASE}${PATHNAME}`, { signal: AbortSignal.timeout(1500) });
		return res.ok;
	} catch {
		return false;
	}
}

async function waitForServer({ timeoutMs = 60_000 } = {}) {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (await isServerUp()) return;
		await sleep(500);
	}
	throw new Error(`Dev server did not respond at ${BASE}${PATHNAME} within ${timeoutMs}ms`);
}

async function exportPdf() {
	await mkdir(dirname(OUT_PATH), { recursive: true });
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({ viewport: { width: 1920, height: 1200 } });
		const page = await context.newPage();
		console.log(`Loading ${BASE}${PATHNAME} ...`);
		await page.goto(`${BASE}${PATHNAME}`, { waitUntil: "networkidle", timeout: 120_000 });

		await page.evaluate(async () => {
			if (document.fonts?.ready) await document.fonts.ready;
			const sources = Array.from(document.querySelectorAll(".bg"))
				.map((el) => getComputedStyle(el).backgroundImage.match(/url\(["']?(.+?)["']?\)/)?.[1])
				.filter(Boolean);
			await Promise.all(
				sources.map(
					(src) =>
						new Promise((done) => {
							const img = new Image();
							img.onload = img.onerror = () => done();
							img.src = src;
						}),
				),
			);
		});

		const slideCount = await page.evaluate(() => document.querySelectorAll(".slide").length);
		console.log(`Slides: ${slideCount}`);

		console.log(`Saving PDF to ${OUT_PATH} ...`);
		await page.pdf({
			path: OUT_PATH,
			width: "1920px",
			height: "1200px",
			printBackground: true,
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
			pageRanges: PAGE_RANGES,
		});
	} finally {
		await browser.close();
	}
}

let devServer = null;
try {
	if (await isServerUp()) {
		console.log(`Reusing dev server at ${BASE}`);
	} else {
		console.log(`Starting dev server on port ${PORT} ...`);
		devServer = spawn("npx", ["astro", "dev", "--port", String(PORT)], {
			stdio: ["ignore", "ignore", "inherit"],
			env: process.env,
		});
		await waitForServer();
	}
	await exportPdf();
	console.log("Done.");
} finally {
	if (devServer) {
		devServer.kill("SIGTERM");
		await sleep(200);
	}
}
