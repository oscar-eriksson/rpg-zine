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
	margins: { top: number; right: number; bottom: number; left: number }
) {
	if (pageIndex < 0 || pageIndex >= srcDoc.getPageCount()) return;

	const srcPage = srcDoc.getPage(pageIndex);
	const rotationAngle = srcPage.getRotation().angle;
	
	// Get logical (visual) dimensions
	const { width: vW, height: vH } = srcPage.getSize();
	
	const availWidth = width - (margins.left + margins.right);
	const availHeight = height - (margins.top + margins.bottom);

	if (availWidth <= 0 || availHeight <= 0) return;

	// Optimal scale to fit visual dimensions in available box
	const scale = Math.min(availWidth / vW, availHeight / vH);
	const drawVW = vW * scale;
	const drawVH = vH * scale;

	// Calculate center of the target area
	const centerX = x + margins.left + (availWidth - drawVW) / 2;
	const centerY = y + margins.bottom + (availHeight - drawVH) / 2;

	// We'll embed the page and draw it. To keep it simple and handle all rotations
	// consistently, we'll draw it with the appropriate center-pivot calculation.
	const [embeddedPage] = await sheet.doc.embedPages([srcPage]);
	const pW = embeddedPage.width;
	const pH = embeddedPage.height;

	// pdf-lib's rotate is COUNTER-CLOCKWISE.
	// PDF's /Rotate is CLOCKWISE.
	// page.getRotation().angle in pdf-lib is normalized to CCW.
	
	// The translation (tx, ty) needed to keep the rotated page's 
	// bottom-left corner at (centerX, centerY) in the visual coordinate system.
	// Rotating a (pW*scale, pH*scale) rect by 'rotationAngle' CCW around (0,0):
	// New bounding box:
	//   if 90:  x moves by -pH*scale? no.
	// Let's just use the known offsets for 0, 90, 180, 270.
	let tx = centerX;
	let ty = centerY;

	if (rotationAngle === 90) {
		tx = centerX + drawVW;
	} else if (rotationAngle === 180) {
		tx = centerX + drawVW;
		ty = centerY + drawVH;
	} else if (rotationAngle === 270) {
		ty = centerY + drawVH;
	}

	sheet.drawPage(embeddedPage, {
		x: tx,
		y: ty,
		width: pW * scale,
		height: pH * scale,
		rotate: degrees(rotationAngle),
	});
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
		await drawPageInArea(srcDoc, frontSheet, pLast, 0, 0, 420.94 - gutter / 2, 595.27, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});
		// Right page area: [420.94 + gutter/2 to 841.89]
		await drawPageInArea(srcDoc, frontSheet, pFirst, 420.94 + gutter / 2, 0, 420.94 - gutter / 2, 595.27, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});

		// Back Side
		const backSheet = outDoc.addPage([841.89, 595.27]);
		const pSecond = 2 * i - 1;
		const pPenultimate = pageCount - (2 * i - 1) - 1;

		await drawPageInArea(srcDoc, backSheet, pSecond, 0, 0, 420.94 - gutter / 2, 595.27, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, backSheet, pPenultimate, 420.94 + gutter / 2, 0, 420.94 - gutter / 2, 595.27, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});
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
		await drawPageInArea(srcDoc, frontSheet, front_topRight, halfW + gutter/2, halfH + gutter/2, cellW, cellH, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, frontSheet, front_topLeft,  0,                halfH + gutter/2, cellW, cellH, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, frontSheet, front_botRight, halfW + gutter/2, 0,                cellW, cellH, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, frontSheet, front_botLeft,  0,                0,                cellW, cellH, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});

		// Back side (left/right swap for duplex long-edge flip)
		await drawPageInArea(srcDoc, backSheet, back_topLeft,  0,                halfH + gutter/2, cellW, cellH, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, backSheet, back_topRight, halfW + gutter/2, halfH + gutter/2, cellW, cellH, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, backSheet, back_botLeft,  0,                0,                cellW, cellH, {
			left: margin,
			right: 0,
			top: margin,
			bottom: margin
		});
		await drawPageInArea(srcDoc, backSheet, back_botRight, halfW + gutter/2, 0,                cellW, cellH, {
			left: 0,
			right: margin,
			top: margin,
			bottom: margin
		});
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
		await drawPageInArea(srcDoc, sheet, p1, 0, 0, halfWidth, height, { top: 0, right: 0, bottom: 0, left: 0 });
	}
	
	if (p2 !== null && p2 >= 0 && p2 < srcDoc.getPageCount()) {
		await drawPageInArea(srcDoc, sheet, p2, halfWidth, 0, halfWidth, height, { top: 0, right: 0, bottom: 0, left: 0 });
	}
	
	const bytes = await outDoc.save();
	return URL.createObjectURL(new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }));
}
