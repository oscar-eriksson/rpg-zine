<script lang="ts">
	import { loadDocumentCached } from '$lib/pdf';
	import { onDestroy, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import type { RenderTask } from 'pdfjs-dist';

	let {
		pdfBuffer,
		pageNumber,
		scale = 2
	} = $props<{
		pdfBuffer: ArrayBuffer | Uint8Array | null;
		pageNumber: number;
		scale?: number;
	}>();

	let canvas: HTMLCanvasElement | null = $state(null);
	let isLoading = $state(true);
	let error = $state<string | null>(null);
	let pdfDoc: Awaited<ReturnType<typeof loadDocumentCached>> | null = null;

	// Tracks the currently in-flight pdf.js render task so we can cancel it
	// before starting a new one (prevents "same canvas" errors).
	let currentRenderTask: RenderTask | null = null;
	// Incremented each time we want to start a fresh render; lets async work
	// detect that it has been superseded and bail out cleanly.
	let renderGeneration = 0;

	async function renderPage(canvasEl: HTMLCanvasElement) {
		if (!browser || !pdfBuffer) return;

		// Cancel any in-flight render immediately before touching the canvas.
		if (currentRenderTask) {
			currentRenderTask.cancel();
			currentRenderTask = null;
		}

		const myGeneration = ++renderGeneration;
		isLoading = true;
		error = null;

		try {
			pdfDoc = await loadDocumentCached(pdfBuffer);
			if (myGeneration !== renderGeneration) return; // superseded

			const page = await pdfDoc.getPage(pageNumber);
			if (myGeneration !== renderGeneration) return; // superseded

			const viewport = page.getViewport({ scale });
			const context = canvasEl.getContext('2d');

			if (context) {
				canvasEl.height = viewport.height;
				canvasEl.width = viewport.width;

				const renderContext = {
					canvasContext: context,
					viewport: viewport,
					canvas: canvasEl // Required in pdfjs-dist 5.x
				};

				const task = page.render(renderContext);
				currentRenderTask = task;
				await task.promise;
				currentRenderTask = null;
			}
		} catch (e: unknown) {
			// Ignore cancellation errors — they're intentional.
			if (e?.constructor?.name === 'RenderingCancelledException') return;
			const errorMessage = e instanceof Error ? e.message : String(e);
			console.error('Error rendering PDF page:', e);
			if (myGeneration === renderGeneration) {
				error = errorMessage;
			}
		} finally {
			if (myGeneration === renderGeneration) {
				isLoading = false;
			}
		}
	}

	// Single effect: re-fires when pdfBuffer or pageNumber change.
	// Canvas is read via untrack() so writing to canvas properties
	// never causes this effect to re-fire (that was the original loop bug).
	$effect(() => {
		// Access reactive deps explicitly so Svelte tracks them.
		const buf = pdfBuffer;
		const pg = pageNumber;

		const canvasEl = untrack(() => canvas);
		if (buf && pg && canvasEl) {
			renderPage(canvasEl);
		}
	});

	// Separate effect for canvas mount: fires once when the canvas element
	// is bound for the first time. Reads everything else untracked.
	$effect(() => {
		const canvasEl = canvas; // track canvas binding
		if (canvasEl) {
			const buf = untrack(() => pdfBuffer);
			const pg = untrack(() => pageNumber);
			if (buf && pg) {
				renderPage(canvasEl);
			}
		}
	});

	onDestroy(() => {
		if (currentRenderTask) {
			currentRenderTask.cancel();
		}
		// NOTE: do NOT destroy pdfDoc here — it is a shared cached document
		// used by all SheetPreview instances. It manages its own lifecycle.
	});
</script>

<div
	class="relative flex h-full w-full items-center justify-center overflow-hidden rounded bg-white shadow-sm"
>
	{#if isLoading}
		<div
			class="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-sm"
		>
			<div
				class="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-purple-500/20 border-t-purple-500"
			></div>
			<p class="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Rendering...</p>
		</div>
	{/if}

	{#if error}
		<div
			class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-red-50 p-4 text-center"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="mb-2 text-red-400"
				><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line
					x1="12"
					y1="16"
					x2="12.01"
					y2="16"
				/></svg
			>
			<p class="mb-1 text-xs font-bold tracking-widest text-red-500 uppercase">Render Error</p>
			<p class="line-clamp-2 font-mono text-[10px] text-red-400">{error}</p>
		</div>
	{/if}

	<canvas bind:this={canvas} class="max-h-full max-w-full object-contain"></canvas>
</div>
