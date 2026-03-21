<script lang="ts">
	import SheetPreview from '$lib/components/SheetPreview.svelte';

	let {
		page = $bindable<number | null>(null),
		numPages,
		pdfBuffer,
		previewFilter,
		previewAspect
	}: {
		page: number | null;
		numPages: number;
		pdfBuffer: Uint8Array | null;
		previewFilter: string;
		previewAspect: string;
	} = $props();

	let zoom = $state(1);
	let panX = $state(0);
	let panY = $state(0);
	let dragging = $state(false);
	let _dragStartX = 0,
		_dragStartY = 0,
		_panStartX = 0,
		_panStartY = 0;

	// Reset zoom/pan when a new page is opened
	$effect(() => {
		if (page !== null) {
			zoom = 1;
			panX = 0;
			panY = 0;
		}
	});

	$effect(() => {
		if (page === null) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === 'Escape') page = null;
		}
		window.addEventListener('keydown', onKey);
		return () => window.removeEventListener('keydown', onKey);
	});

	function navigateTo(newPage: number) {
		page = newPage;
		zoom = 1;
		panX = 0;
		panY = 0;
	}

	function onWheel(e: WheelEvent) {
		e.preventDefault();
		const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
		const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
		const cx = e.clientX - rect.left - rect.width / 2;
		const cy = e.clientY - rect.top - rect.height / 2;
		const newZoom = Math.max(0.25, Math.min(12, zoom * factor));
		const scale = newZoom / zoom;
		panX = cx + (panX - cx) * scale;
		panY = cy + (panY - cy) * scale;
		zoom = newZoom;
	}

	function onPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		dragging = true;
		_dragStartX = e.clientX;
		_dragStartY = e.clientY;
		_panStartX = panX;
		_panStartY = panY;
	}

	function onPointerMove(e: PointerEvent) {
		if (!dragging) return;
		panX = _panStartX + (e.clientX - _dragStartX);
		panY = _panStartY + (e.clientY - _dragStartY);
	}

	function onPointerUp() {
		dragging = false;
	}
</script>

{#if page !== null}
	{@const sheetNum = Math.ceil(page / 2)}
	{@const isFront = page % 2 === 1}
	<div
		class="fixed inset-0 z-50 flex flex-col bg-black/95 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
	>
		<!-- Top bar -->
		<div class="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
			<span class="font-mono text-xs font-bold text-slate-300">
				Sheet {sheetNum}
				<span class="mx-1 text-purple-400">•</span>
				{isFront ? 'Front' : 'Back'}
			</span>
			<div class="mx-2 h-4 w-px bg-white/10"></div>
			<!-- Zoom controls -->
			<div class="flex items-center gap-1">
				<button
					onclick={() => {
						zoom = Math.max(0.25, zoom / 1.25);
					}}
					class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
					aria-label="Zoom out"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
				</button>
				<span class="min-w-14 text-center font-mono text-[11px] font-bold text-slate-400"
					>{Math.round(zoom * 100)}%</span
				>
				<button
					onclick={() => {
						zoom = Math.min(12, zoom * 1.25);
					}}
					class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-white/20 hover:text-white"
					aria-label="Zoom in"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
				</button>
				<button
					onclick={() => {
						zoom = 1;
						panX = 0;
						panY = 0;
					}}
					class="ml-1 rounded-lg border border-white/10 px-2.5 py-1 text-[10px] font-bold text-slate-500 transition-colors hover:border-white/20 hover:text-slate-300"
				>
					Reset
				</button>
			</div>
			<div class="ml-auto flex items-center gap-2">
				<!-- Prev / Next page -->
				{#if page > 1}
					<button
						onclick={() => navigateTo(page! - 1)}
						class="flex h-7 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[10px] font-bold text-slate-400 transition-colors hover:border-white/20 hover:text-white"
					>
						<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
						Prev
					</button>
				{/if}
				{#if page < numPages}
					<button
						onclick={() => navigateTo(page! + 1)}
						class="flex h-7 items-center gap-1 rounded-lg border border-white/10 px-2.5 text-[10px] font-bold text-slate-400 transition-colors hover:border-white/20 hover:text-white"
					>
						Next
						<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
					</button>
				{/if}
				<button
					onclick={() => (page = null)}
					class="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition-colors hover:border-red-500/50 hover:text-red-400"
					aria-label="Close"
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
				</button>
			</div>
		</div>

		<!-- Pannable / zoomable viewport -->
		<div
			class="relative flex-1 overflow-hidden {dragging ? 'cursor-grabbing' : 'cursor-grab'}"
			role="img"
			aria-label="Sheet preview — scroll to zoom, drag to pan"
			onwheel={onWheel}
			onpointerdown={onPointerDown}
			onpointermove={onPointerMove}
			onpointerup={onPointerUp}
			onpointercancel={onPointerUp}
		>
			<div
				class="flex h-full w-full items-center justify-center"
				style="transform: translate({panX}px, {panY}px) scale({zoom}); transform-origin: center center; will-change: transform;"
			>
				<div
					class="{previewAspect} h-[80vh] max-w-[90vw] overflow-hidden rounded bg-white shadow-2xl"
					style={previewFilter ? `filter: ${previewFilter}` : undefined}
				>
					<SheetPreview {pdfBuffer} pageNumber={page} scale={4} />
				</div>
			</div>
			<p class="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 font-mono text-[10px] tracking-widest text-white/20 uppercase select-none">
				Scroll to zoom · Drag to pan · Esc to close
			</p>
		</div>
	</div>
{/if}
