<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { browser } from '$app/environment';
	import { impose, type ImpositionOptions } from '$lib/imposition';
	import AssemblyGuide from '$lib/components/AssemblyGuide.svelte';
	import FoldedPreview from '$lib/components/FoldedPreview.svelte';
	import SheetPreview from '$lib/components/SheetPreview.svelte';

	let pdfData = $state<ArrayBuffer | null>(null);
	let pdfName = $state<string>('');
	let isProcessing = $state(false);
	let impositionError = $state<string | null>(null);
	let generatedPdfUrl = $state<string | null>(null);
	let imposedPdfData = $state<Uint8Array | null>(null);
	let view = $state<'print' | 'folded'>('print');
	const filterAlgorithms = [
		{ key: 'lighten',       label: 'Lighten',          sliderLabel: 'Brightness', filter: (t: number) => `grayscale(1) brightness(${1 + t})` },
		{ key: 'bleach',        label: 'Bleach Out',        sliderLabel: 'Intensity',  filter: (t: number) => `grayscale(1) brightness(${1 + t * 0.5}) contrast(${1 + t * 1.2})` },
		{ key: 'high-contrast', label: 'High Contrast',     sliderLabel: 'Contrast',   filter: (t: number) => `grayscale(1) contrast(${1 + t * 2.5})` },
		{ key: 'newsprint',     label: 'Newsprint',         sliderLabel: 'Exposure',   filter: (t: number) => `grayscale(1) contrast(${1.4 + t * 0.8}) brightness(${1.1 + t * 0.25})` },
		{ key: 'overexpose',    label: 'Overexpose',        sliderLabel: 'Wash',       filter: (t: number) => `grayscale(1) brightness(${1 + t * 2}) contrast(0.8)` },
		{ key: 'sepia',         label: 'Sepia',             sliderLabel: 'Brightness', filter: (t: number) => `sepia(1) brightness(${1 + t * 0.8})` },
		{ key: 'invert',        label: 'Invert (Dark BG)',  sliderLabel: 'Brightness', filter: (t: number) => `grayscale(1) invert(1) brightness(${1 + t * 0.5})` },
	];

	const PREFS_KEY = 'rpg-zine-prefs';
	type Prefs = { A5?: { printerMargin: number; middleMargin: number }; A6?: { printerMargin: number; middleMargin: number }; bwMode?: boolean; filterAlgorithm?: string; filterStrength?: number };
	function loadPrefs(): Prefs { if (!browser) return {}; try { return JSON.parse(localStorage.getItem(PREFS_KEY) ?? '{}'); } catch { return {}; } }
	function savePrefs(patch: Partial<Prefs>) { if (!browser) return; try { localStorage.setItem(PREFS_KEY, JSON.stringify({ ...loadPrefs(), ...patch })); } catch {} }

	let bwMode = $state(false);
	let filterAlgorithm = $state('lighten');
	let filterStrength = $state(0);
	let algoDropdownOpen = $state(false);
	let prefsReady = $state(false);

	let currentAlgo = $derived(filterAlgorithms.find(a => a.key === filterAlgorithm) ?? filterAlgorithms[0]);
	let previewFilter = $derived(bwMode ? currentAlgo.filter(filterStrength / 100) : '');

	let options = $state<ImpositionOptions>({
		size: 'A5',
		printerMargin: 5,
		middleMargin: 10,
		duplex: true,
		backToBack: false
	});

	let previewAspect = $derived(options.size === 'A5' ? 'aspect-[1.414/1]' : 'aspect-[1/1.414]');

	let numImposedPages = $state(0);
	let visiblePages = new SvelteSet<number>();

	function lazyPage(node: HTMLElement, index: number) {
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					if (entry.isIntersecting) {
						visiblePages.add(index);
					} else {
						visiblePages.delete(index);
					}
				}
			},
			{ rootMargin: '800px 0px', threshold: 0 }
		);
		observer.observe(node);
		return {
			destroy() {
				observer.disconnect();
			}
		};
	}

	async function handleFileUpload(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input.files?.length) return;

		const file = input.files[0];
		pdfName = file.name;
		pdfData = await file.arrayBuffer();
		await generatePreview();
	}

	async function generatePreview() {
		if (!pdfData) return;
		isProcessing = true;
		impositionError = null;
		// Reset so stale A5 data doesn't show while A6 generates
		imposedPdfData = null;
		visiblePages.clear();
		if (generatedPdfUrl) { URL.revokeObjectURL(generatedPdfUrl); generatedPdfUrl = null; }
		try {
			const result = await impose(pdfData.slice(0), options);
			const blob = new Blob([result.buffer as ArrayBuffer], { type: 'application/pdf' });
			generatedPdfUrl = URL.createObjectURL(blob);
			imposedPdfData = result;

			// Get imposed page count
			const { PDFDocument } = await import('pdf-lib');
			const imposedDoc = await PDFDocument.load((result.buffer as ArrayBuffer).slice(0));
			numImposedPages = imposedDoc.getPageCount();
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error);
			console.error('Imposition failed:', msg);
			impositionError = msg;
		} finally {
			isProcessing = false;
		}
	}

	// Re-generate preview when options change.
	// Svelte 5 only tracks reactive values that are actually *read* inside an
	// effect.  Checking `if (pdfData && options)` only tracks pdfData and the
	// object reference — mutations to options.size etc. won't re-fire the
	// effect.  Destructuring forces Svelte to track each property individually.
	// untrack() prevents state writes inside generatePreview() from becoming
	// additional dependencies (that would cause an infinite loop).
	$effect(() => {
		const { size, printerMargin, middleMargin } = options;
		if (pdfData && size && printerMargin >= 0 && middleMargin >= 0) {
			untrack(() => generatePreview());
		}
	});

	// Save margins keyed by size; save filter prefs flat — only after initial load
	$effect(() => {
		const { size, printerMargin, middleMargin } = options;
		if (prefsReady) savePrefs({ [size]: { printerMargin, middleMargin } });
	});
	$effect(() => {
		const bw = bwMode, algo = filterAlgorithm, strength = filterStrength;
		if (prefsReady) savePrefs({ bwMode: bw, filterAlgorithm: algo, filterStrength: strength });
	});

	onMount(() => {
		const prefs = loadPrefs();
		const size = options.size;
		const sp = prefs[size];
		if (sp) { options.printerMargin = sp.printerMargin; options.middleMargin = sp.middleMargin; }
		if (prefs.bwMode !== undefined) bwMode = prefs.bwMode;
		if (prefs.filterAlgorithm) filterAlgorithm = prefs.filterAlgorithm;
		if (prefs.filterStrength !== undefined) filterStrength = prefs.filterStrength;
		prefsReady = true;
		return () => { if (generatedPdfUrl) URL.revokeObjectURL(generatedPdfUrl); };
	});
</script>

	<main class="max-w-7xl mx-auto p-4 lg:p-12 grid lg:grid-cols-12 gap-12">
		<!-- Sidebar Controls -->
		<aside class="lg:col-span-4 flex flex-col gap-8">
			<div class="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm">
				<h2 class="text-lg font-bold mb-8 flex items-center gap-2">
					<span class="w-1.5 h-6 bg-purple-500 rounded-full"></span>
					Settings
				</h2>

				<!-- File Upload -->
				<div class="mb-10 group">
					<label for="pdf-upload" class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 group-hover:text-slate-400 transition-colors">Source PDF</label>
					<div class="relative">
						<input 
							type="file" 
							accept=".pdf" 
							onchange={handleFileUpload}
							class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
							id="pdf-upload"
						/>
						<div class="border-2 border-dashed border-slate-700 rounded-2xl p-8 transition-all group-hover:border-purple-500/50 group-hover:bg-purple-500/5 flex flex-col items-center justify-center gap-3">
							{#if pdfName}
								<div class="w-12 h-12 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
								</div>
								<p class="text-sm font-bold text-slate-200 text-center line-clamp-1 px-4">{pdfName}</p>
								<p class="text-[10px] text-slate-500 font-mono">{(pdfData?.byteLength || 0) / 1024 / 1024 > 1 ? ((pdfData?.byteLength || 0) / 1024 / 1024).toFixed(2) + ' MB' : ((pdfData?.byteLength || 0) / 1024).toFixed(0) + ' KB'}</p>
							{:else}
								<div class="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center text-slate-600">
									<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
								</div>
								<p class="text-xs font-bold text-slate-500">Drop PDF or Click to Upload</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Zine Size Selection -->
				<div class="mb-10">
					<span class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Zine Size</span>
					<div class="grid grid-cols-2 gap-4">
						{#each ['A5', 'A6'] as size (size)}
							<button 
								onclick={() => { const s = size as 'A5' | 'A6'; options.size = s; const sp = loadPrefs()[s]; if (sp) { options.printerMargin = sp.printerMargin; options.middleMargin = sp.middleMargin; } }}
								class="py-4 px-6 rounded-2xl border-2 font-black transition-all group overflow-hidden relative {options.size === size ? 'border-purple-500 bg-purple-500/10 text-white shadow-lg shadow-purple-500/10' : 'border-slate-800 text-slate-600 hover:border-slate-700 hover:text-slate-400'}"
							>
								<span class="relative z-10">{size}</span>
								{#if options.size === size}
									<div class="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent"></div>
								{/if}
							</button>
						{/each}
					</div>
				</div>

				<!-- Margin Controls -->
				<div class="mb-10 space-y-8">
					<div class="group">
						<div class="flex justify-between items-center mb-4">
							<label for="printer-margin" class="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">Printer Margin</label>
							<span class="text-[10px] font-mono text-purple-500 bg-purple-500/5 px-2 py-0.5 rounded">{options.printerMargin}mm</span>
						</div>
						<input id="printer-margin" type="range" bind:value={options.printerMargin} min="0" max="20" class="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
					</div>
					<div class="group">
						<div class="flex justify-between items-center mb-4">
							<label for="gutter-margin" class="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">Gutter (Middle)</label>
							<span class="text-[10px] font-mono text-purple-500 bg-purple-500/5 px-2 py-0.5 rounded">{options.middleMargin}mm</span>
						</div>
						<input id="gutter-margin" type="range" bind:value={options.middleMargin} min="0" max="40" class="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
					</div>
				</div>

		<!-- B&W / Print Filter -->
				<div class="mb-8 space-y-6">
					<label class="flex items-center gap-3 cursor-pointer group">
						<div class="relative">
							<input type="checkbox" bind:checked={bwMode} class="sr-only peer" />
							<div class="w-11 h-6 bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
						</div>
						<span class="text-sm font-medium text-slate-400 group-hover:text-slate-300 transition-colors">Black &amp; White Mode</span>
					</label>
					{#if bwMode}
						<div class="space-y-6">
							<div>
								<span class="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">Algorithm</span>
								<div class="relative">
									<button
										onclick={(e) => { e.stopPropagation(); algoDropdownOpen = !algoDropdownOpen; }}
										class="w-full flex items-center justify-between gap-2 bg-slate-800 border border-slate-700 hover:border-slate-600 text-slate-300 text-xs font-bold rounded-xl px-4 py-3 transition-colors {algoDropdownOpen ? 'border-purple-500/50' : ''}"
									>
										<span>{currentAlgo.label}</span>
										<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-slate-500 transition-transform {algoDropdownOpen ? 'rotate-180' : ''}"><path d="m6 9 6 6 6-6"/></svg>
									</button>
									{#if algoDropdownOpen}
										<div class="fixed inset-0 z-40" onclick={() => algoDropdownOpen = false} aria-hidden="true"></div>
										<div class="absolute top-full left-0 right-0 mt-1.5 bg-slate-900 border border-slate-700 rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50">
											{#each filterAlgorithms as algo (algo.key)}
												<button
													onclick={() => { filterAlgorithm = algo.key; algoDropdownOpen = false; }}
													class="w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-3
														{filterAlgorithm === algo.key
															? 'bg-purple-500/10 text-purple-300 border-l-2 border-purple-500'
															: 'text-slate-400 hover:bg-slate-800 hover:text-slate-200 border-l-2 border-transparent'}"
												>
													{algo.label}
												</button>
											{/each}
										</div>
									{/if}
								</div>
							</div>
							<div class="group">
								<div class="flex justify-between items-center mb-4">
									<label for="filter-strength" class="text-xs font-bold text-slate-500 uppercase tracking-widest group-hover:text-slate-400 transition-colors">{currentAlgo.sliderLabel}</label>
									<span class="text-[10px] font-mono text-purple-500 bg-purple-500/5 px-2 py-0.5 rounded">{filterStrength}%</span>
								</div>
								<input id="filter-strength" type="range" bind:value={filterStrength} min="0" max="100" class="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer" />
							</div>
						</div>
					{/if}
				</div>

				<!-- View Switcher -->
				<div class="p-1 bg-slate-900 rounded-xl border border-slate-700/50 flex mb-8">
					<button 
						onclick={() => view = 'print'}
						class="flex-1 py-2 rounded-lg text-xs font-bold transition-all {view === 'print' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}"
					>
						PRINT SHEETS
					</button>
					<button 
						onclick={() => view = 'folded'}
						class="flex-1 py-2 rounded-lg text-xs font-bold transition-all {view === 'folded' ? 'bg-slate-800 text-white shadow-lg' : 'text-slate-500 hover:text-slate-400'}"
					>
						FOLDED PREVIEW
					</button>
				</div>

				<div class="mb-8">
					<AssemblyGuide size={options.size} duplex={true} />
				</div>

				<!-- Assembly Guide / Instructions -->
				<div class="p-4 bg-slate-900/50 rounded-xl border border-slate-700/50 text-xs text-slate-500 leading-relaxed">
					<p class="font-bold text-slate-400 mb-1 flex items-center gap-1">
						<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
						Assembly Info
					</p>
					{#if options.size === 'A5'}
						Print double-sided (flip on long edge). Fold in half and staple in the middle.
					{:else}
						Print double-sided (flip on long edge). Cut A4 sheets in half horizontally. Stack and fold.
					{/if}
				</div>
			</div>

			<!-- Quick Downloader -->
			<button
				onclick={() => { if (generatedPdfUrl) {
					const link = document.createElement('a');
					link.href = generatedPdfUrl;
					link.download = 'zine-print-ready.pdf';
					link.click();
				}}}
				disabled={!generatedPdfUrl || isProcessing}
				class="w-full py-4 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-2xl font-black text-center block transition-all shadow-lg shadow-purple-500/20"
			>
				{isProcessing ? 'GENERATING...' : 'DOWNLOAD PDF'}
			</button>
		</aside>

		<!-- Live Preview Area -->
		<section class="lg:col-span-8 flex flex-col gap-6">
			<div class="flex items-center justify-between font-mono">
				<h2 class="text-xl font-bold flex items-center gap-2">
					<span class="w-1.5 h-6 bg-pink-500 rounded-full"></span>
					Print Preview
				</h2>
				<div class="flex items-center gap-4 text-[10px] text-slate-500 uppercase tracking-widest">
					<span class="flex items-center gap-1">
						<div class="w-3 h-0.5 border-t border-dashed border-pink-500/50"></div>
						Fold Line
					</span>
					<span class="flex items-center gap-1">
						<div class="w-3 h-0.5 bg-slate-700"></div>
						Cut Line
					</span>
				</div>
			</div>

			<div class="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex items-center justify-center h-[800px] relative overflow-hidden">
				{#if isProcessing}
					<div class="flex flex-col items-center gap-4 animate-pulse">
						<div class="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin"></div>
						<p class="font-bold text-slate-500 text-xs uppercase tracking-widest">Generating Sheets...</p>
					</div>
				{:else if impositionError}
				<div class="flex flex-col items-center gap-3 text-center max-w-sm">
					<div class="w-12 h-12 bg-red-500/10 rounded-xl flex items-center justify-center text-red-400">
						<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					</div>
					<p class="text-red-400 font-bold text-xs uppercase tracking-widest">Imposition Error</p>
					<p class="text-slate-500 text-xs font-mono">{impositionError}</p>
				</div>
			{:else if pdfData}
					<div class="w-full h-full flex flex-col items-center gap-8 p-4">
						{#if view === 'print'}
							{#if generatedPdfUrl}
								<div class="w-full h-full overflow-y-auto pr-2 space-y-12 flex flex-col items-center custom-scrollbar">
									{#each Array.from({ length: numImposedPages }, (_, i) => i) as i (i)}
										{@const sheetNum = Math.floor(i / 2) + 1}
										{@const isFront = i % 2 === 0}
										
										<div class="w-full max-w-[550px] space-y-3" use:lazyPage={i}>
											{#if isFront}
												<div class="flex items-center gap-4 mb-2">
													<div class="h-px flex-1 bg-slate-800"></div>
													<span class="text-[10px] font-black uppercase tracking-widest text-slate-500">Sheet {sheetNum}</span>
													<div class="h-px flex-1 bg-slate-800"></div>
												</div>
											{/if}

											<div class="bg-white rounded-lg shadow-2xl relative transition-transform hover:scale-[1.01] w-full shrink-0 {previewAspect} group/sheet overflow-hidden" style={previewFilter ? `filter: ${previewFilter}` : undefined}>
												{#if visiblePages.has(i)}
												<SheetPreview pdfBuffer={imposedPdfData} pageNumber={i + 1} />
											{:else}
												<div class="w-full h-full bg-slate-100 animate-pulse"></div>
											{/if}
												
												<!-- Overlays (Fold lines etc) -->
												<div class="absolute inset-0 pointer-events-none border-2 border-slate-700/10">
													{#if options.size === 'A5'}
														<div class="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-pink-500/40"></div>
													{:else}
														<!-- A6: Cross layout (Horizontal Cut, Vertical Fold) -->
														<div class="absolute inset-0 flex flex-col">
															<!-- Top row: vertical fold line, horizontal cut line at bottom -->
															<div class="flex-1 border-b border-slate-400/60 flex">
																<div class="flex-1 border-r border-dashed border-pink-500/30"></div>
																<div class="flex-1"></div>
															</div>
															<!-- Bottom row: vertical fold line -->
															<div class="flex-1 flex">
																<div class="flex-1 border-r border-dashed border-pink-500/30"></div>
																<div class="flex-1"></div>
															</div>
														</div>
													{/if}
												</div>

												<!-- Smart Label -->
												<div class="absolute top-3 right-3 flex items-center gap-2">
													<div class="bg-slate-900/90 backdrop-blur-md text-[9px] text-white px-2.5 py-1 rounded-full uppercase font-black tracking-tighter shadow-xl border border-white/10">
														Sheet {sheetNum} <span class="text-purple-400 mx-1">•</span> {isFront ? 'Front' : 'Back'}
													</div>
												</div>
											</div>
										</div>
									{/each}
									
									<div class="py-12 text-center space-y-2 opacity-30">
										<div class="w-1.5 h-1.5 bg-slate-500 rounded-full mx-auto"></div>
										<p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">End of Preview</p>
									</div>
								</div>
							{:else}
								<div class="flex flex-col items-center gap-4 opacity-40">
									<div class="w-12 h-12 border-4 border-slate-700/20 border-t-slate-500 rounded-full animate-spin"></div>
									<p class="text-[10px] font-bold uppercase tracking-widest text-slate-500">Preparing Print Preview...</p>
								</div>
							{/if}
						{:else}
							<div style={previewFilter ? `filter: ${previewFilter}; width: 100%; height: 100%` : 'width: 100%; height: 100%'}>
							<FoldedPreview {pdfData} {options} />
						</div>
						{/if}
					</div>
				{:else}
					<div class="text-center opacity-40">
						<div class="w-20 h-20 bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6">
							<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-slate-600"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
						</div>
						<p class="text-slate-500 font-medium text-xs uppercase tracking-widest">Awaiting PDF Upload</p>
					</div>
				{/if}
			</div>
		</section>
	</main>

<style>
	:global(body) {
		background-color: #0f172a;
	}
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #1e293b;
		border-radius: 10px;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb:hover {
		background: #334155;
	}
</style>
