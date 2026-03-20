<script lang="ts">
	import { getPageCount } from '$lib/imposition';
	import { loadDocumentCached } from '$lib/pdf';
	import { onDestroy, untrack } from 'svelte';
	import { browser } from '$app/environment';
	import type { RenderTask } from 'pdfjs-dist';
	import type { ImpositionOptions } from '$lib/imposition';

	let { pdfData, options } = $props<{ pdfData: ArrayBuffer | null; options: ImpositionOptions }>();

	let pageCount = $state(0);
	let currentSpread = $state(0);

	$effect(() => {
		if (pdfData) {
			getPageCount(pdfData).then((count) => {
				pageCount = Math.ceil(count / 4) * 4;
				currentSpread = 0;
			});
		}
	});

	let totalSpreads = $derived(Math.ceil((pageCount + 1) / 2));

	function getSpreadPages(spread: number): [number | null, number | null] {
		if (!pageCount) return [null, null];
		if (spread === 0) return [null, 1];
		if (spread === totalSpreads - 1) return [pageCount, null];
		return [spread * 2, spread * 2 + 1];
	}

	let leftPage = $state<number | null>(null);
	let rightPage = $state<number | null>(null);

	$effect(() => {
		[leftPage, rightPage] = getSpreadPages(currentSpread);
	});

	// Animation state
	let isFlipping = $state(false);
	let flipDir = $state<'fwd' | 'bwd'>('fwd');
	let flipActiveSrc = $state('');
	let flipMirror = $state(false);

	// Canvas refs
	let leftCanvas = $state<HTMLCanvasElement | null>(null);
	let rightCanvas = $state<HTMLCanvasElement | null>(null);
	let stagingA = $state<HTMLCanvasElement | null>(null);
	let stagingB = $state<HTMLCanvasElement | null>(null);

	// Per-canvas render tracking using WeakMaps
	const tasks = new WeakMap<HTMLCanvasElement, RenderTask>();
	const gens = new WeakMap<HTMLCanvasElement, number>();

	// Mirror the imposition geometry so the preview matches the print output exactly.
	// Matches the cell sizing in imposeA5 / imposeA6 in imposition.ts.
	const MM_TO_PT = 72 / 25.4;
	const DISPLAY_SCALE = 1.8; // canvas pixels per PDF point

	function getCellDimensions() {
		const gutter = options.middleMargin * MM_TO_PT;
		if (options.size === 'A5') {
			return { cellW: 420.94 - gutter / 2, cellH: 595.27 };
		} else {
			return { cellW: 297.64 - gutter / 2, cellH: 420.94 };
		}
	}

	function drawMarginGuides(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, marginPx: number) {
		// Shade the margin zone
		ctx.fillStyle = 'rgba(150, 80, 210, 0.07)';
		ctx.fillRect(0, 0, canvasW, marginPx); // top
		ctx.fillRect(0, canvasH - marginPx, canvasW, marginPx); // bottom
		ctx.fillRect(0, marginPx, marginPx, canvasH - 2 * marginPx); // left
		ctx.fillRect(canvasW - marginPx, marginPx, marginPx, canvasH - 2 * marginPx); // right

		// Dashed safe-area border
		ctx.save();
		ctx.strokeStyle = 'rgba(150, 80, 210, 0.45)';
		ctx.lineWidth = 1;
		ctx.setLineDash([5, 4]);
		ctx.strokeRect(marginPx + 0.5, marginPx + 0.5, canvasW - 2 * marginPx - 1, canvasH - 2 * marginPx - 1);
		ctx.restore();
	}

	async function renderPage(canvas: HTMLCanvasElement, pageNum: number | null) {
		if (!browser) return;
		tasks.get(canvas)?.cancel();
		const gen = (gens.get(canvas) ?? 0) + 1;
		gens.set(canvas, gen);
		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Cell and margin sizes — mirror the imposition math exactly
		const { cellW, cellH } = getCellDimensions();
		const marginPx = options.printerMargin * MM_TO_PT * DISPLAY_SCALE;
		const canvasW = Math.round(cellW * DISPLAY_SCALE);
		const canvasH = Math.round(cellH * DISPLAY_SCALE);

		canvas.width = canvasW;
		canvas.height = canvasH;

		// Page background
		ctx.fillStyle = '#f8f4ee';
		ctx.fillRect(0, 0, canvasW, canvasH);

		drawMarginGuides(ctx, canvasW, canvasH, marginPx);

		if (!pageNum || !pdfData) return;
		if (gens.get(canvas) !== gen) return;

		try {
			// loadDocumentCached expects Uint8Array; pdfData is an ArrayBuffer
		const doc = await loadDocumentCached(new Uint8Array(pdfData));
			if (gens.get(canvas) !== gen) return;
			const page = await doc.getPage(pageNum);
			if (gens.get(canvas) !== gen) return;

			// Available content area — same calc as drawPageInArea in imposition.ts
			const availW = canvasW - 2 * marginPx;
			const availH = canvasH - 2 * marginPx;

			const naturalVp = page.getViewport({ scale: 1 });
			const pageScale = Math.min(availW / naturalVp.width, availH / naturalVp.height);
			const scaledVp = page.getViewport({ scale: pageScale });

			// Render to offscreen canvas, then composite — pdfjs needs its own canvas
			const off = document.createElement('canvas');
			off.width = Math.round(scaledVp.width);
			off.height = Math.round(scaledVp.height);
			const offCtx = off.getContext('2d')!;

			const task = page.render({ canvasContext: offCtx, viewport: scaledVp, canvas: off });
			tasks.set(canvas, task);
			await task.promise;
			tasks.delete(canvas);

			if (gens.get(canvas) !== gen) return;

			// Center within safe area, matching the centering in drawPageInArea
			const drawX = marginPx + (availW - off.width) / 2;
			const drawY = marginPx + (availH - off.height) / 2;
			ctx.drawImage(off, drawX, drawY);

			// Re-draw guides on top of page content so they stay visible
			drawMarginGuides(ctx, canvasW, canvasH, marginPx);
		} catch (e: unknown) {
			if ((e as Error)?.constructor?.name === 'RenderingCancelledException') return;
		}
	}

	// Effects: re-render when page number OR margin options change
	$effect(() => {
		const p = leftPage;
		// Access margin options so sliders trigger a re-render
		void options.printerMargin; void options.middleMargin; void options.size;
		const c = untrack(() => leftCanvas);
		if (c) renderPage(c, p);
	});
	$effect(() => {
		const c = leftCanvas;
		if (c) renderPage(c, untrack(() => leftPage));
	});
	$effect(() => {
		const p = rightPage;
		void options.printerMargin; void options.middleMargin; void options.size;
		const c = untrack(() => rightCanvas);
		if (c) renderPage(c, p);
	});
	$effect(() => {
		const c = rightCanvas;
		if (c) renderPage(c, untrack(() => rightPage));
	});

	async function goNext() {
		if (isFlipping || currentSpread >= totalSpreads - 1) return;
		const nextSpread = currentSpread + 1;
		const [nextLeft] = getSpreadPages(nextSpread);

		// Skip flip animation for edge spreads where one side is hidden
		if (leftPage === null || rightPage === null) {
			currentSpread = nextSpread;
			return;
		}

		const sa = untrack(() => stagingA);
		const sb = untrack(() => stagingB);
		if (!sa || !sb) return;
		const frontPageNum = untrack(() => rightPage);
		await Promise.all([renderPage(sa, frontPageNum), renderPage(sb, nextLeft)]);
		const frontSrc = sa.toDataURL();
		const backSrc = sb.toDataURL();
		flipActiveSrc = frontSrc;
		flipMirror = false;
		flipDir = 'fwd';
		isFlipping = true;
		currentSpread = nextSpread;
		setTimeout(() => { flipActiveSrc = backSrc; flipMirror = true; }, 350);
		setTimeout(() => { isFlipping = false; flipMirror = false; }, 750);
	}

	async function goPrev() {
		if (isFlipping || currentSpread <= 0) return;
		const prevSpread = currentSpread - 1;
		const [, prevRight] = getSpreadPages(prevSpread);

		// Skip flip animation for edge spreads where one side is hidden
		if (leftPage === null || rightPage === null) {
			currentSpread = prevSpread;
			return;
		}

		const sa = untrack(() => stagingA);
		const sb = untrack(() => stagingB);
		if (!sa || !sb) return;
		const frontPageNum = untrack(() => leftPage);
		await Promise.all([renderPage(sa, frontPageNum), renderPage(sb, prevRight)]);
		const frontSrc = sa.toDataURL();
		const backSrc = sb.toDataURL();
		flipActiveSrc = frontSrc;
		flipMirror = false;
		flipDir = 'bwd';
		isFlipping = true;
		currentSpread = prevSpread;
		setTimeout(() => { flipActiveSrc = backSrc; flipMirror = true; }, 350);
		setTimeout(() => { isFlipping = false; flipMirror = false; }, 750);
	}

	function handleKey(e: KeyboardEvent) {
		if (e.key === 'ArrowRight') goNext();
		if (e.key === 'ArrowLeft') goPrev();
	}

	onDestroy(() => {
		// WeakMap entries are GC'd with their canvas elements
	});

	function getMapping(pageNum: number): string {
		if (pageNum < 1 || pageNum > pageCount) return 'Blank';
		const n = pageCount;
		if (options.size === 'A5') {
			for (let i = 1; i <= n / 4; i++) {
				if (pageNum === n - (2 * i - 2)) return `Sheet ${i} Front, Left`;
				if (pageNum === 2 * i - 1) return `Sheet ${i} Front, Right`;
				if (pageNum === 2 * i) return `Sheet ${i} Back, Left`;
				if (pageNum === n - (2 * i - 1)) return `Sheet ${i} Back, Right`;
			}
		} else {
			const sig = Math.ceil(pageNum / 4);
			const sheet = Math.ceil(sig / 2);
			const isTop = sig % 2 !== 0;
			const pA = 2 * sig - 2,
				pB = 2 * sig - 1;
			const pC = n - pB - 1,
				pD = n - pA - 1;
			const pos = isTop ? 'Top' : 'Bottom';
			if (pageNum - 1 === pA) return `Sheet ${sheet} Front, ${pos} Right`;
			if (pageNum - 1 === pD) return `Sheet ${sheet} Front, ${pos} Left`;
			if (pageNum - 1 === pB) return `Sheet ${sheet} Back, ${pos} Left`;
			if (pageNum - 1 === pC) return `Sheet ${sheet} Back, ${pos} Right`;
		}
		return '...';
	}
</script>

<svelte:window onkeydown={handleKey} />

<!-- Hidden staging canvases for pre-rendering flip content -->
<canvas bind:this={stagingA} style="display:none" aria-hidden="true"></canvas>
<canvas bind:this={stagingB} style="display:none" aria-hidden="true"></canvas>

<div class="flex h-full w-full select-none flex-col items-center gap-4">
	<!-- Navigation -->
	<div class="flex shrink-0 items-center gap-6">
		<button
			onclick={goPrev}
			disabled={currentSpread === 0 || isFlipping}
			aria-label="Previous spread"
			class="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 disabled:opacity-20"
		>
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="transition-transform group-hover:-translate-x-0.5"
			>
				<path d="m15 18-6-6 6-6" />
			</svg>
			Prev
		</button>

		<div class="text-center">
			<div class="text-[10px] uppercase tracking-widest text-slate-500">Spread</div>
			<div class="flex items-baseline gap-1 text-base font-bold text-white tabular-nums">
				<input
					type="number"
					min="1"
					max={totalSpreads}
					value={currentSpread + 1}
					onchange={(e) => {
						const v = Math.max(1, Math.min(totalSpreads, parseInt((e.target as HTMLInputElement).value) || 1));
						(e.target as HTMLInputElement).value = String(v);
						currentSpread = v - 1;
					}}
					onkeydown={(e) => e.stopPropagation()}
					class="w-10 bg-transparent text-center text-base font-bold text-white outline-none [appearance:textfield] hover:text-purple-300 focus:text-purple-300 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
				<span class="text-sm font-normal text-slate-500">/ {totalSpreads}</span>
			</div>
		</div>

		<button
			onclick={goNext}
			disabled={currentSpread >= totalSpreads - 1 || isFlipping}
			aria-label="Next spread"
			class="group flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm font-medium text-slate-300 transition-all hover:bg-white/10 disabled:opacity-20"
		>
			Next
			<svg
				xmlns="http://www.w3.org/2000/svg"
				width="14"
				height="14"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				class="transition-transform group-hover:translate-x-0.5"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
		</button>
	</div>

	<!-- Book scene -->
	<div class="book-scene flex flex-1 w-full items-center justify-center pb-10">
		<div class="book-tilt">
			<!-- Open book -->
			<div class="book-open">
				<!-- Left page (hidden on first spread) -->
				{#if leftPage !== null}
					<div class="page-panel page-left">
						<canvas bind:this={leftCanvas} class="page-canvas"></canvas>
						<div class="spine-shadow spine-shadow-l"></div>
					</div>
				{/if}

				<!-- Spine -->
				<div class="book-spine"></div>

				<!-- Right page (hidden on last spread) -->
				{#if rightPage !== null}
					<div class="page-panel page-right" class:rounded-l={leftPage === null}>
						<canvas bind:this={rightCanvas} class="page-canvas"></canvas>
						<div class="spine-shadow spine-shadow-r"></div>
						<div class="page-curl"></div>
					</div>
				{/if}

				<!-- Flip animation overlay — single face with midpoint src swap to avoid mirror artifact -->
				{#if isFlipping}
					<div class={flipDir === 'fwd' ? 'flip-container flip-fwd' : 'flip-container flip-bwd'}>
						<div class="flip-face" style={flipMirror ? 'transform: scaleX(-1)' : ''}>
							<img src={flipActiveSrc} class="page-img" alt="" />
							<div class="spine-shadow {flipDir === 'fwd' ? 'spine-shadow-r' : 'spine-shadow-l'}"></div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Floor shadow -->
			<div class="book-shadow"></div>
		</div>
	</div>

	<!-- Page mapping labels -->
	<div class="flex shrink-0 gap-10 font-mono text-[10px] text-slate-500">
		{#if currentSpread === 0}
			<span></span>
			<span class="rounded border border-slate-700/50 bg-slate-900/90 px-3 py-1">
				{getMapping(1)}
			</span>
		{:else if currentSpread === totalSpreads - 1}
			<span class="rounded border border-slate-700/50 bg-slate-900/90 px-3 py-1">
				{getMapping(pageCount)}
			</span>
			<span></span>
		{:else}
			<span class="rounded border border-slate-700/50 bg-slate-900/90 px-3 py-1">
				{getMapping(currentSpread * 2)}
			</span>
			<span class="rounded border border-slate-700/50 bg-slate-900/90 px-3 py-1">
				{getMapping(currentSpread * 2 + 1)}
			</span>
		{/if}
	</div>

	<p class="shrink-0 text-center text-[10px] italic text-slate-500">
		Use ← → arrow keys to navigate. Labels show which physical sheet each page prints on.
	</p>
</div>

<style>
	.book-scene {
		perspective: 2800px;
		perspective-origin: 50% 35%;
	}

	.book-tilt {
		transform: rotateX(7deg);
		transform-style: preserve-3d;
		position: relative;
	}

	.book-open {
		display: flex;
		position: relative;
		max-height: 62vh;
		border-radius: 3px;
		box-shadow:
			0 70px 140px -30px rgba(0, 0, 0, 0.95),
			0 30px 60px -10px rgba(0, 0, 0, 0.7),
			0 0 0 1px rgba(0, 0, 0, 0.6);
	}

	.page-panel {
		flex: 1;
		background: #f8f4ee;
		overflow: hidden;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 160px;
	}

	.page-left {
		border-radius: 3px 0 0 3px;
	}

	.page-right {
		border-radius: 0 3px 3px 0;
	}

	.page-right.rounded-l {
		border-radius: 3px;
	}

	.page-canvas {
		display: block;
		max-width: 100%;
		max-height: 62vh;
		object-fit: contain;
	}

	.book-spine {
		width: 22px;
		flex-shrink: 0;
		position: relative;
		z-index: 5;
		background: linear-gradient(
			90deg,
			#0c0c1a 0%,
			#1a0f30 25%,
			#2a1d4e 50%,
			#1a0f30 75%,
			#0c0c1a 100%
		);
		box-shadow:
			0 0 25px rgba(0, 0, 0, 0.8),
			inset 0 0 8px rgba(0, 0, 0, 0.5);
	}

	.book-spine::before {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			transparent 0%,
			rgba(255, 255, 255, 0.06) 35%,
			rgba(255, 255, 255, 0.14) 50%,
			rgba(255, 255, 255, 0.06) 65%,
			transparent 100%
		);
	}

	.spine-shadow {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 55px;
		pointer-events: none;
	}

	.spine-shadow-l {
		right: 0;
		background: linear-gradient(to left, rgba(0, 0, 0, 0.18), transparent);
	}

	.spine-shadow-r {
		left: 0;
		background: linear-gradient(to right, rgba(0, 0, 0, 0.18), transparent);
	}

	/* Subtle page curl hint bottom-right corner of right page */
	.page-curl {
		position: absolute;
		bottom: 0;
		right: 0;
		width: 0;
		height: 0;
		border-style: solid;
		border-width: 0 0 28px 28px;
		border-color: transparent transparent #e0dbd0 transparent;
		opacity: 0;
		transition: opacity 0.25s;
		pointer-events: none;
		filter: drop-shadow(-2px -2px 3px rgba(0, 0, 0, 0.2));
	}

	.page-right:hover .page-curl {
		opacity: 1;
	}

	/* Floor shadow beneath book */
	.book-shadow {
		position: absolute;
		bottom: -45px;
		left: 8%;
		right: 8%;
		height: 45px;
		background: radial-gradient(ellipse at center top, rgba(0, 0, 0, 0.55) 0%, transparent 70%);
		filter: blur(18px);
		pointer-events: none;
	}

	/* ── Flip animation containers ── */
	.flip-container {
		position: absolute;
		top: 0;
		bottom: 0;
		width: calc((100% - 22px) / 2);
		z-index: 20;
	}

	.flip-fwd {
		right: 0;
		transform-origin: left center;
		animation: flipFwd 0.75s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
		border-radius: 0 3px 3px 0;
	}

	.flip-bwd {
		left: 0;
		transform-origin: right center;
		animation: flipBwd 0.75s cubic-bezier(0.645, 0.045, 0.355, 1) forwards;
		border-radius: 3px 0 0 3px;
	}

	@keyframes flipFwd {
		0% {
			transform: rotateY(0deg);
			filter: drop-shadow(0px 0px 0px rgba(0, 0, 0, 0));
		}
		40% {
			filter: drop-shadow(-18px 0px 28px rgba(0, 0, 0, 0.45));
		}
		100% {
			transform: rotateY(-180deg);
			filter: drop-shadow(0px 0px 0px rgba(0, 0, 0, 0));
		}
	}

	@keyframes flipBwd {
		0% {
			transform: rotateY(0deg);
			filter: drop-shadow(0px 0px 0px rgba(0, 0, 0, 0));
		}
		40% {
			filter: drop-shadow(18px 0px 28px rgba(0, 0, 0, 0.45));
		}
		100% {
			transform: rotateY(180deg);
			filter: drop-shadow(0px 0px 0px rgba(0, 0, 0, 0));
		}
	}

	.flip-face {
		position: absolute;
		inset: 0;
		background: #f8f4ee;
		overflow: hidden;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.page-img {
		display: block;
		max-width: 100%;
		max-height: 62vh;
		object-fit: contain;
	}
</style>
