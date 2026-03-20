import { PDFDocument, PDFPage, degrees } from 'pdf-lib';

export interface ImpositionOptions {
	size: 'A5' | 'A6';
	printerMargin: number; // in mm
	middleMargin: number; // in mm
	duplex: boolean;
	backToBack: boolean; // glue back to back
}

const MM_TO_POINTS = 72 / 25.4;


export async function getPageCount(pdfData: ArrayBuffer): Promise<number> {
	const srcDoc = await PDFDocument.load(pdfData);
	return srcDoc.getPageCount();
}

export async function impose(pdfData: ArrayBuffer, options: ImpositionOptions): Promise<Uint8Array> {
	const srcDoc = await PDFDocument.load(pdfData);
	const srcPages = srcDoc.getPages();
	let pageCount = srcPages.length;

	// We'll calculate the virtual page count for imposition
	pageCount = Math.ceil(pageCount / (options.size === 'A5' ? 4 : 8)) * (options.size === 'A5' ? 4 : 8);

	const outDoc = await PDFDocument.create();

	if (options.size === 'A5') {
		await imposeA5(srcDoc, outDoc, options, pageCount);
	} else {
		await imposeA6(srcDoc, outDoc, options, pageCount);
	}

	// Handle non-duplex: if duplex is false, we already have front/back pairs in sequence.
	// Actually, the current logic adds front sheet, then back sheet.
	// If duplex is true, they are meant to be printed on two sides of one paper.
	// If duplex is false, they are just two pages in the PDF. This is already handled.
	// However, if the user wants "Glue back-to-back", they might want something else.
	// But usually they just print single sided and glue.

	return await outDoc.save();
}

async function drawPageInArea(
	srcDoc: PDFDocument,
	sheet: PDFPage,
	pageIndex: number,
	x: number,
	y: number,
	width: number,
	height: number,
	margin: number
) {
	if (pageIndex < 0 || pageIndex >= srcDoc.getPageCount()) return;

	const srcPage = srcDoc.getPage(pageIndex);
	
	// Normalize rotation: Some PDF generators (especially on Windows) use the /Rotate flag
	// instead of swapping width/height. We want the "native" visual orientation.
	// By setting rotation to 0 before embedding, we ensure we handle the page as it appears.
	const originalRotation = srcPage.getRotation().angle;
	srcPage.setRotation(degrees(0));

	const [embeddedPage] = await sheet.doc.embedPages([srcPage]);
	
	// If we normalized from 90/270, the native dimensions are likely swapped from 
	// what we want to display. But actually, getSize() returns the logical size 
	// AFTER rotation. So if we set rotation to 0, getSize() gives us the physical size.
	const { width: pW, height: pH } = srcPage.getSize();
	
	const availWidth = width - 2 * margin;
	const availHeight = height - 2 * margin;

	if (availWidth <= 0 || availHeight <= 0) return;

	const scale = Math.min(availWidth / pW, availHeight / pH);
	const drawWidth = pW * scale;
	const drawHeight = pH * scale;

	const posX = x + margin + (availWidth - drawWidth) / 2;
	const posY = y + margin + (availHeight - drawHeight) / 2;

	sheet.drawPage(embeddedPage, {
		x: posX,
		y: posY,
		width: drawWidth,
		height: drawHeight,
	});

	// Restore rotation if we might reuse the srcDoc (though here we don't really need to)
	srcPage.setRotation(degrees(originalRotation));
}

async function imposeA5(srcDoc: PDFDocument, outDoc: PDFDocument, options: ImpositionOptions, pageCount: number) {
	const numSheets = Math.ceil(pageCount / 4);

	const margin = options.printerMargin * MM_TO_POINTS;
	const gutter = options.middleMargin * MM_TO_POINTS;

	for (let i = 1; i <= numSheets; i++) {
		// Front Side (A4 Landscape)
		const frontSheet = outDoc.addPage([841.89, 595.27]);
		const pLast = pageCount - (2 * i - 2) - 1;
		const pFirst = 2 * i - 2;

		// Left page area: [0 to 420.94 - gutter/2]
		await drawPageInArea(srcDoc, frontSheet, pLast, 0, 0, 420.94 - gutter / 2, 595.27, margin);
		// Right page area: [420.94 + gutter/2 to 841.89]
		await drawPageInArea(srcDoc, frontSheet, pFirst, 420.94 + gutter / 2, 0, 420.94 - gutter / 2, 595.27, margin);

		// Back Side
		const backSheet = outDoc.addPage([841.89, 595.27]);
		const pSecond = 2 * i - 1;
		const pPenultimate = pageCount - (2 * i - 1) - 1;

		await drawPageInArea(srcDoc, backSheet, pSecond, 0, 0, 420.94 - gutter / 2, 595.27, margin);
		await drawPageInArea(srcDoc, backSheet, pPenultimate, 420.94 + gutter / 2, 0, 420.94 - gutter / 2, 595.27, margin);
	}
}

async function imposeA6(srcDoc: PDFDocument, outDoc: PDFDocument, options: ImpositionOptions, pageCount: number) {
	// A6 booklet: 4 pages per A4 side (2×2 grid), 8 pages per physical A4 sheet.
	// Each A4 portrait sheet holds 4 A6 pages arranged as:
	//   [Top-Left]  [Top-Right]
	//   [Bot-Left]  [Bot-Right]
	//
	// For a standard saddle-stitched booklet with N pages (multiple of 8):
	// Physical sheet k (1-indexed) contains (pages 1-indexed):
	//   Front Top:    Right=p(4k-3), Left=p(N-4k+4)  => sheet 1: R=1  L=N
	//   Front Bottom: Right=p(4k-1), Left=p(N-4k+2)  => sheet 1: R=3  L=N-2
	//   Back Top:     Left=p(4k-2),  Right=p(N-4k+3) => sheet 1: L=2  R=N-1
	//   Back Bottom:  Left=p(4k),    Right=p(N-4k+1) => sheet 1: L=4  R=N-3

	const realPageCount = srcDoc.getPageCount();
	const numPhysicalSheets = pageCount / 8;
	const margin = options.printerMargin * MM_TO_POINTS;
	const gutter = options.middleMargin * MM_TO_POINTS;

	// A4 portrait dimensions in points: 595.28 × 841.89
	const pageW = 595.27;
	const pageH = 841.89;

	// Each quadrant: half width, half height
	const halfW = pageW / 2;
	const halfH = pageH / 2;

	// With gutter: left col [0, halfW - gutter/2], right col [halfW + gutter/2, pageW]
	// Each cell width = halfW - gutter/2, starting at x=0 or x=halfW+gutter/2
	const cellW = halfW - gutter / 2;
	const cellH = halfH - gutter / 2;

	// Blank pages are inserted in the center of the booklet so that the first and
	// last real pages remain at the cover positions. Maps a virtual 0-based index
	// to a real 0-based page index, returning -1 for blank slots.
	const blanks = pageCount - realPageCount;
	const firstHalf = Math.ceil(realPageCount / 2);
	const remap = (vi: number): number => {
		if (vi < firstHalf) return vi;
		if (vi < firstHalf + blanks) return -1;
		return vi - blanks;
	};

	for (let k = 1; k <= numPhysicalSheets; k++) {
		const frontSheet = outDoc.addPage([pageW, pageH]);
		const backSheet = outDoc.addPage([pageW, pageH]);

		const N = pageCount;

		// Virtual page indices (0-based), formula derived from saddle-stitch ordering
		const front_topRight = remap(4 * k - 4);        // p(4k-3)
		const front_topLeft  = remap(N - 4 * k + 3);    // p(N-4k+4)
		const front_botRight = remap(4 * k - 2);         // p(4k-1)
		const front_botLeft  = remap(N - 4 * k + 1);    // p(N-4k+2)

		const back_topLeft   = remap(4 * k - 3);         // p(4k-2)
		const back_topRight  = remap(N - 4 * k + 2);    // p(N-4k+3)
		const back_botLeft   = remap(4 * k - 1);         // p(4k)
		const back_botRight  = remap(N - 4 * k);         // p(N-4k+1)

		// Front side
		await drawPageInArea(srcDoc, frontSheet, front_topRight, halfW + gutter/2, halfH + gutter/2, cellW, cellH, margin);
		await drawPageInArea(srcDoc, frontSheet, front_topLeft,  0,                halfH + gutter/2, cellW, cellH, margin);
		await drawPageInArea(srcDoc, frontSheet, front_botRight, halfW + gutter/2, 0,                cellW, cellH, margin);
		await drawPageInArea(srcDoc, frontSheet, front_botLeft,  0,                0,                cellW, cellH, margin);

		// Back side (left/right swap for duplex long-edge flip)
		await drawPageInArea(srcDoc, backSheet, back_topLeft,  0,                halfH + gutter/2, cellW, cellH, margin);
		await drawPageInArea(srcDoc, backSheet, back_topRight, halfW + gutter/2, halfH + gutter/2, cellW, cellH, margin);
		await drawPageInArea(srcDoc, backSheet, back_botLeft,  0,                0,                cellW, cellH, margin);
		await drawPageInArea(srcDoc, backSheet, back_botRight, halfW + gutter/2, 0,                cellW, cellH, margin);
	}
}

export async function createSpreadPdf(pdfData: ArrayBuffer, p1: number, p2: number | null, size: 'A5' | 'A6' = 'A5'): Promise<string> {
	const srcDoc = await PDFDocument.load(pdfData);
	const outDoc = await PDFDocument.create();
	
	// A5 spread (2 A5 portrait) is A4 Landscape: 841.89 x 595.27
	// A6 spread (2 A6 portrait) is A5 Landscape: 595.27 x 420.94
	const width = size === 'A5' ? 841.89 : 595.27;
	const height = size === 'A5' ? 595.27 : 420.94;
	
	const sheet = outDoc.addPage([width, height]);
	const halfWidth = width / 2;
	
	if (p1 >= 0 && p1 < srcDoc.getPageCount()) {
		await drawPageInArea(srcDoc, sheet, p1, 0, 0, halfWidth, height, 0);
	}
	
	if (p2 !== null && p2 >= 0 && p2 < srcDoc.getPageCount()) {
		await drawPageInArea(srcDoc, sheet, p2, halfWidth, 0, halfWidth, height, 0);
	}
	
	const bytes = await outDoc.save();
	return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
}
