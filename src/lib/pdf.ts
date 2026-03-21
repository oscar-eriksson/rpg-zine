import { browser } from '$app/environment';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

/**
 * Centrally manages pdfjs-dist initialization and document loading.
 * This avoids redundant dynamic imports and ensures worker configuration is set correctly.
 */

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

export async function getPdfjs() {
	if (!browser) return null;

	if (!pdfjsPromise) {
		pdfjsPromise = (async () => {
			const pdfjs = await import('pdfjs-dist');
			pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
			return pdfjs;
		})();
	}

	return pdfjsPromise;
}

export async function loadDocument(data: ArrayBuffer | Uint8Array) {
	const pdfjs = await getPdfjs();
	if (!pdfjs) throw new Error('PDF.js is only available in the browser');

	// Create a copy of the sequence to avoid detaching the original buffer
	// if it happens to be an ArrayBuffer and pdf.js decides to transfer it.
	const dataCopy = data instanceof Uint8Array ? data.slice(0) : new Uint8Array(data).slice(0);

	const loadingTask = pdfjs.getDocument({
		data: dataCopy,
		// Explicitly disable buffer transferring if possible (though slice already handles it)
		isEvalSupported: false,
		useWorkerFetch: false
	});

	return loadingTask.promise;
}

// --- Shared document cache ---
// Stores one PDFDocumentProxy keyed by a fingerprint of the buffer.
// All SheetPreview instances for the same imposed PDF share this single document
// (and its single worker) instead of each spawning their own.

type PDFDocumentProxy = Awaited<ReturnType<typeof loadDocument>>;

let cachedDocFingerprint: string | null = null;
let cachedDocPromise: Promise<PDFDocumentProxy> | null = null;

/**
 * Returns a cached PDF document for the given buffer. If the buffer has
 * changed (different fingerprint), the old document is destroyed and a
 * new one is loaded. Safe to call concurrently — all callers awaiting the
 * same buffer get the same promise.
 */
export async function loadDocumentCached(data: Uint8Array): Promise<PDFDocumentProxy> {
	// Build a cheap fingerprint: byteLength + first 64 bytes as a string.
	const head = data.subarray(0, 64);
	const fingerprint = `${data.byteLength}:${Array.from(head).join(',')}`;

	if (fingerprint !== cachedDocFingerprint) {
		// Buffer has changed — destroy the old document if any.
		if (cachedDocPromise) {
			cachedDocPromise
				.then((doc) => doc.destroy())
				.catch(() => {
					/* ignore */
				});
		}
		cachedDocFingerprint = fingerprint;
		cachedDocPromise = loadDocument(data);
	}

	return cachedDocPromise!;
}
