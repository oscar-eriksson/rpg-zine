<script lang="ts">
	import { getPageCount, createSpreadPdf, type ImpositionOptions } from '$lib/imposition';

	let { pdfData, options } = $props<{ pdfData: ArrayBuffer | null, options: ImpositionOptions }>();

	let pageCount = $state(0);
	let currentSpread = $state(0);
	let spreadUrl = $state<string | null>(null);

	$effect(() => {
		if (pdfData) {
			getPageCount(pdfData).then(count => {
				pageCount = Math.ceil(count / 4) * 4;
			});
		}
	});

	let totalSpreads = $derived(Math.ceil((pageCount + 1) / 2));

	$effect(() => {
		if (pdfData && pageCount > 0) {
			let p1: number = -1;
			let p2: number | null = null;

			if (currentSpread === 0) {
				p1 = 0; // Cover
				p2 = null;
			} else if (currentSpread === totalSpreads - 1) {
				p1 = pageCount - 1; // Back Cover
				p2 = null;
			} else {
				p1 = (currentSpread * 2) - 1;
				p2 = (currentSpread * 2);
			}

			createSpreadPdf(pdfData, p1, p2, options.size).then(url => {
				if (spreadUrl) URL.revokeObjectURL(spreadUrl);
				spreadUrl = url;
			});
		}
	});

	function getMapping(pageNum: number): string {
		if (pageNum < 1 || pageNum > pageCount) return 'Blank';
		
		const n = pageCount;
		const s = options.size;
		
		if (s === 'A5') {
			for (let i = 1; i <= n / 4; i++) {
				if (pageNum === n - (2 * i - 2)) return `Sheet ${i} Front, Left`;
				if (pageNum === 2 * i - 1) return `Sheet ${i} Front, Right`;
				if (pageNum === 2 * i) return `Sheet ${i} Back, Left`;
				if (pageNum === n - (2 * i - 1)) return `Sheet ${i} Back, Right`;
			}
		} else {
			// A6: 8 pages per physical sheet, 4 per logical A5 signature
			const logicalSig = Math.ceil(pageNum / 4);
			const physicalSheet = Math.ceil(logicalSig / 2);
			const isTop = logicalSig % 2 !== 0;
			
			// Within the signature (s):
			// Front: [4s-0, 4s-3], Back: [4s-2, 4s-1]
			// Let's re-calculate position accurately based on imposition.ts logic
			
			const pFirst = 2 * logicalSig - 2;
			const pSecond = 2 * logicalSig - 1;
			const pPenultimate = n - pSecond - 1;
			const pLast = n - pFirst - 1;

			const pos = isTop ? 'Top' : 'Bottom';
			
			if (pageNum - 1 === pFirst) return `Sheet ${physicalSheet} Front, ${pos} Right`;
			if (pageNum - 1 === pLast) return `Sheet ${physicalSheet} Front, ${pos} Left`;
			if (pageNum - 1 === pSecond) return `Sheet ${physicalSheet} Back, ${pos} Left`;
			if (pageNum - 1 === pPenultimate) return `Sheet ${physicalSheet} Back, ${pos} Right`;
		}
		return '...';
	}

	function next() {
		if (currentSpread < totalSpreads - 1) currentSpread++;
	}

	function prev() {
		if (currentSpread > 0) currentSpread--;
	}
</script>

<div class="flex flex-col items-center gap-8 w-full h-full">
	<div class="flex items-center gap-4 shrink-0">
		<button onclick={prev} disabled={currentSpread === 0} aria-label="Previous Spread" class="p-2 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
		</button>
		<span class="text-sm font-bold text-slate-400">Spread {currentSpread + 1} of {totalSpreads}</span>
		<button onclick={next} disabled={currentSpread === totalSpreads - 1} aria-label="Next Spread" class="p-2 rounded-full bg-slate-800 hover:bg-slate-700 disabled:opacity-30 transition-all">
			<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
		</button>
	</div>

	<div class="relative w-full flex-1 bg-slate-800/20 rounded-3xl border border-slate-700/30 overflow-hidden shadow-2xl">
		{#if spreadUrl}
			<iframe src={spreadUrl + "#toolbar=0&navpanes=0"} class="w-full h-full rounded-2xl" title="Spread Preview"></iframe>
		{:else}
			<div class="w-full h-full flex items-center justify-center">
				<div class="animate-spin rounded-full h-12 w-12 border-4 border-purple-500/20 border-t-purple-500"></div>
			</div>
		{/if}
		
		<!-- Spine and Labels Overlay -->
		<div class="absolute inset-0 pointer-events-none p-8 flex flex-col justify-end">
			<div class="absolute top-0 bottom-0 left-1/2 w-px bg-white/5 shadow-[0_0_10px_rgba(255,255,255,0.1)] z-10"></div>
			
			<div class="flex gap-8 relative z-20">
				{#if currentSpread === 0}
					<div class="flex-1"></div>
					<div class="flex-1 relative">
						<div class="text-[10px] text-slate-500 font-mono text-center bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded py-1 px-4">
							{getMapping(1)}
						</div>
					</div>
				{:else if currentSpread === totalSpreads - 1}
					<div class="flex-1 relative">
						<div class="text-[10px] text-slate-500 font-mono text-center bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded py-1 px-4">
							{getMapping(pageCount)}
						</div>
					</div>
					<div class="flex-1"></div>
				{:else}
					<div class="flex-1 relative">
						<div class="text-[10px] text-slate-500 font-mono text-center bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded py-1 px-4">
							{getMapping(currentSpread * 2)}
						</div>
					</div>
					<div class="flex-1 relative">
						<div class="text-[10px] text-slate-500 font-mono text-center bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded py-1 px-4">
							{getMapping(currentSpread * 2 + 1)}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<p class="text-[10px] text-slate-500 italic text-center max-w-md shrink-0">
		Verify your content order here. Labels show where each page is printed on the physical A4 sheets.
	</p>
</div>
