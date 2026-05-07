import { chromium } from "playwright";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";

const PORT = Number(process.env.PORT || 4321);
const BASE = `http://localhost:${PORT}`;
const PATHNAME = process.env.PPTX_PATH || "/flashcards";
const RGB_OUT_PATH = resolve(process.env.PPTX_OUT || "print-output/flashcards-print.pdf");
const CMYK_OUT_PATH = resolve(process.env.PPTX_CMYK_OUT || "print-output/flashcards-print-cmyk.pdf");
const RASTER_DPI = Number(process.env.PPTX_DPI || 200);
const JPEG_QUALITY = Number(process.env.PPTX_JPEG_QUALITY || 92);

const PAGE_W_IN = 8.75;
const PAGE_H_IN = 5.75;
const PAGE_W_PT = PAGE_W_IN * 72;
const PAGE_H_PT = PAGE_H_IN * 72;

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

async function exportPdfs() {
	await mkdir(dirname(RGB_OUT_PATH), { recursive: true });
	await mkdir(dirname(CMYK_OUT_PATH), { recursive: true });

	const deviceScaleFactor = RASTER_DPI / 96;
	const browser = await chromium.launch();
	try {
		const context = await browser.newContext({
			viewport: { width: Math.ceil(PAGE_W_IN * 96), height: Math.ceil(PAGE_H_IN * 96) },
			deviceScaleFactor,
		});
		const page = await context.newPage();
		const url = `${BASE}${PATHNAME}`;
		console.log(`Loading ${url} ...`);
		await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });
		await page.emulateMedia({ media: "print" });

		await page.evaluate(async () => {
			if (document.fonts?.ready) await document.fonts.ready;
			const imgs = Array.from(document.querySelectorAll("img.bg"));
			imgs.forEach((img) => { img.loading = "eager"; });
			await Promise.all(imgs.map((img) => img.complete
				? Promise.resolve()
				: new Promise((done) => { img.onload = img.onerror = () => done(); })));
		});

		console.log(`Saving RGB reference PDF to ${RGB_OUT_PATH} ...`);
		await page.pdf({
			path: RGB_OUT_PATH,
			preferCSSPageSize: true,
			printBackground: true,
			margin: { top: 0, right: 0, bottom: 0, left: 0 },
		});

		const wraps = await page.locator(".card-wrap").all();
		console.log(`Pages: ${wraps.length}, raster DPI: ${RASTER_DPI}, JPEG quality: ${JPEG_QUALITY}`);
		console.log(`Building CMYK PDF (sharp lcms2 → pdf-lib) ...`);

		const pdf = await PDFDocument.create();
		for (let i = 0; i < wraps.length; i++) {
			const png = await wraps[i].screenshot({ type: "png", omitBackground: false });
			const cmykJpeg = await sharp(png)
				.toColorspace("cmyk")
				.jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
				.toBuffer();
			const img = await pdf.embedJpg(cmykJpeg);
			const pdfPage = pdf.addPage([PAGE_W_PT, PAGE_H_PT]);
			pdfPage.drawImage(img, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
			if ((i + 1) % 24 === 0 || i + 1 === wraps.length) {
				console.log(`  ${i + 1}/${wraps.length}`);
			}
		}
		const pdfBytes = await pdf.save();
		await writeFile(CMYK_OUT_PATH, pdfBytes);
		console.log(`Wrote ${CMYK_OUT_PATH}`);
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
	await exportPdfs();
	console.log("Done.");
} finally {
	if (devServer) {
		devServer.kill("SIGTERM");
		await sleep(200);
	}
}
